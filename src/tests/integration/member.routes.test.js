import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { registerMongoHooks } from '../mongo.js';
import { createApp } from '../../app.js';
import { createShared } from '../../core/shared.js';
import { EventBus } from '../../core/events/EventBus.js';
import { JwtUtil } from '../../common/utils/jwt.util.js';
import { UserModel } from '../../modules/user/user.model.js';
import { MemberModel } from '../../modules/member/member.model.js';
import {
  UserRole,
  MemberRelationship,
  MemberSkinType,
} from '../../common/constants/enums.js';
import { MAX_MEMBERS_PER_USER } from '../../common/constants/member.js';
import { MemoryCacheService } from '../memory-cache.js';

registerMongoHooks();

describe('Member routes (integration)', () => {
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
    customerToken = jwt.sign({
      sub: customerId,
      role: UserRole.CUSTOMER,
      phone: '+919811100001',
    });

    const other = await UserModel.create({
      name: 'Customer Two',
      phone: '+919811100002',
      role: UserRole.CUSTOMER,
    });
    otherToken = jwt.sign({
      sub: other._id.toString(),
      role: UserRole.CUSTOMER,
      phone: '+919811100002',
    });
  });

  it('creates and lists own members', async () => {
    const created = await request(app)
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        name: 'Navya Verma',
        relationship: MemberRelationship.SISTER,
        age: 28,
        phone: '+919876543210',
        skinType: MemberSkinType.DRY,
        medicalNotes: 'Sensitive to fragrance',
      });

    expect(created.status).toBe(201);
    expect(created.body.data.name).toBe('Navya Verma');
    expect(created.body.data.userId).toBe(customerId);
    expect(created.body.data.autoShareLocationOnSos).toBeUndefined();

    await request(app)
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        name: 'Other Member',
        relationship: MemberRelationship.FRIEND,
      });

    const list = await request(app)
      .get('/api/v1/members')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].name).toBe('Navya Verma');
  });

  it('enforces member limit', async () => {
    for (let i = 0; i < MAX_MEMBERS_PER_USER; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await MemberModel.create({
        userId: customerId,
        name: `Member ${i}`,
        relationship: MemberRelationship.FRIEND,
      });
    }

    const res = await request(app)
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        name: 'Overflow',
        relationship: MemberRelationship.OTHER,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MEMBER_LIMIT');
  });

  it('soft-deletes member', async () => {
    const created = await request(app)
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        name: 'Shivani Verma',
        relationship: MemberRelationship.MOTHER,
      });

    const id = created.body.data.id;
    const del = await request(app)
      .delete(`/api/v1/members/${id}`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(del.status).toBe(204);

    const list = await request(app)
      .get('/api/v1/members')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(list.body.data).toHaveLength(0);
  });
});
