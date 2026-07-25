import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { registerMongoHooks } from '../mongo.js';
import { createApp } from '../../app.js';
import { createShared } from '../../core/shared.js';
import { EventBus } from '../../core/events/EventBus.js';
import { JwtUtil } from '../../common/utils/jwt.util.js';
import { UserModel } from '../../modules/user/user.model.js';
import { AddressModel } from '../../modules/address/address.model.js';
import { UserRole, AddressLabel } from '../../common/constants/enums.js';
import { DEFAULT_COUNTRY } from '../../common/constants/address.js';
import { MemoryCacheService } from '../memory-cache.js';

registerMongoHooks();

const addressPayload = {
  label: AddressLabel.HOME,
  fullName: 'Priya Sharma',
  phone: '+919876543210',
  line1: '12 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001',
  country: DEFAULT_COUNTRY,
};

describe('Address routes (integration)', () => {
  let app;
  let customerToken;
  let otherToken;
  let customerId;

  beforeEach(async () => {
    const jwt = new JwtUtil('test-jwt-secret-min-16-chars', '1h');
    const shared = createShared({
      skipRedis: true,
      eventBus: new EventBus(),
      jwtUtil: jwt,
      cacheService: new MemoryCacheService(),
    });
    app = createApp({ shared });

    const customer = await UserModel.create({
      name: 'Customer One',
      phone: '+919811100001',
      role: UserRole.CUSTOMER,
    });
    customerId = customer._id.toString();

    const other = await UserModel.create({
      name: 'Customer Two',
      phone: '+919811100002',
      role: UserRole.CUSTOMER,
    });

    customerToken = jwt.sign({
      sub: customerId,
      role: UserRole.CUSTOMER,
      phone: '+919811100001',
    });
    otherToken = jwt.sign({
      sub: other._id.toString(),
      role: UserRole.CUSTOMER,
      phone: '+919811100002',
    });
  });

  it('POST /api/v1/addresses creates address as default when first', async () => {
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(addressPayload);

    expect(res.status).toBe(201);
    expect(res.body.data.isDefault).toBe(true);
    expect(res.body.data.userId).toBe(customerId);
    expect(res.body.data.city).toBe('Bengaluru');
  });

  it('GET /api/v1/addresses lists only own addresses with meta', async () => {
    await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(addressPayload);

    await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ ...addressPayload, fullName: 'Other User', phone: '+919811100002' });

    const res = await request(app)
      .get('/api/v1/addresses')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].fullName).toBe('Priya Sharma');
  });

  it('forbids access to another users address', async () => {
    const created = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(addressPayload);

    const id = created.body.data.id;

    const res = await request(app)
      .get(`/api/v1/addresses/${id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });

  it('PUT /api/v1/addresses/:id/default switches default', async () => {
    const first = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(addressPayload);

    const second = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        ...addressPayload,
        label: 'WORK',
        line1: '99 Work Street',
        isDefault: false,
      });

    const res = await request(app)
      .put(`/api/v1/addresses/${second.body.data.id}/default`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isDefault).toBe(true);

    const firstDoc = await AddressModel.findById(first.body.data.id).lean();
    expect(firstDoc.isDefault).toBe(false);
  });

  it('DELETE soft-deletes and promotes newest as default', async () => {
    const first = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(addressPayload);

    const second = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        ...addressPayload,
        label: 'WORK',
        line1: '99 Work Street',
        isDefault: false,
      });

    const del = await request(app)
      .delete(`/api/v1/addresses/${first.body.data.id}`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(del.status).toBe(204);

    const promoted = await AddressModel.findById(second.body.data.id).lean();
    expect(promoted.isDefault).toBe(true);
    expect(promoted.deletedAt).toBeNull();

    const deleted = await AddressModel.findById(first.body.data.id).lean();
    expect(deleted.deletedAt).toBeTruthy();
  });

  it('requires auth', async () => {
    const res = await request(app).get('/api/v1/addresses');
    expect(res.status).toBe(401);
  });
});
