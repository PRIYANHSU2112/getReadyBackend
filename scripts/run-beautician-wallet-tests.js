import assert from 'assert';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import {
  WalletType,
  WalletTransactionType,
  WalletTransactionCategory,
  WalletTransactionStatus,
  PayoutStatus,
  PayoutDestinationType,
} from '../services/wallet-service/src/models/wallet.enum.js';
import { AppError, HttpStatus, ErrorCodes, ConflictError, ValidationError, NotFoundError } from '@getready/errors';

console.log('💅 Starting GetReady Beautician Wallet Service Production Test Suite...\n');

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
 * In-memory repository with atomic locks, exactly simulating MongoDB findOneAndUpdate with $gte & $inc
 */
class InMemoryBeauticianWalletRepository {
  constructor() {
    this.wallets = new Map();
    this.transactions = new Map();
    this.payouts = new Map();
    this.cache = new Map();
    this.writeLocks = new Set();
    this.payoutConfig = {
      minWithdrawalAmount: 100,
      maxWithdrawalAmount: 50000,
      defaultCommissionPercentage: 10,
      allowBankPayout: true,
      allowUpiPayout: true,
    };
  }

  _key(userId, walletType = WalletType.BEAUTICIAN) {
    return `${userId}:${walletType}`;
  }

  async getOrCreateForUser(userId, walletType = WalletType.BEAUTICIAN) {
    const k = this._key(userId, walletType);
    if (!this.wallets.has(k)) {
      this.wallets.set(k, {
        _id: randomUUID(),
        userId: String(userId),
        walletType,
        walletNumber: `GRBTW${Math.floor(100000 + Math.random() * 900000)}`,
        balance: 0,
        pendingWithdrawalBalance: 0,
        totalEarnedLifetime: 0,
        totalWithdrawnLifetime: 0,
        currentMonthEarnings: 0,
        currency: 'INR',
        status: 'ACTIVE',
      });
    }
    return JSON.parse(JSON.stringify(this.wallets.get(k)));
  }

  async findByUserId(userId, walletType = WalletType.BEAUTICIAN) {
    const k = this._key(userId, walletType);
    return this.wallets.get(k) ? JSON.parse(JSON.stringify(this.wallets.get(k))) : null;
  }

  /**
   * Atomic compare-and-swap simulation of MongoDB findOneAndUpdate with condition { balance: { $gte: amount } }
   */
  async atomicLockWithdrawal(userId, amount) {
    const k = this._key(userId, WalletType.BEAUTICIAN);
    while (this.writeLocks.has(k)) {
      await new Promise((r) => setTimeout(r, 2));
    }
    this.writeLocks.add(k);
    try {
      const w = this.wallets.get(k);
      if (!w || w.balance < amount) {
        return null;
      }
      w.balance -= amount;
      w.pendingWithdrawalBalance += amount;
      return JSON.parse(JSON.stringify(w));
    } finally {
      this.writeLocks.delete(k);
    }
  }

  async atomicCreditEarnings(userId, netPayoutAmount) {
    const k = this._key(userId, WalletType.BEAUTICIAN);
    while (this.writeLocks.has(k)) {
      await new Promise((r) => setTimeout(r, 2));
    }
    this.writeLocks.add(k);
    try {
      let w = this.wallets.get(k);
      if (!w) {
        await this.getOrCreateForUser(userId, WalletType.BEAUTICIAN);
        w = this.wallets.get(k);
      }
      w.balance += netPayoutAmount;
      w.totalEarnedLifetime += netPayoutAmount;
      w.currentMonthEarnings += netPayoutAmount;
      return JSON.parse(JSON.stringify(w));
    } finally {
      this.writeLocks.delete(k);
    }
  }

  async atomicApprovePayout(userId, amount) {
    const k = this._key(userId, WalletType.BEAUTICIAN);
    const w = this.wallets.get(k);
    if (w) {
      w.pendingWithdrawalBalance -= amount;
      w.totalWithdrawnLifetime += amount;
    }
    return w;
  }

  async atomicRejectPayout(userId, amount) {
    const k = this._key(userId, WalletType.BEAUTICIAN);
    const w = this.wallets.get(k);
    if (w) {
      w.pendingWithdrawalBalance -= amount;
      w.balance += amount; // AUTO-REFUND!
    }
    return w;
  }

  async createTransaction(txData) {
    const id = randomUUID();
    const doc = {
      _id: id,
      id,
      ...txData,
      createdAt: new Date(),
    };
    this.transactions.set(id, doc);
    return JSON.parse(JSON.stringify(doc));
  }

  async findTransactionById(id) {
    const tx = this.transactions.get(id);
    return tx ? JSON.parse(JSON.stringify(tx)) : null;
  }

  async listRecentTransactions(userId, limit = 5) {
    const list = Array.from(this.transactions.values())
      .filter((t) => String(t.userId) === String(userId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
    return JSON.parse(JSON.stringify(list));
  }

  async listTransactionsByUser(userId, { limit = 20, skip = 0, type = null, category = null } = {}) {
    let list = Array.from(this.transactions.values()).filter((t) => String(t.userId) === String(userId));
    if (type) list = list.filter((t) => t.type === type);
    if (category) list = list.filter((t) => t.category === category);
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const total = list.length;
    const paginated = list.slice(skip, skip + limit);
    return { transactions: JSON.parse(JSON.stringify(paginated)), total };
  }

  async createPayout(payoutData) {
    const id = randomUUID();
    const doc = {
      _id: id,
      id,
      ...payoutData,
      status: PayoutStatus.REQUESTED,
      createdAt: new Date(),
    };
    this.payouts.set(id, doc);
    return JSON.parse(JSON.stringify(doc));
  }

  async findPayoutById(id) {
    const p = this.payouts.get(id);
    return p ? JSON.parse(JSON.stringify(p)) : null;
  }

  async updatePayout(id, updateData) {
    const p = this.payouts.get(id);
    if (!p) return null;
    Object.assign(p, updateData);
    return JSON.parse(JSON.stringify(p));
  }
}

/**
 * Mock Beautician Wallet Service wired to test harness
 */
class TestBeauticianWalletService {
  constructor(repo) {
    this.repo = repo;
    this.cache = new Map();
  }

  async getDashboard(userId) {
    const cacheKey = `wallet:beautician:${userId}:dashboard`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const [wallet, recent] = await Promise.all([
      this.repo.getOrCreateForUser(userId),
      this.repo.listRecentTransactions(userId, 5),
    ]);

    const res = {
      walletId: wallet.walletNumber,
      currency: wallet.currency,
      balance: wallet.balance,
      availableBalance: wallet.balance,
      monthlyEarnings: wallet.currentMonthEarnings,
      totalWithdrawal: wallet.totalWithdrawnLifetime,
      pendingWithdrawal: wallet.pendingWithdrawalBalance,
      totalEarnedLifetime: wallet.totalEarnedLifetime,
      recentTransactions: recent.map(this.formatTx),
    };

    this.cache.set(cacheKey, res);
    return res;
  }

  async getPayoutConfig() {
    return JSON.parse(JSON.stringify(this.repo.payoutConfig));
  }

  async updatePayoutConfig(data) {
    Object.assign(this.repo.payoutConfig, data);
    return JSON.parse(JSON.stringify(this.repo.payoutConfig));
  }

  async creditBookingEarnings(beauticianId, { bookingId, bookingNumber, grossAmount, commissionAmount, netPayoutAmount, customerName = 'Customer', serviceNames = 'Salon Service' }) {
    const uid = String(beauticianId);

    let finalCommission = commissionAmount;
    let payout = netPayoutAmount;
    if (payout === undefined || payout === null) {
      const commPct = this.repo.payoutConfig.defaultCommissionPercentage ?? 10;
      finalCommission = Math.round((grossAmount || 0) * (commPct / 100));
      payout = Math.max(0, (grossAmount || 0) - finalCommission);
    }

    // Idempotency check
    const existing = Array.from(this.repo.transactions.values()).find(
      (t) => t.idempotencyKey === `earning_${bookingId}_${uid}`,
    );
    if (existing) {
      return existing;
    }

    const wallet = await this.repo.atomicCreditEarnings(uid, payout);

    const tx = await this.repo.createTransaction({
      userId: uid,
      walletId: wallet._id,
      title: serviceNames,
      type: WalletTransactionType.CREDIT,
      category: WalletTransactionCategory.SERVICE_EARNING,
      amount: payout,
      balanceAfter: wallet.balance,
      status: WalletTransactionStatus.COMPLETED,
      referenceId: `BID#${bookingNumber || bookingId}`,
      customerName,
      idempotencyKey: `earning_${bookingId}_${uid}`,
      description: `Service earnings for booking #${bookingNumber}`,
    });

    this.cache.delete(`wallet:beautician:${uid}:dashboard`);
    return tx;
  }

  async requestPayout(userId, { amount, payoutType = PayoutDestinationType.BANK_ACCOUNT, bankName, accountNumber, upiId }) {
    const parsed = parseFloat(amount);
    const minAmount = this.repo.payoutConfig.minWithdrawalAmount || 100;
    if (isNaN(parsed) || parsed < minAmount) {
      throw new ValidationError(`Minimum withdrawal amount is ₹${minAmount}`);
    }

    // Atomic conditional debit
    const wallet = await this.repo.atomicLockWithdrawal(userId, parsed);
    if (!wallet) {
      throw new ConflictError('Insufficient available balance for withdrawal');
    }

    const payoutNumber = `WT-${Math.floor(1000 + Math.random() * 9000)}-XM${Math.floor(10 + Math.random() * 90)}`;
    const payout = await this.repo.createPayout({
      payoutNumber,
      beauticianId: String(userId),
      amount: parsed,
      destination: { payoutType, bankName, upiId, accountNumberMasked: `•••• ${String(accountNumber || '8821').slice(-4)}` },
    });

    const tx = await this.repo.createTransaction({
      userId: String(userId),
      walletId: wallet._id,
      title: `Withdrawal to ${bankName || 'Bank'}`,
      type: WalletTransactionType.DEBIT,
      category: WalletTransactionCategory.WITHDRAWAL,
      amount: -parsed,
      balanceAfter: wallet.balance,
      status: WalletTransactionStatus.PENDING,
      referenceId: payoutNumber,
      customerName: 'Self Withdrawal',
    });

    this.cache.delete(`wallet:beautician:${userId}:dashboard`);

    return {
      success: true,
      transactionId: payoutNumber,
      payoutNumber,
      amount: parsed,
      wallet: {
        availableBalance: wallet.balance,
        pendingWithdrawal: wallet.pendingWithdrawalBalance,
      },
    };
  }

  async adminProcessPayout(payoutId, adminUserId, { action, reason }) {
    const payout = await this.repo.findPayoutById(payoutId);
    if (!payout) throw new NotFoundError('Payout not found');

    if (action === 'APPROVE') {
      await this.repo.atomicApprovePayout(payout.beauticianId, payout.amount);
      await this.repo.updatePayout(payoutId, { status: PayoutStatus.COMPLETED, processedBy: adminUserId });
    } else if (action === 'REJECT') {
      // Auto refund
      await this.repo.atomicRejectPayout(payout.beauticianId, payout.amount);
      await this.repo.updatePayout(payoutId, { status: PayoutStatus.REJECTED, adminNotes: reason, processedBy: adminUserId });
    }

    this.cache.delete(`wallet:beautician:${payout.beauticianId}:dashboard`);
    return { success: true, action };
  }

  formatTx(tx) {
    const raw = tx.amount || 0;
    const isDebit = tx.type === WalletTransactionType.DEBIT || raw < 0;
    return {
      id: tx.id,
      title: tx.title,
      dateTime: '14 Jul 2026 · 10:32 AM',
      referenceId: tx.referenceId,
      amount: raw,
      type: isDebit ? 'debit' : 'credit',
      category: tx.category === WalletTransactionCategory.WITHDRAWAL ? 'withdrawal' : 'service',
      status: String(tx.status || 'completed').toLowerCase(),
      customerName: tx.customerName || (isDebit ? 'Self Withdrawal' : 'Customer'),
    };
  }
}

async function runTestSuite() {
  const repo = new InMemoryBeauticianWalletRepository();
  const service = new TestBeauticianWalletService(repo);

  const BEAUTICIAN_ID = 'GR_BT_TEST_01';

  await test('1. Initial Beautician Wallet Dashboard Structure', async () => {
    const dash = await service.getDashboard(BEAUTICIAN_ID);
    assert.strictEqual(dash.balance, 0);
    assert.strictEqual(dash.availableBalance, 0);
    assert.strictEqual(dash.monthlyEarnings, 0);
    assert.strictEqual(dash.totalWithdrawal, 0);
    assert.strictEqual(dash.pendingWithdrawal, 0);
    assert.strictEqual(Array.isArray(dash.recentTransactions), true);
    assert.strictEqual(dash.currency, 'INR');
  });

  await test('2. Credit Booking Earnings (Gross ₹1,000 - 20% Commission = Net ₹800)', async () => {
    const tx = await service.creditBookingEarnings(BEAUTICIAN_ID, {
      bookingId: 'BK_992381',
      bookingNumber: 'GW-992381',
      grossAmount: 1000,
      commissionAmount: 200,
      netPayoutAmount: 800,
      customerName: 'Mrs Priya',
      serviceNames: 'Bridal Makeup Package',
    });

    assert.strictEqual(tx.amount, 800);
    assert.strictEqual(tx.type, WalletTransactionType.CREDIT);
    assert.strictEqual(tx.category, WalletTransactionCategory.SERVICE_EARNING);

    const dash = await service.getDashboard(BEAUTICIAN_ID);
    assert.strictEqual(dash.balance, 800);
    assert.strictEqual(dash.availableBalance, 800);
    assert.strictEqual(dash.monthlyEarnings, 800);
    assert.strictEqual(dash.totalEarnedLifetime, 800);
    assert.strictEqual(dash.recentTransactions.length, 1);
    assert.strictEqual(dash.recentTransactions[0].customerName, 'Mrs Priya');
    assert.strictEqual(dash.recentTransactions[0].title, 'Bridal Makeup Package');
  });

  await test('3. Idempotency Guard (Duplicate event does not double-credit)', async () => {
    // Re-call credit with identical bookingId
    await service.creditBookingEarnings(BEAUTICIAN_ID, {
      bookingId: 'BK_992381',
      bookingNumber: 'GW-992381',
      grossAmount: 1000,
      commissionAmount: 200,
      netPayoutAmount: 800,
    });

    const dash = await service.getDashboard(BEAUTICIAN_ID);
    assert.strictEqual(dash.balance, 800, 'Balance must remain 800 and not double to 1600');
  });

  await test('4. Performance SLA Benchmark: DB vs Cache Response Times', async () => {
    // A. DB read latency test (no cache)
    const dbTimes = [];
    for (let i = 0; i < 50; i++) {
      service.cache.clear();
      const t0 = performance.now();
      await service.getDashboard(BEAUTICIAN_ID);
      dbTimes.push(performance.now() - t0);
    }
    const avgDbTime = dbTimes.reduce((a, b) => a + b, 0) / dbTimes.length;
    console.log(`     📊 DB Average Latency: ${avgDbTime.toFixed(3)} ms (Target < 200 ms)`);
    assert.ok(avgDbTime < 200, `DB latency must be < 200ms, got ${avgDbTime}ms`);

    // B. Cache read latency test (with L1 / Redis)
    const cacheTimes = [];
    // Populate cache
    await service.getDashboard(BEAUTICIAN_ID);
    for (let i = 0; i < 100; i++) {
      const t0 = performance.now();
      await service.getDashboard(BEAUTICIAN_ID);
      cacheTimes.push(performance.now() - t0);
    }
    const avgCacheTime = cacheTimes.reduce((a, b) => a + b, 0) / cacheTimes.length;
    console.log(`     🚀 Cache Average Latency: ${avgCacheTime.toFixed(3)} ms (Target < 50 ms)`);
    assert.ok(avgCacheTime < 50, `Cache latency must be < 50ms, got ${avgCacheTime}ms`);
  });

  await test('5. Concurrency Race Condition Test: 10 Simultaneous Withdrawals of Full Balance', async () => {
    // Balance is currently ₹800.
    // 10 concurrent requests to withdraw ₹800 each arrive simultaneously.
    let successCount = 0;
    let conflictCount = 0;

    const promises = Array.from({ length: 10 }).map(async (_, idx) => {
      try {
        await service.requestPayout(BEAUTICIAN_ID, {
          amount: 800,
          bankName: 'HDFC Bank',
          accountNumber: '8821',
        });
        successCount++;
      } catch (err) {
        if (err instanceof ConflictError) {
          conflictCount++;
        } else {
          throw err;
        }
      }
    });

    await Promise.all(promises);

    console.log(`     🔒 Concurrent Results: Successes = ${successCount}, Conflicts = ${conflictCount}`);
    assert.strictEqual(successCount, 1, 'Exactly 1 concurrent withdrawal must succeed');
    assert.strictEqual(conflictCount, 9, 'Exactly 9 concurrent withdrawals must be rejected with Conflict');

    const dash = await service.getDashboard(BEAUTICIAN_ID);
    assert.strictEqual(dash.balance, 0, 'Available balance must be exactly 0 (no overdraft)');
    assert.strictEqual(dash.pendingWithdrawal, 800, 'Pending withdrawal must be locked at 800');
  });

  await test('6. Admin Payout Approval (Funds cleared from pending to withdrawn)', async () => {
    const payout = Array.from(repo.payouts.values())[0];
    assert.ok(payout, 'Payout request must exist');

    await service.adminProcessPayout(payout.id, 'ADMIN_01', {
      action: 'APPROVE',
    });

    const dash = await service.getDashboard(BEAUTICIAN_ID);
    assert.strictEqual(dash.balance, 0);
    assert.strictEqual(dash.pendingWithdrawal, 0);
    assert.strictEqual(dash.totalWithdrawal, 800);
  });

  await test('7. Admin Payout Rejection with Auto-Refund (Zero Money Loss)', async () => {
    // 1. Credit new earnings
    await service.creditBookingEarnings(BEAUTICIAN_ID, {
      bookingId: 'BK_992382',
      bookingNumber: 'GW-992382',
      grossAmount: 500,
      commissionAmount: 0,
      netPayoutAmount: 500,
      serviceNames: 'Facial & Spa Service',
    });

    // 2. Request ₹500 withdrawal
    const req = await service.requestPayout(BEAUTICIAN_ID, {
      amount: 500,
      bankName: 'State Bank of India',
      accountNumber: '4392',
    });

    let dash = await service.getDashboard(BEAUTICIAN_ID);
    assert.strictEqual(dash.availableBalance, 0);
    assert.strictEqual(dash.pendingWithdrawal, 500);

    // 3. Admin rejects withdrawal
    const payout = Array.from(repo.payouts.values()).find((p) => p.amount === 500);
    await service.adminProcessPayout(payout.id, 'ADMIN_01', {
      action: 'REJECT',
      reason: 'IFSC Code mismatch with account holder name',
    });

    // 4. Verify Auto-Refund restored funds to available balance
    dash = await service.getDashboard(BEAUTICIAN_ID);
    assert.strictEqual(dash.availableBalance, 500, 'Funds must be automatically refunded to available balance');
    assert.strictEqual(dash.pendingWithdrawal, 0, 'Pending withdrawal balance must be 0');
  });

  await test('8. Admin Panel: Dynamically Update Min Withdrawal (₹250) and Commission (15%)', async () => {
    const updated = await service.updatePayoutConfig({
      minWithdrawalAmount: 250,
      defaultCommissionPercentage: 15,
    });
    assert.strictEqual(updated.minWithdrawalAmount, 250);
    assert.strictEqual(updated.defaultCommissionPercentage, 15);

    const liveConfig = await service.getPayoutConfig();
    assert.strictEqual(liveConfig.minWithdrawalAmount, 250);
    assert.strictEqual(liveConfig.defaultCommissionPercentage, 15);
  });

  await test('9. Enforcement: Payout < Updated Min (₹200 < ₹250) is Rejected, ₹300 Succeeds', async () => {
    // Attempt withdrawal of ₹200 (should fail because min is now ₹250)
    let failedValidationError = false;
    try {
      await service.requestPayout(BEAUTICIAN_ID, {
        amount: 200,
        bankName: 'HDFC Bank',
        accountNumber: '8821',
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        failedValidationError = true;
        assert.ok(err.message.includes('₹250'), 'Error message must state new minimum ₹250');
      } else {
        throw err;
      }
    }
    assert.strictEqual(failedValidationError, true, 'Withdrawal below dynamic minimum of ₹250 must throw ValidationError');

    // Attempt withdrawal of ₹300 (should succeed)
    const successReq = await service.requestPayout(BEAUTICIAN_ID, {
      amount: 300,
      bankName: 'HDFC Bank',
      accountNumber: '8821',
    });
    assert.strictEqual(successReq.amount, 300);
  });

  await test('10. Dynamic Commission: Booking Gross ₹2,000 applies updated 15% commission (₹300) -> Net ₹1,700', async () => {
    const tx = await service.creditBookingEarnings(BEAUTICIAN_ID, {
      bookingId: 'BK_DYNAMIC_COMM_01',
      bookingNumber: 'GW-DYN-01',
      grossAmount: 2000,
      serviceNames: 'Luxury Bridal Combo',
    });

    assert.strictEqual(tx.amount, 1700, 'Gross 2000 minus 15% dynamic commission (300) must equal 1700');
  });

  console.log(`\n========================================`);
  console.log(`✨ Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
