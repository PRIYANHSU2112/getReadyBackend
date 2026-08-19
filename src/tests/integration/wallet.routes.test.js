import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { registerMongoHooks } from '../mongo.js';
import { createApp } from '../../app.js';
import { createShared } from '../../core/shared.js';
import { EventBus } from '../../core/events/EventBus.js';
import { JwtUtil } from '../../common/utils/jwt.util.js';
import { UserModel } from '../../modules/user/user.model.js';
import { WalletModel, WalletTransactionModel } from '../../modules/wallet/wallet.model.js';
import { UserRole } from '../../common/constants/enums.js';
import { MemoryCacheService } from '../memory-cache.js';

registerMongoHooks();

describe('Wallet routes (integration)', () => {
  let app;
  let customerToken;
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
      name: 'Wallet User',
      phone: '+919877700001',
      role: UserRole.CUSTOMER,
    });
    customerId = customer._id.toString();
    customerToken = jwt.sign({
      sub: customerId,
      role: customer.role,
      name: customer.name,
    });
  });

  it('GET /api/v1/wallets/me returns default wallet for user', async () => {
    const res = await request(app)
      .get('/api/v1/wallets/me')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(0);
    expect(res.body.data.points).toBe(0);
  });

  it('POST /api/v1/wallets/topup/create-order creates topup order and verify credits balance', async () => {
    const createRes = await request(app)
      .post('/api/v1/wallets/topup/create-order')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ amount: 500 });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.orderId).toBeTruthy();

    const orderId = createRes.body.data.orderId;

    const verifyRes = await request(app)
      .post('/api/v1/wallets/topup/verify')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        razorpayOrderId: orderId,
        razorpayPaymentId: 'pay_test_123',
        razorpaySignature: 'mock_sig',
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.wallet.balance).toBe(500);

    const txRes = await request(app)
      .get('/api/v1/wallets/transactions')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(txRes.status).toBe(200);
    expect(txRes.body.data).toHaveLength(1);
    expect(txRes.body.data[0].amount).toBe(500);
  });

  it('POST /api/v1/wallets/points/add and deduct works', async () => {
    const addRes = await request(app)
      .post('/api/v1/wallets/points/add')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ points: 200, description: 'Signup reward points' });

    expect(addRes.status).toBe(200);
    expect(addRes.body.data.wallet.points).toBe(200);

    const deductRes = await request(app)
      .post('/api/v1/wallets/points/deduct')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ points: 50, description: 'Spent points' });

    expect(deductRes.status).toBe(200);
    expect(deductRes.body.data.wallet.points).toBe(150);
  });

  it('requires auth', async () => {
    const res = await request(app).get('/api/v1/wallets/me');
    expect(res.status).toBe(401);
  });
});
