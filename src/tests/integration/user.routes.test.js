import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { registerMongoHooks } from '../mongo.js';
import { createApp } from '../../app.js';
import { createShared } from '../../core/shared.js';
import { EventBus } from '../../core/events/EventBus.js';
import { JwtUtil } from '../../common/utils/jwt.util.js';
import { UserModel } from '../../modules/user/user.model.js';
import { UserRole } from '../../common/constants/enums.js';
import { MemoryCacheService } from '../memory-cache.js';
import { seedRbacForTests } from '../rbac-seed.js';

registerMongoHooks();

describe('User routes (integration)', () => {
  let app;
  let adminToken;

  beforeEach(async () => {
    const shared = createShared({
      skipRedis: true,
      eventBus: new EventBus(),
      jwtUtil: new JwtUtil('test-jwt-secret-min-16-chars', '1h'),
      cacheService: new MemoryCacheService(),
    });
    app = createApp({ shared });

    await seedRbacForTests();

    await UserModel.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'password123',
      role: UserRole.ADMIN,
    });

    await UserModel.create({
      name: 'Customer One',
      email: 'cust@example.com',
      phone: '+919888888888',
      role: UserRole.CUSTOMER,
      referralCode: 'CUST0001',
    });

    const login = await request(app).post('/api/v1/auth/admin/login').send({
      email: 'admin@test.com',
      password: 'password123',
    });
    adminToken = login.body.data.accessToken;
  });

  it('POST /api/v1/users requires admin auth', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .send({
        name: 'New Customer',
        phone: '+919777777777',
        role: 'customer',
      });

    expect(res.status).toBe(401);
  });

  it('POST /api/v1/users creates user as admin', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'New Customer',
        phone: '+919777777777',
        role: 'customer',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.phone).toBe('+919777777777');
  });

  it('GET /api/v1/users lists with pagination meta', async () => {
    const res = await request(app)
      .get('/api/v1/users?role=customer')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    expect(res.body.meta.filters.role).toBe('customer');
  });

  it('GET /api/v1/users is forbidden for customer token', async () => {
    const customer = await UserModel.findOne({ role: UserRole.CUSTOMER }).lean();
    const jwtUtil = new JwtUtil('test-jwt-secret-min-16-chars', '1h');
    const customerToken = jwtUtil.sign({
      sub: customer._id.toString(),
      role: UserRole.CUSTOMER,
      email: customer.email,
    });

    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });
});
