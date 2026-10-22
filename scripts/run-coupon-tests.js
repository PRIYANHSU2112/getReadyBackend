import assert from 'assert';
import { CouponService } from '../services/catalog-service/src/services/coupon.service.js';
import { AppError } from '@getready/errors';

console.log('🚀 Running Coupon Concurrency & Architecture Test Suite...\n');

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
    failed++;
  }
}

async function run() {
  let mockCouponRepo;
  let mockEventPublisher;
  let couponService;

  function setup() {
    mockCouponRepo = {
      findByCode: async () => null,
      countUserRedemptions: async () => 0,
      atomicRedeem: async () => ({ success: true }),
      atomicRollback: async () => ({ rolledBack: true }),
    };
    mockEventPublisher = {
      publish: async () => true,
    };
    couponService = new CouponService(mockCouponRepo, mockEventPublisher);
  }

  // Test 1: Percentage discount calculation with cap
  await test('Percentage discount calculation capped at maxDiscountAmount', async () => {
    setup();
    mockCouponRepo.findByCode = async () => ({
      _id: 'c1',
      code: 'SAVE20',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      minOrderValue: 500,
      maxDiscountAmount: 150,
      usageLimit: 100,
      usedCount: 10,
      perUserLimit: 2,
      status: 'ACTIVE',
      isActive: true,
      validFrom: new Date(Date.now() - 10000),
      validTo: new Date(Date.now() + 100000),
      deletedAt: null,
    });

    const res = await couponService.validateCoupon('SAVE20', { amount: 1000, userId: 'u1' });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.discountAmount, 150, 'Discount must be capped at 150');
    assert.strictEqual(res.payableAmount, 850, 'Payable must be 850');
  });

  // Test 2: Flat discount calculation capped at order amount
  await test('Flat discount calculation capped at order subtotal', async () => {
    setup();
    mockCouponRepo.findByCode = async () => ({
      _id: 'c2',
      code: 'FLAT300',
      discountType: 'FLAT',
      discountValue: 300,
      minOrderValue: 200,
      status: 'ACTIVE',
      isActive: true,
      validFrom: new Date(Date.now() - 10000),
      validTo: new Date(Date.now() + 100000),
      deletedAt: null,
    });

    const res = await couponService.validateCoupon('FLAT300', { amount: 250, userId: 'u1' });
    assert.strictEqual(res.discountAmount, 250, 'Flat discount cannot exceed order subtotal');
    assert.strictEqual(res.payableAmount, 0, 'Payable amount must be 0');
  });

  // Test 3: Min order value check
  await test('Rejection when order amount is below minOrderValue', async () => {
    setup();
    mockCouponRepo.findByCode = async () => ({
      _id: 'c3',
      code: 'MIN1000',
      minOrderValue: 1000,
      status: 'ACTIVE',
      isActive: true,
      validFrom: new Date(Date.now() - 10000),
      validTo: new Date(Date.now() + 100000),
    });

    let errorThrown = false;
    try {
      await couponService.validateCoupon('MIN1000', { amount: 800 });
    } catch (e) {
      errorThrown = true;
      assert.match(e.message, /Minimum order value of ₹1000 required/);
    }
    assert.strictEqual(errorThrown, true, 'Must throw error if below minOrderValue');
  });

  // Test 4: Duplicate redemption check for same user
  await test('Per-user duplicate redemption prevention', async () => {
    setup();
    mockCouponRepo.findByCode = async () => ({
      _id: 'c4',
      code: 'ONCEONLY',
      perUserLimit: 1,
      status: 'ACTIVE',
      isActive: true,
      validFrom: new Date(Date.now() - 10000),
      validTo: new Date(Date.now() + 100000),
    });
    mockCouponRepo.countUserRedemptions = async () => 1; // User already used it

    let rejected = false;
    try {
      await couponService.validateCoupon('ONCEONLY', { amount: 500, userId: 'user_duplicate' });
    } catch (e) {
      rejected = true;
      assert.match(e.message, /maximum allowed times/);
    }
    assert.strictEqual(rejected, true, 'Must prevent user exceeding perUserLimit');
  });

  // Test 5: High-concurrency atomic redemption simulation
  await test('High concurrency simulation: 20 requests competing for 5 available coupon slots', async () => {
    setup();
    const limit = 5;
    let counter = 0;

    mockCouponRepo.findByCode = async () => ({
      _id: 'c5',
      code: 'RACE5',
      discountType: 'FLAT',
      discountValue: 100,
      usageLimit: limit,
      usedCount: counter,
      status: 'ACTIVE',
      isActive: true,
      validFrom: new Date(Date.now() - 10000),
      validTo: new Date(Date.now() + 100000),
    });

    mockCouponRepo.atomicRedeem = async ({ userId, orderId }) => {
      // Simulate MongoDB atomic findOneAndUpdate with $expr: { $lt: ['$usedCount', 5] }
      if (counter < limit) {
        counter++;
        return {
          success: true,
          redemption: { id: `red_${counter}`, userId, orderId, status: 'REDEEMED' },
        };
      }
      throw new AppError('Coupon usage limit has been reached', 409, 'CONFLICT');
    };

    // 20 concurrent requests simultaneously
    const requests = Array.from({ length: 20 }, (_, i) =>
      couponService
        .redeemCoupon({
          code: 'RACE5',
          amount: 500,
          userId: `u_${i}`,
          orderId: `order_${i}`,
        })
        .then((r) => ({ success: true, r }))
        .catch((e) => ({ success: false, error: e.message }))
    );

    const outcomes = await Promise.all(requests);
    const successCount = outcomes.filter((o) => o.success).length;
    const failCount = outcomes.filter((o) => !o.success).length;

    assert.strictEqual(successCount, 5, 'Exactly 5 coupons must be redeemed');
    assert.strictEqual(failCount, 15, 'Exactly 15 requests must be rejected');
    assert.strictEqual(counter, 5, 'Final counter must strictly equal 5');
  });

  // Test 6: Transaction-safe rollback / release
  await test('Atomic rollback releases coupon and restores count on payment failure', async () => {
    setup();
    let rolledBackCalled = false;
    mockCouponRepo.atomicRollback = async ({ orderId }) => {
      rolledBackCalled = true;
      return {
        rolledBack: true,
        redemption: { orderId, status: 'CANCELLED' },
      };
    };

    const res = await couponService.releaseCoupon({
      orderId: 'failed_order_123',
      reason: 'User cancelled payment',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.rolledBack, true);
    assert.strictEqual(rolledBackCalled, true, 'Rollback repository must be invoked');
  });

  console.log(`\n================================`);
  console.log(`Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`================================\n`);

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
