import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { registerMongoHooks } from '../mongo.js';
import { createApp } from '../../app.js';
import { createShared } from '../../core/shared.js';
import { EventBus } from '../../core/events/EventBus.js';
import { JwtUtil } from '../../common/utils/jwt.util.js';
import { UserModel } from '../../modules/user/user.model.js';
import { BannerModel } from '../../modules/banner/banner.model.js';
import { CategoryModel } from '../../modules/category/category.model.js';
import {
  UserRole,
  BannerStatus,
  BannerType,
  BannerPlatform,
} from '../../common/constants/enums.js';
import { MemoryCacheService } from '../memory-cache.js';
import { seedRbacForTests } from '../rbac-seed.js';

registerMongoHooks();

const serviceId = '507f1f77bcf86cd799439011';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const mockStorage = {
  upload: async (file) => ({
    url: `https://cdn.example.com/banners/${file.originalname}`,
    key: `banners/${file.originalname}`,
  }),
  delete: async () => undefined,
};

const dbBanner = {
  title: 'Summer Glow',
  image: {
    url: 'https://cdn.example.com/banners/summer.jpg',
    publicId: 'banners/summer.jpg',
  },
  linkUrl: 'https://example.com/offers/summer',
  position: 1,
  serviceCategory: 'Hair',
  serviceIds: [serviceId],
  type: BannerType.OFFER,
  status: BannerStatus.ACTIVE,
  sortOrder: 0,
  platform: BannerPlatform.ALL,
};

function postBanner(app, token, fields = {}) {
  const req = request(app)
    .post('/api/v1/banners')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', tinyPng, 'summer.png');

  for (const [key, value] of Object.entries(fields)) {
    req.field(key, String(value));
  }
  return req;
}

describe('Banner routes (integration)', () => {
  let app;
  let adminToken;
  let customerToken;

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

    customerToken = jwt.sign({
      sub: customer._id.toString(),
      role: UserRole.CUSTOMER,
      phone: '+919811100001',
    });
  });

  it('GET /api/v1/banners/active is public and returns only active in-window', async () => {
    await BannerModel.create(dbBanner);
    await BannerModel.create({
      ...dbBanner,
      title: 'Inactive',
      status: BannerStatus.INACTIVE,
      position: 2,
    });
    await BannerModel.create({
      ...dbBanner,
      title: 'Future',
      position: 3,
      startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    const res = await request(app).get('/api/v1/banners/active');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Summer Glow');
    expect(res.body.meta.total).toBe(1);
  });

  it('GET /api/v1/banners/active filters by serviceCategory and position', async () => {
    await BannerModel.create(dbBanner);
    await BannerModel.create({
      ...dbBanner,
      title: 'Skin Promo',
      serviceCategory: 'Skin',
      position: 2,
    });

    const res = await request(app)
      .get('/api/v1/banners/active')
      .query({ serviceCategory: 'Hair', position: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].serviceCategory).toBe('Hair');
  });

  it('POST /api/v1/banners uploads image and creates banner as admin', async () => {
    const res = await postBanner(app, adminToken, {
      title: 'Summer Glow',
      linkUrl: 'https://example.com/offers/summer',
      position: 1,
      serviceCategory: 'Hair',
      serviceIds: JSON.stringify([serviceId]),
      type: BannerType.OFFER,
      status: BannerStatus.ACTIVE,
      sortOrder: 0,
      platform: BannerPlatform.ALL,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Summer Glow');
    expect(res.body.data.position).toBe(1);
    expect(res.body.data.serviceCategory).toBe('Hair');
    expect(res.body.data.image.url).toContain('summer.png');
    expect(res.body.data.imageUrl).toContain('summer.png');
  });

  it('rejects create without image file', async () => {
    const res = await request(app)
      .post('/api/v1/banners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'No Image',
        position: 1,
        status: BannerStatus.INACTIVE,
      });

    expect(res.status).toBe(400);
  });

  it('forbids customer from admin list', async () => {
    const res = await request(app)
      .get('/api/v1/banners')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });

  it('admin list includes inactive; soft-delete hides from public', async () => {
    const created = await postBanner(app, adminToken, {
      title: 'Draft',
      position: 1,
      status: BannerStatus.INACTIVE,
    });

    const id = created.body.data.id;

    const adminList = await request(app)
      .get('/api/v1/banners')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminList.status).toBe(200);
    expect(adminList.body.data.some((b) => b.id === id)).toBe(true);

    await request(app)
      .patch(`/api/v1/banners/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: BannerStatus.ACTIVE });

    let active = await request(app).get('/api/v1/banners/active');
    expect(active.body.data.some((b) => b.id === id)).toBe(true);

    const del = await request(app)
      .delete(`/api/v1/banners/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);

    active = await request(app).get('/api/v1/banners/active');
    expect(active.body.data.some((b) => b.id === id)).toBe(false);
  });

  it('PATCH can replace banner image via multipart', async () => {
    const created = await postBanner(app, adminToken, {
      title: 'Replace Me',
      position: 1,
      status: BannerStatus.INACTIVE,
    });
    const id = created.body.data.id;

    const res = await request(app)
      .patch(`/api/v1/banners/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', tinyPng, 'updated.png')
      .field('title', 'Replaced');

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Replaced');
    expect(res.body.data.image.url).toContain('updated.png');
  });

  it('requires auth for admin create', async () => {
    const res = await request(app)
      .post('/api/v1/banners')
      .attach('file', tinyPng, 'summer.png')
      .field('title', 'Summer Glow')
      .field('position', '1');

    expect(res.status).toBe(401);
  });

  it('create with categoryId denormalizes slug; active filter matches categoryId or legacy string', async () => {
    const category = await CategoryModel.create({
      name: 'Hair',
      slug: 'hair',
      isActive: true,
      displayOrder: 1,
    });

    const created = await postBanner(app, adminToken, {
      title: 'Hair Offer',
      position: 1,
      categoryId: category._id.toString(),
      status: BannerStatus.ACTIVE,
    });

    expect(created.status).toBe(201);
    expect(created.body.data.categoryId).toBe(category._id.toString());
    expect(created.body.data.serviceCategory).toBe('hair');

    await BannerModel.create({
      ...dbBanner,
      title: 'Legacy Hair',
      categoryId: null,
      serviceCategory: 'hair',
      position: 2,
    });

    const byId = await request(app)
      .get('/api/v1/banners/active')
      .query({ categoryId: category._id.toString() });

    expect(byId.status).toBe(200);
    expect(byId.body.data.length).toBeGreaterThanOrEqual(2);
    expect(
      byId.body.data.every(
        (b) =>
          b.categoryId === category._id.toString() || b.serviceCategory === 'hair',
      ),
    ).toBe(true);
  });
});
