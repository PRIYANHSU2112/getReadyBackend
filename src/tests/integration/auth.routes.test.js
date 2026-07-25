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

registerMongoHooks();

describe('Auth routes (integration)', () => {
  let app;
  let memoryCache;

  beforeEach(async () => {
    memoryCache = new MemoryCacheService();
    const shared = createShared({
      skipRedis: true,
      eventBus: new EventBus(),
      jwtUtil: new JwtUtil('test-jwt-secret-min-16-chars', '1h'),
      cacheService: memoryCache,
    });
    app = createApp({ shared });

    await UserModel.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'password123',
      role: UserRole.ADMIN,
    });
  });

  it('POST /api/v1/auth/admin/login returns token', async () => {
    const res = await request(app).post('/api/v1/auth/admin/login').send({
      email: 'admin@test.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.role).toBe('admin');
    expect(res.headers['x-response-time']).toBeTruthy();
  });

  it('POST /api/v1/auth/login alias works', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@test.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
  });

  it('POST /api/v1/auth/mobile/send-otp and verify-otp', async () => {
    const sendRes = await request(app).post('/api/v1/auth/mobile/send-otp').send({
      phone: '+919999999999',
      role: 'customer',
    });

    expect(sendRes.status).toBe(200);

    const otpKey = 'otp:login:+919999999999:customer';
    const record = await memoryCache.get(otpKey);
    expect(record?.otp).toBeTruthy();

    const verifyRes = await request(app).post('/api/v1/auth/mobile/verify-otp').send({
      phone: '+919999999999',
      otp: record.otp,
      role: 'customer',
      name: 'Mobile User',
    });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.token).toBeTruthy();
    expect(verifyRes.body.data.user.phone).toBe('+919999999999');
  });

  it('GET /api/v1/auth/me requires auth', async () => {
    const login = await request(app).post('/api/v1/auth/admin/login').send({
      email: 'admin@test.com',
      password: 'password123',
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.data.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('admin@test.com');
  });
});
