import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { registerMongoHooks } from '../mongo.js';
import { createApp } from '../../app.js';
import { createShared } from '../../core/shared.js';
import { EventBus } from '../../core/events/EventBus.js';
import { JwtUtil } from '../../common/utils/jwt.util.js';
import { UserModel } from '../../modules/user/user.model.js';
import { FilterModel } from '../../modules/filter/filter.model.js';
import { FilterValueModel } from '../../modules/filter/filter-value.model.js';
import {
  UserRole,
  FilterDisplayType,
  FilterSelectionType,
} from '../../common/constants/enums.js';
import { MemoryCacheService } from '../memory-cache.js';
import { seedRbacForTests } from '../rbac-seed.js';

registerMongoHooks();

const PUBLIC_GROUP_KEYS = new Set([
  'id',
  'name',
  'slug',
  'displayType',
  'selectionType',
  'isRequired',
  'displayOrder',
  'values',
]);

const PUBLIC_VALUE_KEYS = new Set([
  'id',
  'label',
  'value',
  'displayOrder',
  'isDefault',
  'icon',
]);

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const mockStorage = {
  upload: async (file) => ({
    url: `https://cdn.example.com/filters/${file.originalname}`,
    key: `filters/${file.originalname}`,
  }),
  delete: async () => undefined,
};

describe('Filter routes (integration)', () => {
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

  it('GET /api/v1/filters/public is public and returns slim payload only', async () => {
    const group = await FilterModel.create({
      name: 'Skin Type',
      slug: 'skin-type',
      displayType: FilterDisplayType.CHIPS,
      selectionType: FilterSelectionType.MULTIPLE,
      isActive: true,
      displayOrder: 1,
      image: {
        url: 'https://cdn.example.com/skin.jpg',
        publicId: 'filters/skin.jpg',
      },
      description: 'hidden from public',
      metadata: { adminOnly: true },
      scopes: ['services'],
    });
    await FilterValueModel.create({
      filterId: group._id,
      label: 'Oily',
      value: 'oily',
      slug: 'oily',
      isActive: true,
      displayOrder: 1,
      image: {
        url: 'https://cdn.example.com/oily.jpg',
        publicId: 'filters/oily.jpg',
      },
      metadata: { secret: 1 },
    });
    await FilterModel.create({
      name: 'Inactive',
      slug: 'inactive',
      isActive: false,
      displayOrder: 2,
    });

    const res = await request(app).get('/api/v1/filters/public').query({ scope: 'services' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const item = res.body.data[0];
    expect(Object.keys(item).every((k) => PUBLIC_GROUP_KEYS.has(k))).toBe(true);
    expect(item).not.toHaveProperty('image');
    expect(item).not.toHaveProperty('metadata');
    expect(item).not.toHaveProperty('description');
    expect(item.values).toHaveLength(1);
    expect(Object.keys(item.values[0]).every((k) => PUBLIC_VALUE_KEYS.has(k))).toBe(true);
    expect(item.values[0]).not.toHaveProperty('image');
  });

  it('admin can upload image on create filter + values; customer forbidden', async () => {
    const created = await request(app)
      .post('/api/v1/filters')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', tinyPng, 'prime.png')
      .field('name', 'Prime Selection')
      .field('displayType', FilterDisplayType.CHIPS)
      .field('selectionType', FilterSelectionType.MULTIPLE)
      .field('scopes', JSON.stringify(['services']))
      .field('metadata', JSON.stringify({ source: 'swagger' }))
      .field('isFeatured', 'true');

    expect(created.status).toBe(201);
    expect(created.body.data.slug).toBe('prime-selection');
    expect(created.body.data.image.url).toContain('prime.png');
    expect(created.body.data).not.toHaveProperty('imageUrl');
    expect(created.body.data.metadata).toEqual({ source: 'swagger' });
    expect(created.body.data.isFeatured).toBe(true);

    const value = await request(app)
      .post(`/api/v1/filters/${created.body.data.id}/values`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', tinyPng, 'popular.png')
      .field('label', 'Popular')
      .field('value', 'popular')
      .field('displayOrder', '0');

    expect(value.status).toBe(201);
    expect(value.body.data.slug).toBe('popular');
    expect(value.body.data.image.url).toContain('popular.png');

    const forbidden = await request(app)
      .get('/api/v1/filters')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(forbidden.status).toBe(403);
  });

  it('soft-delete hides from public; restore brings group back', async () => {
    const created = await request(app)
      .post('/api/v1/filters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Rating', scopes: ['services'], isActive: true });

    const id = created.body.data.id;

    await request(app)
      .post(`/api/v1/filters/${id}/values`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: '4.8', value: '4.8', icon: 'star' });

    let pub = await request(app).get('/api/v1/filters/public');
    expect(pub.body.data.some((f) => f.id === id)).toBe(true);

    await request(app)
      .delete(`/api/v1/filters/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    pub = await request(app).get('/api/v1/filters/public');
    expect(pub.body.data.some((f) => f.id === id)).toBe(false);

    const restored = await request(app)
      .post(`/api/v1/filters/${id}/restore`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(restored.status).toBe(200);
    expect(restored.body.data.deletedAt).toBeNull();
  });

  it('reorder and bulk status work for admin', async () => {
    const a = await request(app)
      .post('/api/v1/filters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'A Filter', displayOrder: 0 });
    const b = await request(app)
      .post('/api/v1/filters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'B Filter', displayOrder: 1 });

    const reorder = await request(app)
      .patch('/api/v1/filters/reorder')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { id: a.body.data.id, displayOrder: 5 },
          { id: b.body.data.id, displayOrder: 1 },
        ],
      });
    expect(reorder.status).toBe(200);

    const bulk = await request(app)
      .patch('/api/v1/filters/bulk/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ids: [a.body.data.id], isActive: false });
    expect(bulk.status).toBe(200);

    const getA = await request(app)
      .get(`/api/v1/filters/${a.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getA.body.data.isActive).toBe(false);
    expect(getA.body.data.displayOrder).toBe(5);
  });

  it('rejects duplicate slug', async () => {
    await request(app)
      .post('/api/v1/filters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Duration', slug: 'duration' });

    const dup = await request(app)
      .post('/api/v1/filters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Duration 2', slug: 'duration' });

    expect(dup.status).toBe(409);
  });
});
