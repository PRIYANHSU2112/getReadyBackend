import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { registerMongoHooks } from '../mongo.js';
import { createApp } from '../../app.js';
import { createShared } from '../../core/shared.js';
import { EventBus } from '../../core/events/EventBus.js';
import { JwtUtil } from '../../common/utils/jwt.util.js';
import { UserModel } from '../../modules/user/user.model.js';
import { CategoryModel } from '../../modules/category/category.model.js';
import { UserRole } from '../../common/constants/enums.js';
import { CATEGORY_PUBLIC_FIELDS } from '../../common/constants/category.js';
import { MemoryCacheService } from '../memory-cache.js';
import { seedRbacForTests } from '../rbac-seed.js';

registerMongoHooks();

const PUBLIC_KEYS = new Set(CATEGORY_PUBLIC_FIELDS);

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const mockStorage = {
  upload: async (file) => ({
    url: `https://cdn.example.com/categories/${file.originalname}`,
    key: `categories/${file.originalname}`,
  }),
  delete: async () => undefined,
};

describe('Category routes (integration)', () => {
  let app;
  let adminToken;
  let customerToken;
  let beauticianToken;

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

    const beautician = await UserModel.create({
      name: 'Beautician One',
      phone: '+919811100002',
      role: UserRole.BEAUTICIAN,
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

    beauticianToken = jwt.sign({
      sub: beautician._id.toString(),
      role: UserRole.BEAUTICIAN,
      phone: '+919811100002',
    });
  });

  it('GET /api/v1/categories/public returns slim payload only', async () => {
    await CategoryModel.create({
      name: 'Hair',
      slug: 'hair',
      isActive: true,
      isFeatured: true,
      displayOrder: 1,
      description: 'Hair services',
      image: {
        url: 'https://cdn.example.com/hair.jpg',
        publicId: 'categories/hair.jpg',
      },
      defaultPriceRange: { min: 199, max: 1999 },
      metadata: { secret: true },
    });
    await CategoryModel.create({
      name: 'Inactive',
      slug: 'inactive',
      isActive: false,
      displayOrder: 2,
    });

    const res = await request(app).get('/api/v1/categories/public');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const item = res.body.data[0];
    expect(Object.keys(item).every((k) => PUBLIC_KEYS.has(k))).toBe(true);
    expect(item).not.toHaveProperty('metadata');
    expect(item).not.toHaveProperty('deletedAt');
    expect(item.slug).toBe('hair');
    expect(item.defaultPriceRange).toEqual({ min: 199, max: 1999 });
  });

  it('GET /public/:slug and featured filter work', async () => {
    await CategoryModel.create({
      name: 'Skin',
      slug: 'skin',
      isActive: true,
      isFeatured: false,
      displayOrder: 1,
    });
    await CategoryModel.create({
      name: 'Nail',
      slug: 'nail',
      isActive: true,
      isFeatured: true,
      displayOrder: 2,
    });

    const bySlug = await request(app).get('/api/v1/categories/public/skin');
    expect(bySlug.status).toBe(200);
    expect(bySlug.body.data.slug).toBe('skin');

    const featured = await request(app)
      .get('/api/v1/categories/public')
      .query({ featured: true });
    expect(featured.status).toBe(200);
    expect(featured.body.data).toHaveLength(1);
    expect(featured.body.data[0].slug).toBe('nail');
  });

  it('admin can upload image on create; customer forbidden; beautician can read', async () => {
    const created = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', tinyPng, 'hair.png')
      .field('name', 'Hair')
      .field('isFeatured', 'true')
      .field('defaultPriceRange', JSON.stringify({ min: 299, max: 2499 }))
      .field('metadata', JSON.stringify({ source: 'test' }));

    expect(created.status).toBe(201);
    expect(created.body.data.slug).toBe('hair');
    expect(created.body.data.image.url).toContain('hair.png');
    expect(created.body.data).not.toHaveProperty('imageUrl');
    expect(created.body.data.defaultPriceRange).toEqual({ min: 299, max: 2499 });
    expect(created.body.data.metadata).toEqual({ source: 'test' });

    const forbidden = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(forbidden.status).toBe(403);

    const staffList = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${beauticianToken}`);
    expect(staffList.status).toBe(200);
    expect(staffList.body.data.some((c) => c.slug === 'hair')).toBe(true);

    const beauticianCreate = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${beauticianToken}`)
      .send({ name: 'Spa' });
    expect(beauticianCreate.status).toBe(403);
  });

  it('soft-delete hides from public; restore brings category back', async () => {
    const created = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Makeup', isActive: true });

    const id = created.body.data.id;

    let pub = await request(app).get('/api/v1/categories/public');
    expect(pub.body.data.some((c) => c.id === id)).toBe(true);

    await request(app)
      .delete(`/api/v1/categories/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    pub = await request(app).get('/api/v1/categories/public');
    expect(pub.body.data.some((c) => c.id === id)).toBe(false);

    const restored = await request(app)
      .post(`/api/v1/categories/${id}/restore`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(restored.status).toBe(200);
    expect(restored.body.data.deletedAt).toBeNull();
  });

  it('reorder and bulk status work for admin', async () => {
    const a = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'A Cat', displayOrder: 0 });
    const b = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'B Cat', displayOrder: 1 });

    const reorder = await request(app)
      .patch('/api/v1/categories/reorder')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { id: a.body.data.id, displayOrder: 5 },
          { id: b.body.data.id, displayOrder: 1 },
        ],
      });
    expect(reorder.status).toBe(200);

    const bulk = await request(app)
      .patch('/api/v1/categories/bulk/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ids: [a.body.data.id], isActive: false });
    expect(bulk.status).toBe(200);

    const getA = await request(app)
      .get(`/api/v1/categories/${a.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getA.body.data.isActive).toBe(false);
    expect(getA.body.data.displayOrder).toBe(5);
  });

  it('rejects duplicate slug and invalid price range', async () => {
    await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Spa', slug: 'spa' });

    const dup = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Spa 2', slug: 'spa' });
    expect(dup.status).toBe(409);

    const badRange = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Bad Range',
        defaultPriceRange: { min: 900, max: 100 },
      });
    expect(badRange.status).toBe(422);
  });
});
