import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { registerMongoHooks } from '../mongo.js';
import { createApp } from '../../app.js';
import { createShared } from '../../core/shared.js';
import { EventBus } from '../../core/events/EventBus.js';
import { JwtUtil } from '../../common/utils/jwt.util.js';
import { UserModel } from '../../modules/user/user.model.js';
import { CategoryModel } from '../../modules/category/category.model.js';
import { ServiceModel } from '../../modules/service/service.model.js';
import { PackageModel } from '../../modules/package/package.model.js';
import { UserRole } from '../../common/constants/enums.js';
import { PackageStatus } from '../../modules/package/package.enum.js';
import { MemoryCacheService } from '../memory-cache.js';

registerMongoHooks();

describe('Package routes (integration)', () => {
  let app;
  let adminToken;
  let beauticianToken;
  let categoryId;
  let serviceId;

  beforeEach(async () => {
    const memoryCache = new MemoryCacheService();
    const shared = createShared({
      skipRedis: true,
      eventBus: new EventBus(),
      jwtUtil: new JwtUtil('test-jwt-secret-min-16-chars', '1h'),
      cacheService: memoryCache,
    });
    app = createApp({ shared });

    const admin = await UserModel.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'password123',
      role: UserRole.ADMIN,
    });

    const beautician = await UserModel.create({
      name: 'Beautician User',
      email: 'beautician@test.com',
      password: 'password123',
      phone: '+919999888777',
      role: UserRole.BEAUTICIAN,
    });

    const category = await CategoryModel.create({
      name: 'Facial',
      slug: 'facial',
    });
    categoryId = category._id.toString();

    const service = await ServiceModel.create({
      name: 'Hydra Facial',
      slug: 'hydra-facial',
      categoryId: category._id,
      createdBy: admin._id,
      status: 'APPROVED',
      price: 500,
    });
    serviceId = service._id.toString();

    const login = await request(app).post('/api/v1/auth/admin/login').send({
      email: 'admin@test.com',
      password: 'password123',
    });
    adminToken = login.body.data.accessToken;

    const jwt = new JwtUtil('test-jwt-secret-min-16-chars', '1h');
    beauticianToken = jwt.signAccessToken({
      sub: beautician._id.toString(),
      role: UserRole.BEAUTICIAN,
    });
  });

  it('admin create package publishes immediately as APPROVED', async () => {
    const res = await request(app)
      .post('/api/v1/packages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Bridal Glow Package',
        packageType: 'FIXED',
        price: 2500,
        items: [
          {
            serviceId,
            categoryId,
            groupTitle: 'Facial',
            isMandatory: true,
            isDefaultSelected: true,
            badgeTags: ['Popular'],
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe(PackageStatus.APPROVED);
    expect(res.body.data.price).toBe(2500);
    expect(res.body.data.slug).toBe('bridal-glow-package');
  });

  it('beautician create package is PENDING_APPROVAL and admin approves with price', async () => {
    const createRes = await request(app)
      .post('/api/v1/packages')
      .set('Authorization', `Bearer ${beauticianToken}`)
      .send({
        name: 'Express Glam Package',
        packageType: 'CUSTOMIZABLE',
        minSelectCount: 2,
        maxSelectCount: 2,
        approxPrice: 1800,
        items: [
          {
            serviceId,
            categoryId,
            isMandatory: false,
            isDefaultSelected: true,
          },
        ],
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe(PackageStatus.PENDING_APPROVAL);
    expect(createRes.body.data.approxPrice).toBe(1800);
    expect(createRes.body.data.price).toBeNull();

    const packageId = createRes.body.data.id;

    // Public list hides PENDING_APPROVAL package
    const publicBefore = await request(app).get('/api/v1/packages/public');
    expect(publicBefore.body.data.some((p) => p.id === packageId)).toBe(false);

    // Admin approves with price
    const approveRes = await request(app)
      .post(`/api/v1/packages/${packageId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 1750 });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe(PackageStatus.APPROVED);
    expect(approveRes.body.data.price).toBe(1750);

    // Public list now returns APPROVED package
    const publicAfter = await request(app).get('/api/v1/packages/public');
    expect(publicAfter.body.data.some((p) => p.id === packageId)).toBe(true);
  });
});
