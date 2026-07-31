import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { registerMongoHooks } from '../mongo.js';
import { createApp } from '../../app.js';
import { createShared } from '../../core/shared.js';
import { EventBus } from '../../core/events/EventBus.js';
import { JwtUtil } from '../../common/utils/jwt.util.js';
import { UserModel } from '../../modules/user/user.model.js';
import { RoleModel } from '../../modules/rbac/role.model.js';
import { UserRole } from '../../common/constants/enums.js';
import { MemoryCacheService } from '../memory-cache.js';
import { seedRbacForTests } from '../rbac-seed.js';

registerMongoHooks();

describe('RBAC routes (integration)', () => {
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

    const login = await request(app).post('/api/v1/auth/admin/login').send({
      email: 'admin@test.com',
      password: 'password123',
    });
    adminToken = login.body.data.accessToken;
  });

  it('GET /api/v1/permissions lists synced permissions', async () => {
    const res = await request(app)
      .get('/api/v1/permissions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.some((p) => p.key === 'users.read')).toBe(true);
  });

  it('POST /api/v1/permissions/sync upserts catalog', async () => {
    const res = await request(app)
      .post('/api/v1/permissions/sync')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBeGreaterThan(0);
  });

  it('GET /api/v1/roles lists system roles', async () => {
    const res = await request(app)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const slugs = res.body.data.map((r) => r.slug);
    expect(slugs).toEqual(
      expect.arrayContaining([
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.CUSTOMER,
        UserRole.BEAUTICIAN,
      ]),
    );
  });

  it('POST /api/v1/roles creates a custom role', async () => {
    const res = await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Front Desk',
        slug: 'front_desk',
        permissions: ['users.read'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('front_desk');
    expect(res.body.data.permissions).toContain('users.read');
  });

  it('customer role has empty permissions after seed', async () => {
    const customerRole = await RoleModel.findOne({ slug: UserRole.CUSTOMER }).lean();
    expect(customerRole.permissions).toEqual([]);
  });
});
