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
import { ServiceChangeRequestModel } from '../../modules/service/service-change-request.model.js';
import {
  UserRole,
  ServiceStatus,
  ServiceChangeRequestStatus,
} from '../../common/constants/enums.js';
import { MemoryCacheService } from '../memory-cache.js';
import { seedRbacForTests } from '../rbac-seed.js';

registerMongoHooks();

const mockStorage = {
  upload: async (file) => ({
    url: `https://cdn.example.com/services/${file.originalname}`,
    key: `services/${file.originalname}`,
  }),
  delete: async () => undefined,
};

describe('Service + change request routes (integration)', () => {
  let app;
  let adminToken;
  let beauticianToken;
  let customerToken;
  let categoryId;

  beforeEach(async () => {
    const jwt = new JwtUtil('test-jwt-secret-min-16-chars', '1h');
    const shared = createShared({
      skipRedis: true,
      eventBus: new EventBus(),
      jwtUtil: jwt,
      cacheService: new MemoryCacheService(),
      storageService: mockStorage,
    });
    app = createApp({ shared });
    await seedRbacForTests();

    await UserModel.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'password123',
      role: UserRole.ADMIN,
    });

    const beautician = await UserModel.create({
      name: 'Beautician One',
      phone: '+919811100002',
      role: UserRole.BEAUTICIAN,
    });

    const customer = await UserModel.create({
      name: 'Customer One',
      phone: '+919811100001',
      role: UserRole.CUSTOMER,
    });

    const login = await request(app).post('/api/v1/auth/admin/login').send({
      email: 'admin@test.com',
      password: 'password123',
    });
    adminToken = login.body.data.accessToken;

    beauticianToken = jwt.sign({
      sub: beautician._id.toString(),
      role: UserRole.BEAUTICIAN,
      phone: '+919811100002',
    });
    customerToken = jwt.sign({
      sub: customer._id.toString(),
      role: UserRole.CUSTOMER,
      phone: '+919811100001',
    });

    const category = await CategoryModel.create({
      name: 'Hair',
      slug: 'hair',
      isActive: true,
      displayOrder: 1,
    });
    categoryId = category._id.toString();
  });

  it('public hides pending; admin approve create with price publishes', async () => {
    const created = await request(app)
      .post('/api/v1/services')
      .set('Authorization', `Bearer ${beauticianToken}`)
      .send({
        name: 'Haircut Classic',
        categoryId,
        approxPrice: 500,
      });

    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe(ServiceStatus.PENDING_APPROVAL);
    expect(created.body.data.price).toBeNull();

    let pub = await request(app).get('/api/v1/services/public');
    expect(pub.status).toBe(200);
    expect(pub.body.data.some((s) => s.id === created.body.data.id)).toBe(false);

    const approved = await request(app)
      .post(`/api/v1/services/${created.body.data.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 799, discountType: 'NONE' });

    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe(ServiceStatus.APPROVED);
    expect(approved.body.data.price).toBe(799);

    pub = await request(app).get('/api/v1/services/public');
    expect(pub.body.data.some((s) => s.id === created.body.data.id)).toBe(true);
  });

  it('beautician update creates change request; live unchanged; reject keeps live', async () => {
    const live = await ServiceModel.create({
      name: 'Spa Glow',
      slug: 'spa-glow',
      categoryId,
      status: ServiceStatus.APPROVED,
      price: 1000,
      discountedPrice: 1000,
      isActive: true,
      shortDescription: 'old desc',
      createdBy: (
        await UserModel.findOne({ role: UserRole.BEAUTICIAN })
      )._id,
    });

    const before = await ServiceModel.findById(live._id).lean();

    const patch = await request(app)
      .patch(`/api/v1/services/${live._id}`)
      .set('Authorization', `Bearer ${beauticianToken}`)
      .send({ shortDescription: 'new desc', price: 50 });

    expect(patch.status).toBe(200);
    expect(patch.body.data.liveUnchanged).toBe(true);
    expect(patch.body.data.changeRequest.status).toBe(
      ServiceChangeRequestStatus.PENDING,
    );
    expect(patch.body.data.changeRequest.changes.shortDescription).toBe('new desc');
    expect(patch.body.data.changeRequest.changes.price).toBeUndefined();
    expect(patch.body.data.changeRequest.diff[0].field).toBe('shortDescription');

    const after = await ServiceModel.findById(live._id).lean();
    expect(after.shortDescription).toBe(before.shortDescription);

    const crId = patch.body.data.changeRequest.id;

    const detail = await request(app)
      .get(`/api/v1/service-change-requests/${crId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.diff.length).toBeGreaterThan(0);

    const badReject = await request(app)
      .post(`/api/v1/service-change-requests/${crId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(badReject.status).toBe(422);

    const rejected = await request(app)
      .post(`/api/v1/service-change-requests/${crId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rejectedReason: 'Please improve the description text' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe(ServiceChangeRequestStatus.REJECTED);

    const stillLive = await ServiceModel.findById(live._id).lean();
    expect(stillLive.shortDescription).toBe('old desc');
  });

  it('admin approve change request applies changes to live service', async () => {
    const beau = await UserModel.findOne({ role: UserRole.BEAUTICIAN });
    const live = await ServiceModel.create({
      name: 'Facial Basic',
      slug: 'facial-basic',
      categoryId,
      status: ServiceStatus.APPROVED,
      price: 600,
      discountedPrice: 600,
      isActive: true,
      shortDescription: 'basic',
      createdBy: beau._id,
    });

    const cr = await ServiceChangeRequestModel.create({
      serviceId: live._id,
      requestedBy: beau._id,
      status: ServiceChangeRequestStatus.PENDING,
      changes: { shortDescription: 'premium facial' },
      previousValues: { shortDescription: 'basic' },
      changedFields: ['shortDescription'],
    });

    const approved = await request(app)
      .post(`/api/v1/service-change-requests/${cr._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewedNote: 'ok' });

    expect(approved.status).toBe(200);
    expect(approved.body.data.service.shortDescription).toBe('premium facial');
    expect(approved.body.data.changeRequest.status).toBe(
      ServiceChangeRequestStatus.APPROVED,
    );

    const updated = await ServiceModel.findById(live._id).lean();
    expect(updated.shortDescription).toBe('premium facial');
  });

  it('customer cannot list staff services', async () => {
    const res = await request(app)
      .get('/api/v1/services')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('create reject requires rejectionReason', async () => {
    const created = await request(app)
      .post('/api/v1/services')
      .set('Authorization', `Bearer ${beauticianToken}`)
      .send({ name: 'Waxing', categoryId, approxPrice: 300 });

    const bad = await request(app)
      .post(`/api/v1/services/${created.body.data.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rejectionReason: 'no' });
    expect(bad.status).toBe(422);

    const ok = await request(app)
      .post(`/api/v1/services/${created.body.data.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rejectionReason: 'Missing duration and inclusions list' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe(ServiceStatus.REJECTED);
  });
});
