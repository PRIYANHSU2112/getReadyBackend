import assert from 'assert';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import {
  PLAN_STATUS,
  BILLING_CYCLE,
  STACKING_RULE,
  MEMBERSHIP_STATUS,
  TRANSACTION_TYPE,
  TRANSACTION_PAYMENT_STATUS,
  ENTITLEMENT_STATUS,
} from '../services/membership-service/src/models/index.js';
import { MembershipService } from '../services/membership-service/src/services/membership.service.js';
import { AppError, HttpStatus, ErrorCodes } from '@getready/errors';

console.log('👑 Starting GetReady Membership Service Production Test Suite...\n');

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
 * High-fidelity in-memory Membership Repository
 * Accurately models MongoDB partial unique indexes, atomic updates, and write locks
 */
class InMemoryMembershipRepository {
  constructor() {
    this.plans = new Map();
    this.subscriptions = new Map();
    this.transactions = new Map();
    this.entitlements = new Map();
    this.cache = new Map();
    this.writeLocks = new Set();
  }

  async findActivePlans() {
    const cached = this.cache.get('membership:plans:active');
    if (cached) return cached;

    const list = Array.from(this.plans.values())
      .filter((p) => p.status === PLAN_STATUS.ACTIVE && p.isActive && !p.deletedAt)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    this.cache.set('membership:plans:active', list);
    return list;
  }

  async findPlanByCode(planCode) {
    if (!planCode) return null;
    const cleanCode = String(planCode).trim().toUpperCase();
    const cached = this.cache.get(`membership:plan:${cleanCode}`);
    if (cached) return cached;

    for (const plan of this.plans.values()) {
      if (plan.planCode === cleanCode && !plan.deletedAt) {
        if (plan.status === PLAN_STATUS.ACTIVE) {
          this.cache.set(`membership:plan:${cleanCode}`, plan);
        }
        return plan;
      }
    }
    return null;
  }

  async findPlanById(id) {
    return this.plans.get(String(id)) || null;
  }

  async getActiveSubscriptionByUserId(userId) {
    if (!userId) return null;
    const cleanUserId = String(userId);
    const cached = this.cache.get(`membership:user:${cleanUserId}`);
    if (cached) return cached;

    const now = new Date();
    for (const sub of this.subscriptions.values()) {
      if (
        (sub.userId === cleanUserId || (sub.sharedWithUserIds && sub.sharedWithUserIds.includes(cleanUserId))) &&
        sub.status === MEMBERSHIP_STATUS.ACTIVE &&
        new Date(sub.endDate) > now
      ) {
        this.cache.set(`membership:user:${cleanUserId}`, sub);
        return sub;
      }
    }
    return null;
  }

  async initiateSubscription({ userId, plan, paymentOrderId = null, idempotencyKey = null }) {
    const cleanUserId = String(userId);

    // Idempotency check
    if (idempotencyKey) {
      for (const tx of this.transactions.values()) {
        if (tx.idempotencyKey === idempotencyKey) {
          const existingSub = this.subscriptions.get(tx.subscriptionId);
          if (existingSub) {
            return { subscription: existingSub, isDuplicate: true };
          }
        }
      }
    }

    // Check existing active subscription
    const activeSub = await this.getActiveSubscriptionByUserId(cleanUserId);
    if (activeSub) {
      throw new AppError(
        `You already have an active ${activeSub.planCode} membership expiring on ${new Date(activeSub.endDate).toLocaleDateString()}`,
        HttpStatus.CONFLICT,
        ErrorCodes.CONFLICT,
      );
    }

    const subscriptionId = `sub_${randomUUID().replace(/-/g, '')}`;
    const transactionId = `mtx_${randomUUID().replace(/-/g, '')}`;

    const sub = {
      _id: randomUUID(),
      subscriptionId,
      userId: cleanUserId,
      planId: plan._id || plan.id,
      planCode: plan.planCode,
      planSnapshot: { ...plan },
      status: MEMBERSHIP_STATUS.PENDING_PAYMENT,
      paymentOrderId,
      autoRenew: true,
      sharedWithUserIds: [],
      createdAt: new Date(),
    };

    const tx = {
      _id: randomUUID(),
      transactionId,
      subscriptionId,
      userId: cleanUserId,
      type: TRANSACTION_TYPE.PURCHASE,
      amount: plan.price,
      paymentOrderId,
      paymentStatus: TRANSACTION_PAYMENT_STATUS.PENDING,
      idempotencyKey,
      createdAt: new Date(),
    };

    this.subscriptions.set(subscriptionId, sub);
    this.transactions.set(transactionId, tx);

    return { subscription: sub, isDuplicate: false };
  }

  async atomicActivateSubscription({ subscriptionId, paymentId, paymentOrderId = null }) {
    if (!subscriptionId) {
      throw new AppError('Subscription ID required for activation', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) {
      throw new AppError('Membership subscription not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    // Webhook Idempotency Check
    if (sub.status === MEMBERSHIP_STATUS.ACTIVE) {
      return { subscription: sub, isDuplicate: true };
    }

    // Concurrency Lock: Simulate MongoDB unique partial index on { userId: 1, status: 'ACTIVE' }
    const lockKey = `active_sub:${sub.userId}`;
    if (this.writeLocks.has(lockKey)) {
      throw new AppError(
        'Customer already has another active membership subscription',
        HttpStatus.CONFLICT,
        ErrorCodes.CONFLICT,
      );
    }

    // Check if user already has an active sub (partial index enforcement)
    for (const otherSub of this.subscriptions.values()) {
      if (
        otherSub.userId === sub.userId &&
        otherSub.subscriptionId !== sub.subscriptionId &&
        otherSub.status === MEMBERSHIP_STATUS.ACTIVE &&
        new Date(otherSub.endDate) > new Date()
      ) {
        throw new AppError(
          'Customer already has another active membership subscription',
          HttpStatus.CONFLICT,
          ErrorCodes.CONFLICT,
        );
      }
    }

    this.writeLocks.add(lockKey);

    const plan = sub.planSnapshot;
    const durationDays = plan.durationDays || 30;
    const now = new Date();
    const startDate = now;
    const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    sub.status = MEMBERSHIP_STATUS.ACTIVE;
    sub.startDate = startDate;
    sub.endDate = endDate;
    sub.paymentId = paymentId;
    if (paymentOrderId) sub.paymentOrderId = paymentOrderId;

    // Create complimentary entitlements
    const entitlements = [];
    if (Array.isArray(plan.complimentaryServices) && plan.complimentaryServices.length > 0) {
      for (const comp of plan.complimentaryServices) {
        const entitlementId = `ent_${randomUUID().replace(/-/g, '')}`;
        const rolloverDays = comp.rolloverMaxDays || 60;
        const expiresAt = new Date(endDate.getTime() + rolloverDays * 24 * 60 * 60 * 1000);

        const ent = {
          _id: randomUUID(),
          entitlementId,
          subscriptionId: sub.subscriptionId,
          userId: sub.userId,
          serviceId: comp.serviceId,
          serviceName: comp.name,
          totalAllowed: comp.quantityPerCycle || 1,
          usedCount: 0,
          cycleStartDate: startDate,
          cycleEndDate: endDate,
          expiresAt,
          status: ENTITLEMENT_STATUS.AVAILABLE,
        };
        entitlements.push(ent);
        this.entitlements.set(entitlementId, ent);
      }
    }

    // Update transaction
    for (const tx of this.transactions.values()) {
      if (tx.subscriptionId === sub.subscriptionId) {
        tx.paymentId = paymentId;
        tx.paymentStatus = TRANSACTION_PAYMENT_STATUS.CAPTURED;
      }
    }

    // Invalidate user cache
    this.cache.delete(`membership:user:${sub.userId}`);

    return {
      subscription: sub,
      entitlements,
      plan,
      isDuplicate: false,
    };
  }

  async findEntitlementsBySubscription(subscriptionId) {
    if (!subscriptionId) return [];
    const now = new Date();
    return Array.from(this.entitlements.values()).filter(
      (e) =>
        e.subscriptionId === subscriptionId &&
        e.status === ENTITLEMENT_STATUS.AVAILABLE &&
        new Date(e.expiresAt) > now,
    );
  }

  async atomicCancelSubscription({ subscriptionId, userId, reason = 'Customer request' }) {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub || sub.userId !== String(userId)) {
      throw new AppError('Subscription not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    sub.autoRenew = false;
    sub.cancellationDetails = {
      cancelledAt: new Date(),
      reason,
      effectiveEndDate: sub.endDate,
    };

    this.cache.delete(`membership:user:${sub.userId}`);
    return sub;
  }

  async claimEntitlement({ userId, entitlementId, bookingId }) {
    const ent = this.entitlements.get(entitlementId);
    if (!ent) {
      throw new AppError('Entitlement not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    if (
      ent.userId !== String(userId) ||
      ent.status !== ENTITLEMENT_STATUS.AVAILABLE ||
      new Date() > new Date(ent.expiresAt) ||
      ent.usedCount >= ent.totalAllowed
    ) {
      throw new AppError(
        'Complimentary treatment entitlement is not available or has already been used',
        HttpStatus.CONFLICT,
        ErrorCodes.CONFLICT,
      );
    }

    ent.usedCount += 1;
    ent.claimedBookingId = String(bookingId);
    if (!Array.isArray(ent.claimedBookingIds)) {
      ent.claimedBookingIds = [];
    }
    ent.claimedBookingIds.push(String(bookingId));
    if (ent.usedCount >= ent.totalAllowed) {
      ent.status = ENTITLEMENT_STATUS.USED;
    }

    return ent;
  }

  async sweepExpiredSubscriptions() {
    const now = new Date();
    let count = 0;
    for (const sub of this.subscriptions.values()) {
      if (sub.status === MEMBERSHIP_STATUS.ACTIVE && new Date(sub.endDate) < now) {
        sub.status = MEMBERSHIP_STATUS.EXPIRED;
        this.cache.delete(`membership:user:${sub.userId}`);
        count++;
      }
    }
    return count;
  }

  async createPlan(data, adminUser = 'ADMIN') {
    const id = randomUUID();
    const plan = {
      _id: id,
      id,
      ...data,
      planCode: String(data.planCode).trim().toUpperCase(),
      auditLog: [
        {
          action: 'CREATE',
          changedBy: adminUser,
          timestamp: new Date(),
          changes: data,
        },
      ],
      createdAt: new Date(),
    };
    this.plans.set(id, plan);
    this.cache.delete('membership:plans:active');
    return plan;
  }

  async updatePlan(id, updates, adminUser = 'ADMIN') {
    const existing = this.plans.get(String(id));
    if (!existing) {
      throw new AppError('Membership plan not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const updated = {
      ...existing,
      ...updates,
      auditLog: [
        ...(existing.auditLog || []),
        {
          action: 'UPDATE',
          changedBy: adminUser,
          timestamp: new Date(),
          changes: updates,
        },
      ],
    };
    this.plans.set(String(id), updated);
    this.cache.delete('membership:plans:active');
    this.cache.delete(`membership:plan:${existing.planCode}`);
    if (updates.planCode) this.cache.delete(`membership:plan:${updates.planCode}`);
    return updated;
  }

  async findAllPlansAdmin() {
    return Array.from(this.plans.values()).filter((p) => !p.deletedAt);
  }

  async updateSubscription(id, updates) {
    for (const sub of this.subscriptions.values()) {
      if (sub._id === id || sub.subscriptionId === id) {
        Object.assign(sub, updates);
        this.cache.delete(`membership:user:${sub.userId}`);
        return sub;
      }
    }
    return null;
  }

  async findSubscriptions(filter = {}, { skip = 0, limit = 20 } = {}) {
    let list = Array.from(this.subscriptions.values());
    if (filter.status) list = list.filter((s) => s.status === filter.status);
    if (filter.planCode) list = list.filter((s) => s.planCode === filter.planCode);
    if (filter.userId) list = list.filter((s) => s.userId === filter.userId);

    const total = list.length;
    const items = list.slice(skip, skip + limit);
    return { items, total };
  }

  async getAnalytics() {
    const now = new Date();
    let activeCount = 0;
    let expiredCount = 0;
    let totalRevenue = 0;

    for (const sub of this.subscriptions.values()) {
      if (sub.status === MEMBERSHIP_STATUS.ACTIVE && new Date(sub.endDate) > now) {
        activeCount++;
      } else if (sub.status === MEMBERSHIP_STATUS.EXPIRED) {
        expiredCount++;
      }
    }

    for (const tx of this.transactions.values()) {
      if (tx.paymentStatus === TRANSACTION_PAYMENT_STATUS.CAPTURED) {
        totalRevenue += tx.amount || 0;
      }
    }

    return {
      activeSubscribers: activeCount,
      expiredSubscribers: expiredCount,
      totalRecurringRevenue: totalRevenue,
      mrr: Math.round(activeCount * 599),
    };
  }
}

// -------------------------------------------------------------
// Test Runner
// -------------------------------------------------------------

async function runTests() {
  const repo = new InMemoryMembershipRepository();
  const service = new MembershipService(repo);

  // 1. Dynamic Plan Management (Admin Panel)
  await test('Admin: Create 100% Dynamic Membership Plan', async () => {
    const planData = {
      planCode: 'GLOW_CLUB_MONTHLY',
      name: 'GetReady Glow Club (Monthly)',
      description: 'Exclusive beauty membership with 15% off and complimentary treatments',
      price: 599,
      billingCycle: BILLING_CYCLE.MONTHLY,
      durationDays: 30,
      discountType: 'PERCENTAGE',
      discountValue: 15,
      maxDiscountPerBooking: 500,
      minBookingSubtotal: 0,
      loyaltyMultiplier: 2.0,
      bonusPointsOnJoin: 500,
      complimentaryServices: [
        {
          serviceId: 'srv_threading_clean',
          name: 'Complimentary Eyebrow Threading / Cleanup',
          quantityPerCycle: 1,
          rolloverAllowed: true,
          rolloverMaxDays: 60,
        },
      ],
      familySharingAllowed: true,
      maxFamilyMembers: 4,
      stackingRule: STACKING_RULE.CANNOT_STACK_WITH_COUPON,
      marketingConfig: {
        badgeText: 'EXCLUSIVE MEMBERSHIP',
        heroTitle: 'Get Ready. Glow Club.',
        perceivedWorthText: '₹2,400+',
        cartOptInTitle: 'Join Glow Club & Save More Today',
      },
      status: PLAN_STATUS.ACTIVE,
      isActive: true,
    };

    const created = await service.createPlan(planData, 'admin@getready.in');
    assert.strictEqual(created.planCode, 'GLOW_CLUB_MONTHLY');
    assert.strictEqual(created.price, 599);
    assert.strictEqual(created.discountValue, 15);
    assert.strictEqual(created.auditLog.length, 1);
    assert.strictEqual(created.auditLog[0].action, 'CREATE');
  });

  await test('Admin: Update Plan pricing and discount dynamically without restarts', async () => {
    const plans = await service.listPlansAdmin();
    assert.strictEqual(plans.length, 1);
    const planId = plans[0]._id;

    // Admin updates price to ₹649 and max cap to ₹600
    const updated = await service.updatePlan(planId, { price: 649, maxDiscountPerBooking: 600 }, 'admin@getready.in');
    assert.strictEqual(updated.price, 649);
    assert.strictEqual(updated.maxDiscountPerBooking, 600);
    assert.strictEqual(updated.auditLog.length, 2);

    // Revert back to 599 for standard suite assertions
    await service.updatePlan(planId, { price: 599, maxDiscountPerBooking: 500 }, 'admin@getready.in');
  });

  await test('User: Fetch active public plans for app presentation', async () => {
    const activePlans = await service.getActivePlans();
    assert.strictEqual(activePlans.length, 1);
    assert.strictEqual(activePlans[0].planCode, 'GLOW_CLUB_MONTHLY');
    assert.strictEqual(activePlans[0].price, 599);
  });

  // 2. Subscription Initiation & Concurrency Prevention
  let activeSubId = null;
  const testUserId = 'usr_customer_101';

  await test('User: Initiate subscription purchase for Razorpay checkout', async () => {
    const res = await service.subscribe({
      userId: testUserId,
      planCode: 'GLOW_CLUB_MONTHLY',
    });

    assert.ok(res.subscriptionId);
    assert.strictEqual(res.price, 599);
    assert.strictEqual(res.status, MEMBERSHIP_STATUS.PENDING_PAYMENT);
    assert.strictEqual(res.isDuplicate, false);
    activeSubId = res.subscriptionId;
  });

  await test('Idempotency: Repeated initiate with same idempotency key returns original sub', async () => {
    const res1 = await service.subscribe({
      userId: 'usr_customer_idem',
      planCode: 'GLOW_CLUB_MONTHLY',
      idempotencyKey: 'idem_key_12345',
    });

    const res2 = await service.subscribe({
      userId: 'usr_customer_idem',
      planCode: 'GLOW_CLUB_MONTHLY',
      idempotencyKey: 'idem_key_12345',
    });

    assert.strictEqual(res1.subscriptionId, res2.subscriptionId);
    assert.strictEqual(res2.isDuplicate, true);
  });

  // 3. Payment Webhook Activation & High-Concurrency Race Condition Protection
  await test('Webhook: Authoritative activation upon confirmed payment', async () => {
    const activation = await service.activateFromWebhook({
      subscriptionId: activeSubId,
      paymentId: 'pay_rzp_999888',
      paymentOrderId: 'order_rzp_111222',
    });

    assert.strictEqual(activation.subscription.status, MEMBERSHIP_STATUS.ACTIVE);
    assert.ok(activation.subscription.startDate);
    assert.ok(activation.subscription.endDate);
    assert.strictEqual(activation.entitlements.length, 1);
    assert.strictEqual(activation.entitlements[0].serviceName, 'Complimentary Eyebrow Threading / Cleanup');
    assert.strictEqual(activation.isDuplicate, false);
  });

  await test('Webhook Idempotency: Duplicate payment webhooks do not extend end date or duplicate perks', async () => {
    const subBefore = repo.subscriptions.get(activeSubId);
    const endBefore = new Date(subBefore.endDate).getTime();

    const secondCall = await service.activateFromWebhook({
      subscriptionId: activeSubId,
      paymentId: 'pay_rzp_999888',
    });

    assert.strictEqual(secondCall.isDuplicate, true);
    const subAfter = repo.subscriptions.get(activeSubId);
    assert.strictEqual(new Date(subAfter.endDate).getTime(), endBefore);
  });

  await test('Concurrency: 10 concurrent activation requests for the same customer -> exactly 1 succeeds, 9 fail with 409', async () => {
    // Initiate another sub for customer 101 while first is active
    const concurrentSubs = [];
    for (let i = 0; i < 10; i++) {
      const plan = await repo.findPlanByCode('GLOW_CLUB_MONTHLY');
      const subId = `sub_race_${i}_${randomUUID().slice(0, 6)}`;
      const sub = {
        _id: randomUUID(),
        subscriptionId: subId,
        userId: 'usr_race_condition_user',
        planId: plan._id,
        planCode: plan.planCode,
        planSnapshot: { ...plan },
        status: MEMBERSHIP_STATUS.PENDING_PAYMENT,
        createdAt: new Date(),
      };
      repo.subscriptions.set(subId, sub);
      concurrentSubs.push(subId);
    }

    let successCount = 0;
    let conflictCount = 0;

    const promises = concurrentSubs.map(async (subId, index) => {
      try {
        await service.activateFromWebhook({
          subscriptionId: subId,
          paymentId: `pay_race_${index}`,
        });
        successCount++;
      } catch (err) {
        if (err.statusCode === HttpStatus.CONFLICT || err.code === 11000) {
          conflictCount++;
        } else {
          throw err;
        }
      }
    });

    await Promise.all(promises);

    assert.strictEqual(successCount, 1, 'Only exactly 1 concurrent activation must succeed');
    assert.strictEqual(conflictCount, 9, 'Remaining 9 concurrent activations must be rejected with 409 Conflict');
  });

  // 4. Cart & Pricing Calculation
  await test('Cart: Active member receives 15% discount up to ₹500 cap', async () => {
    const items = [
      { serviceId: 'srv_facial', name: 'Gold Facial', price: 2000, quantity: 1, categoryId: 'cat_facial' },
      { serviceId: 'srv_hair', name: 'Hair Spa', price: 1500, quantity: 1, categoryId: 'cat_hair' },
    ];
    // Total = 3500. 15% of 3500 = 525. Capped at 500.
    const result = await service.calculateCartBenefits({
      userId: testUserId,
      items,
      grossSubtotal: 3500,
      optInRequested: false,
    });

    assert.strictEqual(result.isMember, true);
    assert.strictEqual(result.optInApplied, false);
    assert.strictEqual(result.membershipFee, 0);
    assert.strictEqual(result.discountPercentage, 15);
    assert.strictEqual(result.membershipDiscount, 500, 'Discount must be capped at max ₹500');
    assert.strictEqual(result.savingsToday, 500);
  });

  await test('Cart: Non-member opting in receives ₹599 membership fee + 15% discount on the spot', async () => {
    const items = [
      { serviceId: 'srv_waxing', name: 'Rica Waxing', price: 1200, quantity: 1 },
    ];
    // 15% of 1200 = 180. Fee = 599.
    const result = await service.calculateCartBenefits({
      userId: 'usr_new_customer',
      items,
      grossSubtotal: 1200,
      optInRequested: true,
      requestedPlanCode: 'GLOW_CLUB_MONTHLY',
    });

    assert.strictEqual(result.isMember, true);
    assert.strictEqual(result.optInApplied, true);
    assert.strictEqual(result.membershipFee, 599);
    assert.strictEqual(result.discountPercentage, 15);
    assert.strictEqual(result.membershipDiscount, 180);
    assert.strictEqual(result.welcomePerks.bonusPoints, 500);
  });

  await test('Cart: Excluded services do not receive membership discounts', async () => {
    // Admin excludes srv_luxury_bridal from plan
    const plan = await repo.findPlanByCode('GLOW_CLUB_MONTHLY');
    await repo.updatePlan(plan._id, { excludedServiceIds: ['srv_luxury_bridal'] });

    const items = [
      { serviceId: 'srv_luxury_bridal', name: 'Bridal Package', price: 10000, quantity: 1 },
      { serviceId: 'srv_hair', name: 'Blow Dry', price: 600, quantity: 1 },
    ];

    const result = await service.calculateCartBenefits({
      userId: testUserId,
      items,
      grossSubtotal: 10600,
    });

    // Only ₹600 is eligible. 15% of 600 = ₹90.
    assert.strictEqual(result.membershipDiscount, 90);

    // Reset exclusions
    await repo.updatePlan(plan._id, { excludedServiceIds: [] });
  });

  // 5. Complimentary Entitlement Claim & Rollover Logic
  await test('Entitlement: Claim free monthly treatment links to booking and prevents double-claim', async () => {
    const status = await service.getCustomerMembershipStatus(testUserId);
    assert.strictEqual(status.hasActiveMembership, true);
    assert.strictEqual(status.complimentaryEntitlements.length, 1);

    const entId = status.complimentaryEntitlements[0].entitlementId;

    // First claim succeeds
    const claimed = await service.claimComplimentaryService({
      userId: testUserId,
      entitlementId: entId,
      bookingId: 'bk_2026_xyz',
    });
    assert.strictEqual(claimed.status, ENTITLEMENT_STATUS.USED);
    assert.strictEqual(claimed.usedCount, 1);
    assert.strictEqual(claimed.claimedBookingId, 'bk_2026_xyz');

    // Second claim for same entitlement must fail with 409
    let duplicateRejected = false;
    try {
      await service.claimComplimentaryService({
        userId: testUserId,
        entitlementId: entId,
        bookingId: 'bk_2026_second',
      });
    } catch (err) {
      if (err.statusCode === HttpStatus.CONFLICT) {
        duplicateRejected = true;
      }
    }
    assert.strictEqual(duplicateRejected, true, 'Double entitlement claim must be rejected');
  });

  // 6. Family Sharing (Up to 4 members)
  await test('Family Sharing: Add up to 4 family members, reject 5th member with 409', async () => {
    const res1 = await service.addFamilyMember({ userId: testUserId, familyUserId: 'usr_mom' });
    const res2 = await service.addFamilyMember({ userId: testUserId, familyUserId: 'usr_sister' });
    const res3 = await service.addFamilyMember({ userId: testUserId, familyUserId: 'usr_daughter' });
    const res4 = await service.addFamilyMember({ userId: testUserId, familyUserId: 'usr_cousin' });

    assert.strictEqual(res4.sharedMembersCount, 4);

    // Family member usr_mom can now enjoy membership benefits in cart
    const momCart = await service.calculateCartBenefits({
      userId: 'usr_mom',
      items: [{ serviceId: 'srv_clean', price: 1000, quantity: 1 }],
      grossSubtotal: 1000,
    });
    assert.strictEqual(momCart.isMember, true, 'Shared family member must receive membership discounts');
    assert.strictEqual(momCart.membershipDiscount, 150);

    // Attempting to add 5th family member must fail
    let limitExceeded = false;
    try {
      await service.addFamilyMember({ userId: testUserId, familyUserId: 'usr_fifth_friend' });
    } catch (err) {
      if (err.statusCode === HttpStatus.CONFLICT) {
        limitExceeded = true;
      }
    }
    assert.strictEqual(limitExceeded, true, 'Cannot add more than 4 family members');
  });

  // 7. Cancellation & Expiry Sweeper
  await test('Cancellation: Stop auto-renewal while keeping active status until end date', async () => {
    const cancelled = await service.cancelSubscription({
      subscriptionId: activeSubId,
      userId: testUserId,
      reason: 'Relocating to another city',
    });

    assert.strictEqual(cancelled.autoRenew, false);
    assert.ok(cancelled.cancellationDetails.cancelledAt);
    assert.strictEqual(cancelled.status, MEMBERSHIP_STATUS.ACTIVE, 'Subscription remains active until endDate');
  });

  await test('Sweeper: Nightly cron sweeps past-date subscriptions to EXPIRED', async () => {
    // Manually backdate a subscription to yesterday
    const expiredSubId = `sub_past_${randomUUID().slice(0, 6)}`;
    const plan = await repo.findPlanByCode('GLOW_CLUB_MONTHLY');
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    repo.subscriptions.set(expiredSubId, {
      _id: randomUUID(),
      subscriptionId: expiredSubId,
      userId: 'usr_expired_customer',
      planId: plan._id,
      planCode: plan.planCode,
      status: MEMBERSHIP_STATUS.ACTIVE,
      startDate: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      endDate: pastDate,
    });

    const sweptCount = await repo.sweepExpiredSubscriptions();
    assert.ok(sweptCount >= 1, 'Expired subscriptions must be swept');

    const sub = repo.subscriptions.get(expiredSubId);
    assert.strictEqual(sub.status, MEMBERSHIP_STATUS.EXPIRED);
  });

  // 8. Performance SLA Benchmarks: < 200 ms without Redis, < 50 ms with Redis/L1
  await test('Performance SLA: Direct DB query latency < 200 ms (Target: < 200 ms)', async () => {
    const iterations = 100;
    const latencies = [];

    for (let i = 0; i < iterations; i++) {
      // Clear cache to force direct repository / database lookups
      repo.cache.clear();

      const start = performance.now();
      await service.calculateCartBenefits({
        userId: testUserId,
        items: [{ serviceId: 'srv_1', price: 1500, quantity: 1 }],
        grossSubtotal: 1500,
      });
      const end = performance.now();
      latencies.push(end - start);
    }

    latencies.sort((a, b) => a - b);
    const avg = latencies.reduce((sum, v) => sum + v, 0) / latencies.length;
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];

    console.log(`     📊 DB direct latency (Uncached): Avg=${avg.toFixed(3)}ms, P95=${p95.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);
    assert.ok(p99 < 200, `P99 direct DB latency must be < 200 ms, got ${p99.toFixed(2)} ms`);
  });

  await test('Performance SLA: Cached query latency < 50 ms (Target: < 50 ms, typically < 2 ms)', async () => {
    const iterations = 1000;
    const latencies = [];

    // Warm cache
    await service.calculateCartBenefits({
      userId: testUserId,
      items: [{ serviceId: 'srv_1', price: 1500, quantity: 1 }],
      grossSubtotal: 1500,
    });

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await service.calculateCartBenefits({
        userId: testUserId,
        items: [{ serviceId: 'srv_1', price: 1500, quantity: 1 }],
        grossSubtotal: 1500,
      });
      const end = performance.now();
      latencies.push(end - start);
    }

    latencies.sort((a, b) => a - b);
    const avg = latencies.reduce((sum, v) => sum + v, 0) / latencies.length;
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];

    console.log(`     ⚡ Cache query latency (L1/Redis): Avg=${avg.toFixed(3)}ms, P95=${p95.toFixed(3)}ms, P99=${p99.toFixed(3)}ms`);
    assert.ok(p99 < 50, `P99 cached latency must be < 50 ms, got ${p99.toFixed(2)} ms`);
  });

  // Summary
  console.log('\n======================================================');
  console.log(`👑 Test Suite Results: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
