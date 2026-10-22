import assert from 'assert';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import {
  PROMOTION_SCOPE,
  PROMOTION_BENEFIT_TYPE,
  PROMOTION_STATUS,
  PROMOTION_STACKING_RULE,
  BOGO_PRICING_RULE,
  RESERVATION_STATUS,
  REDEMPTION_STATUS,
} from '../services/catalog-service/src/models/index.js';
import { PromotionService } from '../services/catalog-service/src/services/promotion.service.js';
import { AppError, HttpStatus, ErrorCodes } from '@getready/errors';

console.log('🚀 Starting Promotion & Offer Engine Production Test Suite...\n');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
    failed++;
  }
}

/**
 * High-fidelity in-memory Promotion Repository
 * Emulates MongoDB document-level write locks, $expr conditional updates, and indexes
 */
class InMemoryPromotionRepository {
  constructor() {
    this.promotions = new Map();
    this.reservations = new Map();
    this.redemptions = new Map();
    this.cache = new Map();
  }

  async findActiveByCode(code) {
    if (!code) return null;
    const cleanCode = String(code).trim().toUpperCase();
    if (this.cache.has(`promo:code:${cleanCode}`)) {
      return this.cache.get(`promo:code:${cleanCode}`);
    }

    const now = new Date();
    for (const promo of this.promotions.values()) {
      if (
        promo.code === cleanCode &&
        promo.status === PROMOTION_STATUS.ACTIVE &&
        !promo.deletedAt &&
        new Date(promo.validFrom) <= now &&
        new Date(promo.validTo) >= now
      ) {
        this.cache.set(`promo:code:${cleanCode}`, promo);
        return promo;
      }
    }
    return null;
  }

  async countUserClaims({ promotionId, userId, userPhone }) {
    const now = new Date();
    let count = 0;

    // Active reservations
    for (const res of this.reservations.values()) {
      if (
        String(res.promotionId) === String(promotionId) &&
        res.status === RESERVATION_STATUS.RESERVED &&
        new Date(res.expiresAt) > now
      ) {
        if ((userId && res.userId === String(userId)) || (userPhone && res.userPhone === String(userPhone))) {
          count++;
        }
      }
    }

    // Completed redemptions
    for (const red of this.redemptions.values()) {
      if (
        String(red.promotionId) === String(promotionId) &&
        red.status === REDEMPTION_STATUS.REDEEMED
      ) {
        if ((userId && red.userId === String(userId)) || (userPhone && red.userPhone === String(userPhone))) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Emulates MongoDB atomic findOneAndUpdate with $expr: (usedCount + reservedCount) < usageLimit
   */
  async atomicReserve({
    promotionId,
    code,
    userId,
    userPhone = null,
    orderId = null,
    cartId = null,
    scope,
    benefitType,
    discountAmount = 0,
    bonusCoins = 0,
    qualifyingItems = [],
    freeItems = [],
    idempotencyKey = null,
    metadata = {},
    ttlMinutes = 15,
  }) {
    const cleanCode = String(code).trim().toUpperCase();

    // 1. Idempotency check
    if (idempotencyKey) {
      for (const existing of this.reservations.values()) {
        if (
          String(existing.promotionId) === String(promotionId) &&
          existing.idempotencyKey === idempotencyKey
        ) {
          return { reservation: existing, isDuplicate: true };
        }
      }
    }

    // 2. Per-user limit check
    const promo = this.promotions.get(String(promotionId));
    if (!promo || promo.status !== PROMOTION_STATUS.ACTIVE || promo.deletedAt) {
      throw new AppError('Promotion is not active or available', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const perUserLimit = promo.perUserLimit || 1;
    const claims = await this.countUserClaims({ promotionId, userId, userPhone });
    if (claims >= perUserLimit) {
      throw new AppError(
        `You have reached the maximum claim limit (${perUserLimit}) for offer ${cleanCode}`,
        HttpStatus.CONFLICT,
        ErrorCodes.CONFLICT,
      );
    }

    // 3. Atomic document-level conditional increment
    // Single-thread JavaScript event loop naturally provides atomic write guarantee
    if (promo.usedCount + promo.reservedCount >= promo.usageLimit) {
      throw new AppError('Offer capacity has been completely exhausted', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
    }

    // Emulate MongoDB partial unique index: { promotionId: 1, userId: 1 }, partialFilterExpression: { status: 'RESERVED' }
    for (const existing of this.reservations.values()) {
      if (
        String(existing.promotionId) === String(promotionId) &&
        existing.status === RESERVATION_STATUS.RESERVED &&
        new Date(existing.expiresAt) > new Date()
      ) {
        if ((userId && existing.userId === String(userId)) || (userPhone && existing.userPhone === String(userPhone))) {
          throw new AppError(
            `You already have an active in-flight reservation for offer ${cleanCode}`,
            HttpStatus.CONFLICT,
            ErrorCodes.CONFLICT,
          );
        }
      }
    }

    promo.reservedCount += 1;

    // 4. Create Reservation
    const reservationId = `res_${randomUUID().replace(/-/g, '')}`;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const reservation = {
      reservationId,
      promotionId,
      promotionCode: cleanCode,
      userId: String(userId),
      userPhone: userPhone ? String(userPhone) : null,
      orderId: orderId ? String(orderId) : null,
      cartId: cartId ? String(cartId) : null,
      scope,
      benefitType,
      discountAmount,
      bonusCoins,
      qualifyingItems,
      freeItems,
      status: RESERVATION_STATUS.RESERVED,
      expiresAt,
      idempotencyKey: idempotencyKey || null,
      metadata,
    };

    this.reservations.set(reservationId, reservation);
    this.cache.delete(`promo:code:${cleanCode}`);

    return { reservation, isDuplicate: false, updatedPromo: promo };
  }

  async atomicConfirm({ reservationId, orderId }) {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      throw new AppError('Promotion reservation not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    // Idempotent retry check
    if (reservation.status === RESERVATION_STATUS.CONFIRMED) {
      for (const red of this.redemptions.values()) {
        if (red.reservationId === reservationId) {
          return { confirmed: true, isDuplicate: true, reservation, redemption: red };
        }
      }
    }

    if (reservation.status === RESERVATION_STATUS.RELEASED) {
      throw new AppError('Reservation has already been released', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    if (reservation.status === RESERVATION_STATUS.EXPIRED || new Date() > new Date(reservation.expiresAt)) {
      throw new AppError('Promotion reservation has expired', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Shift counters
    const promo = this.promotions.get(String(reservation.promotionId));
    if (promo) {
      if (promo.reservedCount > 0) promo.reservedCount -= 1;
      promo.usedCount += 1;
    }

    reservation.status = RESERVATION_STATUS.CONFIRMED;
    if (orderId) reservation.orderId = String(orderId);

    const redemptionId = `red_${randomUUID().replace(/-/g, '')}`;
    const redemption = {
      redemptionId,
      reservationId: reservation.reservationId,
      promotionId: reservation.promotionId,
      promotionCode: reservation.promotionCode,
      userId: reservation.userId,
      userPhone: reservation.userPhone,
      orderId: String(orderId || reservation.orderId || 'ORDER_UNKNOWN'),
      scope: reservation.scope,
      benefitType: reservation.benefitType,
      discountAmount: reservation.discountAmount,
      bonusCoins: reservation.bonusCoins,
      status: REDEMPTION_STATUS.REDEEMED,
      redeemedAt: new Date(),
    };

    this.redemptions.set(redemptionId, redemption);
    return { confirmed: true, isDuplicate: false, reservation, redemption };
  }

  async atomicRelease({ reservationId, reason = 'Checkout cancelled' }) {
    const reservation = this.reservations.get(reservationId);
    if (!reservation) {
      return { released: false, message: 'Reservation not found' };
    }

    if (reservation.status === RESERVATION_STATUS.RELEASED) {
      return { released: true, isDuplicate: true, reservation };
    }

    reservation.status = RESERVATION_STATUS.RELEASED;
    const promo = this.promotions.get(String(reservation.promotionId));
    if (promo && promo.reservedCount > 0) {
      promo.reservedCount -= 1;
    }

    return { released: true, reservation };
  }

  async atomicRefund({ redemptionId, orderId, reason }) {
    let redemption = null;
    for (const r of this.redemptions.values()) {
      if ((redemptionId && r.redemptionId === redemptionId) || (orderId && r.orderId === String(orderId))) {
        if (r.status === REDEMPTION_STATUS.REDEEMED) {
          redemption = r;
          break;
        }
      }
    }

    if (!redemption) {
      return { refunded: false, message: 'Active redemption not found' };
    }

    redemption.status = REDEMPTION_STATUS.REFUNDED;
    const promo = this.promotions.get(String(redemption.promotionId));
    if (promo && promo.usedCount > 0) {
      promo.usedCount -= 1;
    }

    return { refunded: true, redemption };
  }

  async sweepExpiredReservations() {
    const now = new Date();
    let swept = 0;
    for (const res of this.reservations.values()) {
      if (res.status === RESERVATION_STATUS.RESERVED && new Date(res.expiresAt) < now) {
        res.status = RESERVATION_STATUS.EXPIRED;
        const promo = this.promotions.get(String(res.promotionId));
        if (promo && promo.reservedCount > 0) {
          promo.reservedCount -= 1;
        }
        swept++;
      }
    }
    return swept;
  }
}

async function run() {
  const repo = new InMemoryPromotionRepository();
  const service = new PromotionService(repo, null);

  // Mock catalog authoritative price resolver
  service.resolveAuthoritativeItems = async (items = []) => {
    const priceCatalog = {
      svc_hair_spa: { name: 'Hair Spa', price: 800 },
      svc_cleanup: { name: 'Fruit Cleanup', price: 600 },
      svc_pedicure: { name: 'Pedicure', price: 400 },
      svc_threading: { name: 'Threading', price: 200 },
      svc_facial: { name: 'Facial Deluxe', price: 1200 },
    };

    return items.map((item) => {
      const id = item.serviceId || item.id;
      const cat = priceCatalog[id] || { name: item.name || 'Service', price: Number(item.price || 0) };
      return {
        id,
        serviceId: id,
        name: cat.name,
        price: cat.price,
        unitPrice: cat.price,
        quantity: Math.max(1, Number(item.quantity) || 1),
      };
    });
  };

  // -------------------------------------------------------------
  // Test 1: Concurrency - 20 Simultaneous Claims on Limit of 5
  // -------------------------------------------------------------
  await test('Concurrency: Global limit of 5 allows exactly 5 claims under 20 simultaneous requests', async () => {
    const promoId = 'promo_flash_5';
    repo.promotions.set(promoId, {
      _id: promoId,
      code: 'FLASH5',
      name: 'Flash Sale 5 Spots',
      scope: PROMOTION_SCOPE.CART,
      benefitType: PROMOTION_BENEFIT_TYPE.FLAT,
      discountValue: 100,
      usageLimit: 5,
      usedCount: 0,
      reservedCount: 0,
      perUserLimit: 10,
      status: PROMOTION_STATUS.ACTIVE,
      validFrom: new Date(Date.now() - 10000),
      validTo: new Date(Date.now() + 100000),
    });

    // 20 concurrent reservation calls
    const requests = Array.from({ length: 20 }, (_, i) =>
      service.createReservation({
        code: 'FLASH5',
        scope: PROMOTION_SCOPE.CART,
        userId: `user_concurrency_${i}`,
        cartAmount: 500,
      }).then(
        (res) => ({ success: true, res }),
        (err) => ({ success: false, error: err.message }),
      )
    );

    const results = await Promise.all(requests);
    const successCount = results.filter((r) => r.success).length;
    const rejectedCount = results.filter((r) => !r.success).length;

    assert.strictEqual(successCount, 5, `Expected exactly 5 claims to succeed, got ${successCount}`);
    assert.strictEqual(rejectedCount, 15, `Expected exactly 15 claims to be rejected, got ${rejectedCount}`);

    const promo = repo.promotions.get(promoId);
    assert.strictEqual(promo.reservedCount, 5, `Expected reservedCount = 5`);
    assert.strictEqual(promo.usedCount, 0, `Expected usedCount = 0`);
  });

  // -------------------------------------------------------------
  // Test 2: Per-User Limit - Duplicate Concurrent Claims Rejected
  // -------------------------------------------------------------
  await test('Per-user limit of 1 rejects concurrent duplicate claims from same customer', async () => {
    const promoId = 'promo_per_user';
    repo.promotions.set(promoId, {
      _id: promoId,
      code: 'SINGLEUSER',
      name: 'One per customer',
      scope: PROMOTION_SCOPE.CART,
      benefitType: PROMOTION_BENEFIT_TYPE.FLAT,
      discountValue: 50,
      usageLimit: 100,
      usedCount: 0,
      reservedCount: 0,
      perUserLimit: 1,
      status: PROMOTION_STATUS.ACTIVE,
      validFrom: new Date(Date.now() - 10000),
      validTo: new Date(Date.now() + 100000),
    });

    const requests = Array.from({ length: 5 }, () =>
      service.createReservation({
        code: 'SINGLEUSER',
        scope: PROMOTION_SCOPE.CART,
        userId: 'customer_vip_001',
        cartAmount: 300,
      }).then(
        (res) => ({ success: true, res }),
        (err) => ({ success: false, error: err.message }),
      )
    );

    const results = await Promise.all(requests);
    const successCount = results.filter((r) => r.success).length;
    const conflictCount = results.filter(
      (r) => !r.success && (r.error.includes('maximum claim limit') || r.error.includes('active in-flight reservation')),
    ).length;

    assert.strictEqual(successCount, 1, `Expected 1 success, got ${successCount}`);
    assert.strictEqual(conflictCount, 4, `Expected 4 conflicts, got ${conflictCount}`);
  });

  // -------------------------------------------------------------
  // Test 3: Launch Offer Specific Business Rules
  // -------------------------------------------------------------
  await test('Launch Offer: 4 services required, 2 lowest priced free, 1 per phone, booking scope', async () => {
    const promoId = 'promo_launch_2026';
    repo.promotions.set(promoId, {
      _id: promoId,
      code: 'LAUNCH2026',
      name: 'Launch Offer - Buy 4 Get 2 Free',
      scope: PROMOTION_SCOPE.SERVICE,
      benefitType: PROMOTION_BENEFIT_TYPE.BUY_X_GET_Y,
      isLaunchOffer: true,
      bogoConfig: {
        qualifyingQuantity: 4,
        freeQuantity: 2,
        freeItemPricingRule: BOGO_PRICING_RULE.LOWEST_PRICED,
      },
      usageLimit: 1000,
      usedCount: 0,
      reservedCount: 0,
      perUserLimit: 1,
      status: PROMOTION_STATUS.ACTIVE,
      validFrom: new Date(Date.now() - 10000),
      validTo: new Date(Date.now() + 100000),
    });

    // 3A: Rejects if less than 4 services
    await assert.rejects(
      async () => {
        await service.quoteOffer({
          code: 'LAUNCH2026',
          scope: PROMOTION_SCOPE.SERVICE,
          userId: 'cust_l1',
          userPhone: '9876543210',
          items: [
            { serviceId: 'svc_hair_spa', quantity: 1 },
            { serviceId: 'svc_cleanup', quantity: 1 },
            { serviceId: 'svc_pedicure', quantity: 1 }, // Only 3 items!
          ],
        });
      },
      (err) => {
        assert(err.message.includes('requires at least 4 eligible services'));
        return true;
      }
    );

    // 3B: Correct 2 lowest priced items free for 4 services
    // Prices: Hair Spa (₹800), Cleanup (₹600), Pedicure (₹400), Threading (₹200)
    // Lowest 2: Pedicure (₹400) + Threading (₹200) = ₹600 Free!
    const quote = await service.quoteOffer({
      code: 'LAUNCH2026',
      scope: PROMOTION_SCOPE.SERVICE,
      userId: 'cust_l1',
      userPhone: '9876543210',
      items: [
        { serviceId: 'svc_hair_spa', quantity: 1 },
        { serviceId: 'svc_cleanup', quantity: 1 },
        { serviceId: 'svc_pedicure', quantity: 1 },
        { serviceId: 'svc_threading', quantity: 1 },
      ],
      cartAmount: 2000,
    });

    assert.strictEqual(quote.discountAmount, 600, 'Discount must be ₹600 (sum of lowest 2)');
    assert.strictEqual(quote.freeItems.length, 2, 'Must have 2 free items');
    assert.strictEqual(quote.netPayable, 1400, 'Net payable must be ₹1400');

    // 3C: Single redemption per registered mobile number
    const res = await service.createReservation({
      code: 'LAUNCH2026',
      scope: PROMOTION_SCOPE.SERVICE,
      userId: 'cust_l1',
      userPhone: '9876543210',
      items: [
        { serviceId: 'svc_hair_spa', quantity: 1 },
        { serviceId: 'svc_cleanup', quantity: 1 },
        { serviceId: 'svc_pedicure', quantity: 1 },
        { serviceId: 'svc_threading', quantity: 1 },
      ],
      cartAmount: 2000,
    });

    await service.confirmReservation({ reservationId: res.reservationId, orderId: 'bkg_l1' });

    // Different user, same mobile phone must be rejected
    await assert.rejects(
      async () => {
        await service.quoteOffer({
          code: 'LAUNCH2026',
          scope: PROMOTION_SCOPE.SERVICE,
          userId: 'DIFFERENT_CUSTOMER_ID',
          userPhone: '9876543210', // Same phone!
          items: [
            { serviceId: 'svc_hair_spa', quantity: 1 },
            { serviceId: 'svc_cleanup', quantity: 1 },
            { serviceId: 'svc_pedicure', quantity: 1 },
            { serviceId: 'svc_threading', quantity: 1 },
          ],
        });
      },
      (err) => {
        assert(err.message.includes('already redeemed'));
        return true;
      }
    );
  });

  // -------------------------------------------------------------
  // Test 4: Generic BOGO (Buy 1 Get 1 & Buy 1 Get 2)
  // -------------------------------------------------------------
  await test('BOGO Buy 1 Get 1 & Buy 1 Get 2 discount calculation', async () => {
    // Buy 1 Get 1
    repo.promotions.set('promo_b1g1', {
      _id: 'promo_b1g1',
      code: 'B1G1',
      name: 'Buy 1 Get 1',
      scope: PROMOTION_SCOPE.SERVICE,
      benefitType: PROMOTION_BENEFIT_TYPE.BUY_X_GET_Y,
      bogoConfig: {
        qualifyingQuantity: 1,
        freeQuantity: 1,
        freeItemPricingRule: BOGO_PRICING_RULE.LOWEST_PRICED,
      },
      status: PROMOTION_STATUS.ACTIVE,
      validFrom: new Date(Date.now() - 10000),
      validTo: new Date(Date.now() + 100000),
      usageLimit: 1000,
    });

    const quoteB1G1 = await service.quoteOffer({
      code: 'B1G1',
      scope: PROMOTION_SCOPE.SERVICE,
      userId: 'u_b1g1',
      items: [
        { serviceId: 'svc_hair_spa', quantity: 1 }, // ₹800
        { serviceId: 'svc_cleanup', quantity: 1 },  // ₹600 (Free)
      ],
      cartAmount: 1400,
    });
    assert.strictEqual(quoteB1G1.discountAmount, 600, 'Lowest item ₹600 is free');
    assert.strictEqual(quoteB1G1.netPayable, 800, 'Payable is ₹800');

    // Buy 1 Get 2
    repo.promotions.set('promo_b1g2', {
      _id: 'promo_b1g2',
      code: 'B1G2',
      name: 'Buy 1 Get 2',
      scope: PROMOTION_SCOPE.SERVICE,
      benefitType: PROMOTION_BENEFIT_TYPE.BUY_X_GET_Y,
      bogoConfig: {
        qualifyingQuantity: 1,
        freeQuantity: 2,
        freeItemPricingRule: BOGO_PRICING_RULE.LOWEST_PRICED,
      },
      status: PROMOTION_STATUS.ACTIVE,
      validFrom: new Date(Date.now() - 10000),
      validTo: new Date(Date.now() + 100000),
      usageLimit: 1000,
    });

    const quoteB1G2 = await service.quoteOffer({
      code: 'B1G2',
      scope: PROMOTION_SCOPE.SERVICE,
      userId: 'u_b1g2',
      items: [
        { serviceId: 'svc_hair_spa', quantity: 1 },   // ₹800
        { serviceId: 'svc_cleanup', quantity: 1 },    // ₹600 (Free)
        { serviceId: 'svc_threading', quantity: 1 },  // ₹200 (Free)
      ],
      cartAmount: 1600,
    });
    assert.strictEqual(quoteB1G2.discountAmount, 800, '2 lowest items (₹600 + ₹200 = ₹800) free');
    assert.strictEqual(quoteB1G2.netPayable, 800, 'Payable is ₹800');
  });

  // -------------------------------------------------------------
  // Test 5: Wallet Coin Purchase Bonus
  // -------------------------------------------------------------
  await test('Wallet Purchase Offer: Calculates bonus coins for eligible coin packs', async () => {
    repo.promotions.set('promo_wallet', {
      _id: 'promo_wallet',
      code: 'COINBONUS100',
      name: 'Bonus Coins on Topup',
      scope: PROMOTION_SCOPE.WALLET_PURCHASE,
      benefitType: PROMOTION_BENEFIT_TYPE.BONUS_COINS,
      eligibility: {
        eligibleCoinPacks: [
          { packId: 'pack_500', minAmount: 500, bonusCoins: 100 },
          { packId: 'pack_1000', minAmount: 1000, bonusCoins: 250 },
        ],
      },
      status: PROMOTION_STATUS.ACTIVE,
      validFrom: new Date(Date.now() - 10000),
      validTo: new Date(Date.now() + 100000),
      usageLimit: 1000,
    });

    const quote = await service.quoteOffer({
      code: 'COINBONUS100',
      scope: PROMOTION_SCOPE.WALLET_PURCHASE,
      userId: 'u_wallet',
      coinPackId: 'pack_500',
      cartAmount: 500,
    });
    assert.strictEqual(quote.bonusCoins, 100, 'Expected 100 bonus coins');
  });

  // -------------------------------------------------------------
  // Test 6: Reservation Lifecycle State Transitions & Idempotency
  // -------------------------------------------------------------
  await test('Lifecycle: RESERVED -> CONFIRMED -> REDEEMED with duplicate confirmation safety', async () => {
    const promoId = 'promo_lifecycle';
    repo.promotions.set(promoId, {
      _id: promoId,
      code: 'LIFECYCLE',
      name: 'Lifecycle Test',
      scope: PROMOTION_SCOPE.CART,
      benefitType: PROMOTION_BENEFIT_TYPE.FLAT,
      discountValue: 100,
      usageLimit: 10,
      usedCount: 0,
      reservedCount: 0,
      status: PROMOTION_STATUS.ACTIVE,
      validFrom: new Date(Date.now() - 10000),
      validTo: new Date(Date.now() + 100000),
    });

    // 1. Reserve
    const reservation = await service.createReservation({
      code: 'LIFECYCLE',
      scope: PROMOTION_SCOPE.CART,
      userId: 'usr_life_1',
      cartAmount: 500,
      idempotencyKey: 'idemp_key_999',
    });

    let promo = repo.promotions.get(promoId);
    assert.strictEqual(promo.reservedCount, 1);
    assert.strictEqual(promo.usedCount, 0);

    // 2. Confirm
    const conf1 = await service.confirmReservation({
      reservationId: reservation.reservationId,
      orderId: 'order_test_999',
    });
    assert.strictEqual(conf1.confirmed, true);
    assert.strictEqual(conf1.isDuplicate, false);

    promo = repo.promotions.get(promoId);
    assert.strictEqual(promo.reservedCount, 0, 'reservedCount shifted to 0');
    assert.strictEqual(promo.usedCount, 1, 'usedCount shifted to 1');

    // 3. Duplicate Confirmation (Idempotent)
    const conf2 = await service.confirmReservation({
      reservationId: reservation.reservationId,
      orderId: 'order_test_999',
    });
    assert.strictEqual(conf2.isDuplicate, true, 'Repeated confirmation must return isDuplicate: true');

    promo = repo.promotions.get(promoId);
    assert.strictEqual(promo.usedCount, 1, 'usedCount must still remain 1 (no double increment)');

    // 4. Refund / Compensation
    await service.refundRedemption({
      orderId: 'order_test_999',
      reason: 'Customer cancelled booking',
    });

    promo = repo.promotions.get(promoId);
    assert.strictEqual(promo.usedCount, 0, 'usedCount decremented back to 0 on refund');
  });

  // -------------------------------------------------------------
  // Test 7: Expiration Sweeper Auto-Recovery
  // -------------------------------------------------------------
  await test('Sweeper: Expired reservations transition to EXPIRED and release reservedCount safely', async () => {
    const promoId = 'promo_sweeper';
    repo.promotions.set(promoId, {
      _id: promoId,
      code: 'SWEEPERTEST',
      name: 'Sweeper Test',
      scope: PROMOTION_SCOPE.CART,
      benefitType: PROMOTION_BENEFIT_TYPE.FLAT,
      discountValue: 50,
      usageLimit: 10,
      usedCount: 0,
      reservedCount: 2,
      status: PROMOTION_STATUS.ACTIVE,
      validFrom: new Date(Date.now() - 10000),
      validTo: new Date(Date.now() + 100000),
    });

    repo.reservations.set('res_exp_1', {
      reservationId: 'res_exp_1',
      promotionId: promoId,
      status: RESERVATION_STATUS.RESERVED,
      expiresAt: new Date(Date.now() - 60000),
    });

    repo.reservations.set('res_exp_2', {
      reservationId: 'res_exp_2',
      promotionId: promoId,
      status: RESERVATION_STATUS.RESERVED,
      expiresAt: new Date(Date.now() - 30000),
    });

    const sweptCount = await service.sweepExpiredReservations();
    assert.strictEqual(sweptCount, 2, 'Swept 2 expired reservations');

    const promo = repo.promotions.get(promoId);
    assert.strictEqual(promo.reservedCount, 0, 'reservedCount returned to 0');
  });

  // -------------------------------------------------------------
  // Test 8: Performance Benchmark (Latency Targets)
  // -------------------------------------------------------------
  await test('Performance Benchmark: Response time under 200ms without Redis and under 50ms with Cache', async () => {
    const promoId = 'promo_speed';
    repo.promotions.set(promoId, {
      _id: promoId,
      code: 'SPEEDTEST',
      name: 'High Performance Offer',
      scope: PROMOTION_SCOPE.CART,
      benefitType: PROMOTION_BENEFIT_TYPE.PERCENTAGE,
      discountValue: 15,
      maxDiscountAmount: 300,
      usageLimit: 10000,
      usedCount: 0,
      reservedCount: 0,
      status: PROMOTION_STATUS.ACTIVE,
      validFrom: new Date(Date.now() - 10000),
      validTo: new Date(Date.now() + 100000),
    });

    // Measure latency without cache
    const dbTimes = [];
    for (let i = 0; i < 20; i++) {
      repo.cache.clear();
      const start = performance.now();
      await service.quoteOffer({ code: 'SPEEDTEST', cartAmount: 1000 });
      const duration = performance.now() - start;
      dbTimes.push(duration);
    }
    const avgDbTime = dbTimes.reduce((a, b) => a + b, 0) / dbTimes.length;
    console.log(`     ⚡ Latency without Cache: ${avgDbTime.toFixed(3)}ms (User target: < 200ms)`);
    assert(avgDbTime < 200, `Execution time (${avgDbTime}ms) exceeded 200ms!`);

    // Measure latency with cache
    const cacheTimes = [];
    for (let i = 0; i < 50; i++) {
      const start = performance.now();
      await service.quoteOffer({ code: 'SPEEDTEST', cartAmount: 1000 });
      const duration = performance.now() - start;
      cacheTimes.push(duration);
    }
    const avgCacheTime = cacheTimes.reduce((a, b) => a + b, 0) / cacheTimes.length;
    console.log(`     ⚡ Latency with Cache: ${avgCacheTime.toFixed(3)}ms (User target: < 50ms)`);
    assert(avgCacheTime < 50, `Cached execution time (${avgCacheTime}ms) exceeded 50ms!`);
  });

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
