import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { registerMongoHooks } from '../mongo.js';
import { createApp } from '../../app.js';
import { createShared } from '../../core/shared.js';
import { EventBus } from '../../core/events/EventBus.js';
import { JwtUtil } from '../../common/utils/jwt.util.js';
import { UserModel } from '../../modules/user/user.model.js';
import { SlotModel } from '../../modules/slot/slot.model.js';
import { MemorySlotInventory } from '../../modules/slot/slot.inventory.js';
import { UserRole, SlotAvailability, SlotStatus } from '../../common/constants/enums.js';
import { MemoryCacheService } from '../memory-cache.js';
import { seedRbacForTests } from '../rbac-seed.js';

registerMongoHooks();

function futureIso(hoursFromNow = 24) {
  return new Date(Date.now() + hoursFromNow * 3600 * 1000).toISOString();
}

describe('Slot routes (integration)', () => {
  let app;
  let adminToken;
  let customerToken;

  beforeEach(async () => {
    await seedRbacForTests();
    const jwt = new JwtUtil('test-jwt-secret-min-16-chars', '1h');
    const shared = createShared({
      skipRedis: true,
      eventBus: new EventBus(),
      jwtUtil: jwt,
      cacheService: new MemoryCacheService(),
      slotInventory: new MemorySlotInventory(600),
    });
    app = createApp({ shared });

    const admin = await UserModel.create({
      name: 'Slot Admin',
      email: 'slot-admin@test.com',
      password: 'password123',
      role: UserRole.ADMIN,
    });
    adminToken = jwt.sign({
      sub: admin._id.toString(),
      role: UserRole.ADMIN,
      email: 'slot-admin@test.com',
    });

    const customer = await UserModel.create({
      name: 'Slot Customer',
      phone: '+919811100101',
      role: UserRole.CUSTOMER,
    });
    customerToken = jwt.sign({
      sub: customer._id.toString(),
      role: UserRole.CUSTOMER,
      phone: '+919811100101',
    });
  });

  async function createSlot(overrides = {}) {
    const startAt = overrides.startAt || futureIso(24);
    const endAt = overrides.endAt || futureIso(25);
    const res = await request(app)
      .post('/api/v1/slots')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        date: overrides.date || '2026-08-10',
        startAt,
        endAt,
        minBookings: 1,
        maxBookings: overrides.maxBookings ?? 1,
        ...overrides,
        startAt,
        endAt,
      });
    expect(res.status).toBe(201);
    return res.body.data;
  }

  it('admin creates slot and public available lists it', async () => {
    const slot = await createSlot();
    const avail = await request(app).get('/api/v1/slots/available').query({ date: '2026-08-10' });
    expect(avail.status).toBe(200);
    expect(avail.body.data.length).toBe(1);
    expect(avail.body.data[0].id).toBe(slot.id);
    expect(avail.body.data[0].availability).toBe(SlotAvailability.AVAILABLE);
    expect(avail.body.data[0].remaining).toBe(1);
  });

  it('rejects available without date', async () => {
    const avail = await request(app).get('/api/v1/slots/available');
    expect(avail.status).toBe(422);
  });

  it('hold/release HTTP APIs are removed', async () => {
    const slot = await createSlot();
    const hold = await request(app)
      .post(`/api/v1/slots/${slot.id}/hold`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ partySize: 1 });
    // :id/hold is not a registered route; falls through to 404 (or 403 if matched oddly)
    expect([404, 403, 405]).toContain(hold.status);

    const release = await request(app)
      .delete('/api/v1/slots/holds/abcdef0123456789abcdef01')
      .set('Authorization', `Bearer ${customerToken}`);
    expect([404, 403, 405]).toContain(release.status);
  });

  it('admin soft-cancels slot', async () => {
    const slot = await createSlot();
    const removed = await request(app)
      .delete(`/api/v1/slots/${slot.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(removed.status).toBe(200);
    expect(removed.body.data.status).toBe(SlotStatus.CANCELLED);

    const avail = await request(app).get('/api/v1/slots/available').query({ date: '2026-08-10' });
    expect(avail.body.data.length).toBe(0);

    const db = await SlotModel.findById(slot.id).lean();
    expect(db.status).toBe(SlotStatus.CANCELLED);
  });

  it('admin bulk create', async () => {
    const res = await request(app)
      .post('/api/v1/slots/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        slots: [
          {
            date: '2026-08-12',
            startAt: futureIso(40),
            endAt: futureIso(41),
            minBookings: 1,
            maxBookings: 1,
          },
          {
            date: '2026-08-12',
            startAt: futureIso(42),
            endAt: futureIso(43),
            minBookings: 1,
            maxBookings: 2,
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(2);

    const avail = await request(app).get('/api/v1/slots/available').query({ date: '2026-08-12' });
    expect(avail.body.data).toHaveLength(2);
  });

  it('customer cannot create slots', async () => {
    const res = await request(app)
      .post('/api/v1/slots')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        date: '2026-08-10',
        startAt: futureIso(24),
        endAt: futureIso(25),
      });
    expect(res.status).toBe(403);
  });
});
