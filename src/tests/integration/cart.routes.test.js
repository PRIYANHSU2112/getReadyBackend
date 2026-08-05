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
import { PackageModel } from '../../modules/package/package.model.js';
import { CartModel } from '../../modules/cart/cart.model.js';
import {
  UserRole,
  ServiceStatus,
  CartItemType,
  MemberRelationship,
  BookForOthersMode,
} from '../../common/constants/enums.js';
import { PackageStatus, PackageType } from '../../modules/package/package.enum.js';
import { MemoryCacheService } from '../memory-cache.js';

registerMongoHooks();

describe('Cart routes (integration)', () => {
  let app;
  let customerToken;
  let customerId;
  let serviceId;
  let packageId;
  let packageServiceId;

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

    const admin = await UserModel.create({
      name: 'Admin User',
      email: 'admin-cart@test.com',
      password: 'password123',
      role: UserRole.ADMIN,
    });

    const category = await CategoryModel.create({
      name: 'Facial',
      slug: 'facial',
      isActive: true,
    });

    const service = await ServiceModel.create({
      name: 'Classic facial',
      slug: 'classic-facial',
      categoryId: category._id,
      status: ServiceStatus.APPROVED,
      isActive: true,
      price: 999,
      discountedPrice: 899,
      homeVisitFee: 100,
      durationMinMinutes: 60,
      durationMaxMinutes: 90,
      badges: ['trending'],
      ratingAvg: 4.8,
      createdBy: admin._id,
    });
    serviceId = service._id.toString();

    const packService = await ServiceModel.create({
      name: 'Arms Waxing',
      slug: 'arms-waxing',
      categoryId: category._id,
      status: ServiceStatus.APPROVED,
      isActive: true,
      price: 400,
      durationMinMinutes: 60,
      createdBy: admin._id,
    });
    packageServiceId = packService._id.toString();

    const pkg = await PackageModel.create({
      name: 'Nail & Art Pack',
      slug: 'nail-art-pack',
      packageType: PackageType.FIXED,
      status: PackageStatus.APPROVED,
      isActive: true,
      price: 999,
      discountedPrice: 999,
      originalPrice: 1299,
      minSelectCount: 1,
      maxSelectCount: 1,
      categoryIds: [category._id],
      createdBy: admin._id,
      items: [
        {
          serviceId: packService._id,
          categoryId: category._id,
          isMandatory: true,
          isDefaultSelected: true,
          extraCharge: 0,
        },
      ],
      durationMinMinutes: 60,
      durationMaxMinutes: 90,
    });
    packageId = pkg._id.toString();
  });

  it('GET /api/v1/cart creates empty cart for user', async () => {
    const res = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe(customerId);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.pricing.grandTotal).toBe(0);

    const stored = await CartModel.findOne({ userId: customerId }).lean();
    expect(stored).toBeTruthy();
  });

  it('add service, update qty, toggle wallet, clear', async () => {
    const added = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        itemType: CartItemType.SERVICE,
        refId: serviceId,
        quantity: 1,
      });

    expect(added.status).toBe(200);
    expect(added.body.data.items).toHaveLength(1);
    expect(added.body.data.pricing.subtotal).toBe(899);
    expect(added.body.data.pricing.visitFee).toBe(100);
    expect(added.body.data.pricing.grandTotal).toBe(999);

    const lineId = added.body.data.items[0].id;

    const qty = await request(app)
      .patch(`/api/v1/cart/items/${lineId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ quantity: 2 });

    expect(qty.status).toBe(200);
    expect(qty.body.data.items[0].quantity).toBe(2);
    expect(qty.body.data.pricing.subtotal).toBe(1798);

    const benefits = await request(app)
      .patch('/api/v1/cart/benefits')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ useWallet: true });

    expect(benefits.status).toBe(200);
    expect(benefits.body.data.benefits.useWallet).toBe(true);
    // Stub wallet balance is 0
    expect(benefits.body.data.pricing.walletDeduction).toBe(0);

    const conflict = await request(app)
      .patch('/api/v1/cart/benefits')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ couponCode: 'FIRST100' });

    expect(conflict.status).toBe(409);

    const cleared = await request(app)
      .delete('/api/v1/cart')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(cleared.status).toBe(200);
    expect(cleared.body.data.items).toHaveLength(0);
  });

  it('adds package with default mandatory selection', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        itemType: CartItemType.PACKAGE,
        refId: packageId,
        quantity: 1,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].itemType).toBe(CartItemType.PACKAGE);
    expect(res.body.data.items[0].selectedServices[0].serviceId).toBe(packageServiceId);
    expect(res.body.data.pricing.subtotal).toBe(999);
  });

  it('requires auth', async () => {
    const res = await request(app).get('/api/v1/cart');
    expect(res.status).toBe(401);
  });

  it('accepts Swagger-style SERVICE body that includes selectedServiceIds (stripped)', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        itemType: CartItemType.SERVICE,
        refId: serviceId,
        quantity: 1,
        selectedServiceIds: [packageServiceId],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].itemType).toBe(CartItemType.SERVICE);
    expect(res.body.data.items[0].refId).toBe(serviceId);
  });

  it('rejects invalid refId placeholder used by Swagger defaults', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        itemType: CartItemType.SERVICE,
        refId: 'string',
        quantity: 1,
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('adds same service for Self and member as two lines; book-for-others clones Self', async () => {
    const memberRes = await request(app)
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        name: 'Navya Verma',
        relationship: MemberRelationship.SISTER,
      });
    expect(memberRes.status).toBe(201);
    const memberId = memberRes.body.data.id;

    const selfAdd = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        itemType: CartItemType.SERVICE,
        refId: serviceId,
        quantity: 1,
      });
    expect(selfAdd.status).toBe(200);
    expect(selfAdd.body.data.items).toHaveLength(1);
    expect(selfAdd.body.data.recipients[0].name).toBe('Self');

    const memberAdd = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        itemType: CartItemType.SERVICE,
        refId: serviceId,
        quantity: 1,
        forMemberId: memberId,
      });
    expect(memberAdd.status).toBe(200);
    expect(memberAdd.body.data.items).toHaveLength(2);
    expect(memberAdd.body.data.recipients).toHaveLength(2);

    await request(app)
      .delete('/api/v1/cart')
      .set('Authorization', `Bearer ${customerToken}`);

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        itemType: CartItemType.SERVICE,
        refId: serviceId,
        quantity: 1,
      });

    const cloned = await request(app)
      .post('/api/v1/cart/book-for-others')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        memberIds: [memberId],
        mode: BookForOthersMode.SAME_SERVICES,
      });

    expect(cloned.status).toBe(200);
    expect(cloned.body.data.items).toHaveLength(2);
    expect(cloned.body.data.pricing.subtotal).toBe(1798);

    const lineId = cloned.body.data.items.find((i) => i.forMemberId === memberId).id;
    const reassigned = await request(app)
      .patch(`/api/v1/cart/items/${lineId}/recipient`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ forMemberId: null });

    expect(reassigned.status).toBe(200);
    // merges into Self line
    expect(reassigned.body.data.items).toHaveLength(1);
    expect(reassigned.body.data.items[0].quantity).toBe(2);
  });

  it('rejects book-for-others when Self cart is empty', async () => {
    const memberRes = await request(app)
      .post('/api/v1/members')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        name: 'Shivani Verma',
        relationship: MemberRelationship.MOTHER,
      });

    const res = await request(app)
      .post('/api/v1/cart/book-for-others')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ memberIds: [memberRes.body.data.id] });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CART_NO_SELF_ITEMS');
  });

  it('rejects invalid forMemberId on add', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        itemType: CartItemType.SERVICE,
        refId: serviceId,
        quantity: 1,
        forMemberId: '64f0c2a1b4e1c2d3e4f50999',
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MEMBER_NOT_FOUND');
  });
});
