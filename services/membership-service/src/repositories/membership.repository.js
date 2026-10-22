import { randomUUID } from 'node:crypto';
import {
  MembershipPlanModel,
  UserMembershipModel,
  MembershipTransactionModel,
  MembershipEntitlementModel,
  LoyaltyLedgerModel,
  PLAN_STATUS,
  MEMBERSHIP_STATUS,
  TRANSACTION_TYPE,
  TRANSACTION_PAYMENT_STATUS,
  ENTITLEMENT_STATUS,
} from '../models/index.js';
import { membershipCache } from '../cache/membership.cache.js';
import { AppError, HttpStatus, ErrorCodes } from '@getready/errors';

export class MembershipRepository {
  /**
   * List all active plans for customer app & cart
   */
  async findActivePlans() {
    const cacheKey = 'membership:plans:active';
    const cached = await membershipCache.get(cacheKey);
    if (cached) return cached;

    const plans = await MembershipPlanModel.find({
      status: PLAN_STATUS.ACTIVE,
      isActive: true,
      deletedAt: null,
    })
      .sort({ displayOrder: 1, price: 1 })
      .lean()
      .exec();

    await membershipCache.set(cacheKey, plans, 300); // 5 min TTL
    return plans;
  }

  /**
   * Find plan by unique uppercase plan code
   */
  async findPlanByCode(planCode, session = null) {
    if (!planCode) return null;
    const cleanCode = String(planCode).trim().toUpperCase();
    const cacheKey = `membership:plan:${cleanCode}`;

    const cached = await membershipCache.get(cacheKey);
    if (cached) return cached;

    const query = MembershipPlanModel.findOne({
      planCode: cleanCode,
      deletedAt: null,
    });
    if (session) query.session(session);

    const plan = await query.lean().exec();
    if (plan && plan.status === PLAN_STATUS.ACTIVE) {
      await membershipCache.set(cacheKey, plan, 300);
    }
    return plan;
  }

  /**
   * Find plan by ID
   */
  async findPlanById(id, session = null) {
    const query = MembershipPlanModel.findOne({ _id: id, deletedAt: null });
    if (session) query.session(session);
    return query.lean().exec();
  }

  /**
   * Get active membership for a customer (cached for ultra-fast cart queries < 5ms)
   */
  async getActiveSubscriptionByUserId(userId, session = null) {
    if (!userId) return null;
    const cleanUserId = String(userId);
    const cacheKey = `membership:user:${cleanUserId}`;

    const cached = await membershipCache.get(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const query = UserMembershipModel.findOne({
      userId: cleanUserId,
      status: MEMBERSHIP_STATUS.ACTIVE,
      endDate: { $gt: now },
    });
    if (session) query.session(session);

    const subscription = await query.lean().exec();
    if (subscription) {
      await membershipCache.set(cacheKey, subscription, 60); // 60s TTL
    }
    return subscription;
  }

  /**
   * Initiate subscription (PENDING_PAYMENT status)
   */
  async initiateSubscription({
    userId,
    plan,
    paymentOrderId = null,
    idempotencyKey = null,
    session = null,
  }) {
    const cleanUserId = String(userId);

    // 1. Idempotency Check
    if (idempotencyKey) {
      const existingTx = await MembershipTransactionModel.findOne({ idempotencyKey }).lean();
      if (existingTx) {
        const existingSub = await UserMembershipModel.findOne({
          subscriptionId: existingTx.subscriptionId,
        }).lean();
        if (existingSub) {
          return { subscription: existingSub, isDuplicate: true };
        }
      }
    }

    // 2. Check if customer already has an active subscription
    const activeSub = await this.getActiveSubscriptionByUserId(cleanUserId, session);
    if (activeSub) {
      throw new AppError(
        `You already have an active ${activeSub.planCode} membership expiring on ${new Date(activeSub.endDate).toLocaleDateString()}`,
        HttpStatus.CONFLICT,
        ErrorCodes.CONFLICT,
      );
    }

    const subscriptionId = `sub_${randomUUID().replace(/-/g, '')}`;
    const transactionId = `mtx_${randomUUID().replace(/-/g, '')}`;

    // 3. Create UserMembership in PENDING_PAYMENT
    const subDocs = await UserMembershipModel.create(
      [
        {
          subscriptionId,
          userId: cleanUserId,
          planId: plan._id,
          planCode: plan.planCode,
          planSnapshot: plan,
          status: MEMBERSHIP_STATUS.PENDING_PAYMENT,
          paymentOrderId,
          autoRenew: true,
        },
      ],
      session ? { session } : {},
    );

    // 4. Create pending financial transaction
    await MembershipTransactionModel.create(
      [
        {
          transactionId,
          subscriptionId,
          userId: cleanUserId,
          type: TRANSACTION_TYPE.PURCHASE,
          amount: plan.price,
          paymentOrderId,
          paymentStatus: TRANSACTION_PAYMENT_STATUS.PENDING,
          idempotencyKey,
        },
      ],
      session ? { session } : {},
    );

    return { subscription: subDocs[0], isDuplicate: false };
  }

  /**
   * Authoritative activation upon verified payment webhook
   */
  async atomicActivateSubscription({
    subscriptionId,
    paymentId,
    paymentOrderId = null,
    session = null,
  }) {
    if (!subscriptionId) {
      throw new AppError('Subscription ID required for activation', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // 1. Idempotent check
    const existingSub = await UserMembershipModel.findOne({ subscriptionId });
    if (!existingSub) {
      throw new AppError('Membership subscription not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    if (existingSub.status === MEMBERSHIP_STATUS.ACTIVE) {
      return { subscription: existingSub, isDuplicate: true };
    }

    const plan = existingSub.planSnapshot || (await this.findPlanById(existingSub.planId, session));
    const durationDays = plan.durationDays || 30;
    const now = new Date();
    const startDate = now;
    const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // 2. Transition UserMembership to ACTIVE
    // MongoDB's partial unique index on { userId: 1, status: 'ACTIVE' } protects against race conditions
    try {
      existingSub.status = MEMBERSHIP_STATUS.ACTIVE;
      existingSub.startDate = startDate;
      existingSub.endDate = endDate;
      existingSub.paymentId = paymentId;
      if (paymentOrderId) existingSub.paymentOrderId = paymentOrderId;
      await existingSub.save(session ? { session } : {});
    } catch (err) {
      if (err.code === 11000) {
        throw new AppError(
          'Customer already has another active membership subscription',
          HttpStatus.CONFLICT,
          ErrorCodes.CONFLICT,
        );
      }
      throw err;
    }

    // 3. Create complimentary service entitlements if configured
    const entitlements = [];
    if (Array.isArray(plan.complimentaryServices) && plan.complimentaryServices.length > 0) {
      for (const comp of plan.complimentaryServices) {
        const entitlementId = `ent_${randomUUID().replace(/-/g, '')}`;
        const rolloverDays = comp.rolloverMaxDays || 60;
        const expiresAt = new Date(endDate.getTime() + rolloverDays * 24 * 60 * 60 * 1000);

        entitlements.push({
          entitlementId,
          subscriptionId: existingSub.subscriptionId,
          userId: existingSub.userId,
          serviceId: comp.serviceId,
          serviceName: comp.name,
          totalAllowed: comp.quantityPerCycle || 1,
          usedCount: 0,
          cycleStartDate: startDate,
          cycleEndDate: endDate,
          expiresAt,
          status: ENTITLEMENT_STATUS.AVAILABLE,
        });
      }

      await MembershipEntitlementModel.create(entitlements, session ? { session } : {});
    }

    // 4. Update transaction status
    if (paymentId) {
      await MembershipTransactionModel.findOneAndUpdate(
        { subscriptionId: existingSub.subscriptionId },
        {
          $set: {
            paymentId,
            paymentStatus: TRANSACTION_PAYMENT_STATUS.CAPTURED,
          },
        },
        session ? { session } : {},
      );
    }

    // 5. Invalidate caches
    await membershipCache.del(`membership:user:${existingSub.userId}`);

    return {
      subscription: existingSub,
      entitlements,
      plan,
      isDuplicate: false,
    };
  }

  /**
   * Cancel auto-renewal
   */
  async atomicCancelSubscription({ subscriptionId, userId, reason = 'Customer request', session = null }) {
    const sub = await UserMembershipModel.findOne({ subscriptionId, userId: String(userId) });
    if (!sub) {
      throw new AppError('Subscription not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    sub.autoRenew = false;
    sub.cancellationDetails = {
      cancelledAt: new Date(),
      reason,
      effectiveEndDate: sub.endDate,
    };
    await sub.save(session ? { session } : {});

    await membershipCache.del(`membership:user:${sub.userId}`);
    return sub;
  }

  /**
   * Refund subscription
   */
  async atomicRefundSubscription({ subscriptionId, reason = 'Administrative refund', refundAmount, session = null }) {
    const sub = await UserMembershipModel.findOne({ subscriptionId });
    if (!sub) {
      throw new AppError('Subscription not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    sub.status = MEMBERSHIP_STATUS.REFUNDED;
    sub.cancellationDetails = {
      cancelledAt: new Date(),
      reason,
      effectiveEndDate: new Date(),
      refundAmount: refundAmount || sub.planSnapshot?.price || 0,
    };
    await sub.save(session ? { session } : {});

    // Revoke entitlements
    await MembershipEntitlementModel.updateMany(
      { subscriptionId, status: ENTITLEMENT_STATUS.AVAILABLE },
      { $set: { status: ENTITLEMENT_STATUS.REVOKED } },
      session ? { session } : {},
    );

    // Record refund transaction
    const transactionId = `mtx_${randomUUID().replace(/-/g, '')}`;
    await MembershipTransactionModel.create(
      [
        {
          transactionId,
          subscriptionId,
          userId: sub.userId,
          type: TRANSACTION_TYPE.REFUND,
          amount: refundAmount || sub.planSnapshot?.price || 0,
          paymentStatus: TRANSACTION_PAYMENT_STATUS.REFUNDED,
          metadata: { refundReason: reason },
        },
      ],
      session ? { session } : {},
    );

    await membershipCache.del(`membership:user:${sub.userId}`);
    return sub;
  }

  /**
   * Atomically claim a complimentary entitlement for a booking
   */
  async claimEntitlement({ userId, entitlementId, bookingId, session = null }) {
    const ent = await MembershipEntitlementModel.findOne({
      entitlementId,
      userId: String(userId),
      status: ENTITLEMENT_STATUS.AVAILABLE,
      expiresAt: { $gt: new Date() },
      $expr: { $lt: ['$usedCount', '$totalAllowed'] },
    }).session(session);

    if (!ent) {
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
    await ent.save(session ? { session } : {});

    return ent;
  }

  /**
   * Find available complimentary entitlements for a subscription
   */
  async findEntitlementsBySubscription(subscriptionId) {
    if (!subscriptionId) return [];
    return MembershipEntitlementModel.find({
      subscriptionId,
      status: ENTITLEMENT_STATUS.AVAILABLE,
      expiresAt: { $gt: new Date() },
    }).lean().exec();
  }

  /**
   * Nightly expiry sweeper
   */
  async sweepExpiredSubscriptions() {
    const now = new Date();
    const expiredSubs = await UserMembershipModel.find({
      status: MEMBERSHIP_STATUS.ACTIVE,
      endDate: { $lt: now },
    }).limit(100);

    let count = 0;
    for (const sub of expiredSubs) {
      sub.status = MEMBERSHIP_STATUS.EXPIRED;
      await sub.save();
      await membershipCache.del(`membership:user:${sub.userId}`);
      count++;
    }

    // Sweep expired entitlements
    await MembershipEntitlementModel.updateMany(
      { status: ENTITLEMENT_STATUS.AVAILABLE, expiresAt: { $lt: now } },
      { $set: { status: ENTITLEMENT_STATUS.EXPIRED } },
    );

    return count;
  }

  /**
   * Admin: Plan Management CRUD
   */
  async createPlan(data, adminUser = 'ADMIN') {
    const planData = {
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
    };
    const plan = await MembershipPlanModel.create(planData);
    await membershipCache.del('membership:plans:active');
    return plan;
  }

  async updatePlan(id, updates, adminUser = 'ADMIN') {
    const existing = await MembershipPlanModel.findOne({ _id: id, deletedAt: null });
    if (!existing) {
      throw new AppError('Membership plan not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    if (updates.planCode) {
      updates.planCode = String(updates.planCode).trim().toUpperCase();
    }

    const updated = await MembershipPlanModel.findByIdAndUpdate(
      id,
      {
        $set: updates,
        $push: {
          auditLog: {
            action: 'UPDATE',
            changedBy: adminUser,
            timestamp: new Date(),
            changes: updates,
          },
        },
      },
      { new: true, runValidators: true },
    );

    await membershipCache.del('membership:plans:active');
    await membershipCache.del(`membership:plan:${existing.planCode}`);
    if (updates.planCode) await membershipCache.del(`membership:plan:${updates.planCode}`);

    return updated;
  }

  async findAllPlansAdmin() {
    return MembershipPlanModel.find({ deletedAt: null })
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean()
      .exec();
  }

  async updateSubscription(id, updates) {
    const updated = await UserMembershipModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true },
    );
    if (updated?.userId) {
      await membershipCache.del(`membership:user:${updated.userId}`);
    }
    return updated;
  }

  /**
   * Admin: List subscriptions with search, filter, pagination
   */
  async findSubscriptions(filter = {}, { skip = 0, limit = 20, sort = { createdAt: -1 } } = {}) {
    const [items, total] = await Promise.all([
      UserMembershipModel.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      UserMembershipModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  /**
   * Admin: Analytics report
   */
  async getAnalytics() {
    const now = new Date();
    const [activeCount, expiredCount, mrrAggregate] = await Promise.all([
      UserMembershipModel.countDocuments({ status: MEMBERSHIP_STATUS.ACTIVE, endDate: { $gt: now } }),
      UserMembershipModel.countDocuments({ status: MEMBERSHIP_STATUS.EXPIRED }),
      MembershipTransactionModel.aggregate([
        { $match: { paymentStatus: TRANSACTION_PAYMENT_STATUS.CAPTURED } },
        { $group: { _id: null, totalRevenue: { $sum: '$amount' } } },
      ]),
    ]);

    const totalRevenue = mrrAggregate[0]?.totalRevenue || 0;

    return {
      activeSubscribers: activeCount,
      expiredSubscribers: expiredCount,
      totalRecurringRevenue: totalRevenue,
      mrr: Math.round(activeCount * 599),
    };
  }
}

export const membershipRepository = new MembershipRepository();
export default MembershipRepository;
