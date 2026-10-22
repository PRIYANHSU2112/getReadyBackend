import { randomUUID } from 'node:crypto';
import {
  PromotionModel,
  PromotionReservationModel,
  PromotionRedemptionModel,
  PROMOTION_STATUS,
  RESERVATION_STATUS,
  REDEMPTION_STATUS,
} from '../models/index.js';
import { catalogCache } from '../cache/catalog.cache.js';
import { AppError, HttpStatus, ErrorCodes } from '@getready/errors';

export class PromotionRepository {
  /**
   * Find an active promotion by unique promo code
   */
  async findActiveByCode(code, session = null) {
    if (!code) return null;
    const cleanCode = String(code).trim().toUpperCase();
    const cacheKey = `promo:code:${cleanCode}`;

    const cached = await catalogCache.get(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const query = PromotionModel.findOne({
      code: cleanCode,
      status: PROMOTION_STATUS.ACTIVE,
      deletedAt: null,
      validFrom: { $lte: now },
      validTo: { $gte: now },
    });
    if (session) query.session(session);

    const promo = await query.lean().exec();
    if (promo) {
      await catalogCache.set(cacheKey, promo, 60); // 60s TTL
    }
    return promo;
  }

  /**
   * Find promotion by ID (including non-active for admin or lookup)
   */
  async findById(id, session = null) {
    const query = PromotionModel.findOne({ _id: id, deletedAt: null });
    if (session) query.session(session);
    return query.lean().exec();
  }

  /**
   * List eligible promotions for a given scope and user context
   */
  async findEligiblePromotions({ scope, date = new Date() } = {}) {
    const filter = {
      status: PROMOTION_STATUS.ACTIVE,
      deletedAt: null,
      validFrom: { $lte: date },
      validTo: { $gte: date },
    };
    if (scope) {
      filter.scope = scope;
    }

    return PromotionModel.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .lean()
      .exec();
  }

  /**
   * Count user claims (active reservations + completed redemptions)
   */
  async countUserClaims({ promotionId, userId, userPhone = null, session = null }) {
    const conditions = [];
    if (userId) conditions.push({ userId: String(userId) });
    if (userPhone) conditions.push({ userPhone: String(userPhone) });

    if (conditions.length === 0) return 0;

    const userMatch = conditions.length === 1 ? conditions[0] : { $or: conditions };

    // 1. Count active non-expired reservations
    const now = new Date();
    const resQuery = PromotionReservationModel.countDocuments({
      promotionId,
      ...userMatch,
      status: RESERVATION_STATUS.RESERVED,
      expiresAt: { $gt: now },
    });
    if (session) resQuery.session(session);

    // 2. Count completed redemptions (not refunded or cancelled)
    const redQuery = PromotionRedemptionModel.countDocuments({
      promotionId,
      ...userMatch,
      status: REDEMPTION_STATUS.REDEEMED,
    });
    if (session) redQuery.session(session);

    const [activeReservations, redemptions] = await Promise.all([
      resQuery.exec(),
      redQuery.exec(),
    ]);

    return activeReservations + redemptions;
  }

  /**
   * High-concurrency atomic reservation
   * Guaranteed zero quota over-allocation via atomic MongoDB document lock
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
    session = null,
  }) {
    const cleanCode = String(code).trim().toUpperCase();

    // 1. Idempotency Check
    if (idempotencyKey) {
      const existingRes = await PromotionReservationModel.findOne({
        promotionId,
        idempotencyKey,
      }).lean();

      if (existingRes) {
        if (existingRes.status === RESERVATION_STATUS.RESERVED && new Date() < new Date(existingRes.expiresAt)) {
          return { reservation: existingRes, isDuplicate: true };
        }
        if (existingRes.status === RESERVATION_STATUS.CONFIRMED) {
          return { reservation: existingRes, isDuplicate: true, confirmed: true };
        }
      }
    }

    // 2. Check per-user limit
    const promo = await PromotionModel.findById(promotionId).lean();
    if (!promo || promo.deletedAt || promo.status !== PROMOTION_STATUS.ACTIVE) {
      throw new AppError('Promotion is not active or available', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const perUserLimit = promo.perUserLimit || 1;
    const userClaimsCount = await this.countUserClaims({
      promotionId,
      userId,
      userPhone,
      session,
    });

    if (userClaimsCount >= perUserLimit) {
      throw new AppError(
        `You have reached the maximum claim limit (${perUserLimit}) for offer ${cleanCode}`,
        HttpStatus.CONFLICT,
        ErrorCodes.CONFLICT,
      );
    }

    // 3. Atomic document-level conditional increment for global quota
    const now = new Date();
    const condition = {
      _id: promotionId,
      status: PROMOTION_STATUS.ACTIVE,
      deletedAt: null,
      validFrom: { $lte: now },
      validTo: { $gte: now },
      $expr: {
        $lt: [{ $add: ['$usedCount', '$reservedCount'] }, '$usageLimit'],
      },
    };

    const updateQuery = PromotionModel.findOneAndUpdate(
      condition,
      { $inc: { reservedCount: 1 } },
      { new: true },
    );
    if (session) updateQuery.session(session);

    const updatedPromo = await updateQuery.exec();

    if (!updatedPromo) {
      // Pinpoint reason for rejection
      const current = await PromotionModel.findById(promotionId).lean();
      if (!current || current.deletedAt || current.status !== PROMOTION_STATUS.ACTIVE) {
        throw new AppError('Offer is no longer active', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
      }
      if (now > current.validTo || now < current.validFrom) {
        throw new AppError('Offer validity period has expired', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
      }
      if (current.usedCount + current.reservedCount >= current.usageLimit) {
        throw new AppError(
          'Offer capacity has been completely exhausted',
          HttpStatus.CONFLICT,
          ErrorCodes.CONFLICT,
        );
      }
      throw new AppError('Unable to reserve offer capacity', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
    }

    // 4. Create PromotionReservation record
    const reservationId = `res_${randomUUID().replace(/-/g, '')}`;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    let resDocs;
    try {
      resDocs = await PromotionReservationModel.create(
        [
          {
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
          },
        ],
        session ? { session } : {},
      );
    } catch (err) {
      // Revert reservedCount increment if unique constraint on active user reservation triggered
      await PromotionModel.findByIdAndUpdate(promotionId, { $inc: { reservedCount: -1 } }, session ? { session } : {});
      if (err.code === 11000) {
        throw new AppError(
          `You already have an active in-flight reservation for offer ${cleanCode}`,
          HttpStatus.CONFLICT,
          ErrorCodes.CONFLICT,
        );
      }
      throw err;
    }

    const reservation = resDocs[0];
    await catalogCache.del(`promo:code:${cleanCode}`);

    return { reservation, isDuplicate: false, updatedPromo };
  }

  /**
   * Atomic confirmation upon successful payment or booking
   */
  async atomicConfirm({ reservationId, orderId, session = null }) {
    if (!reservationId) {
      throw new AppError('Reservation ID is required for confirmation', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // 1. Look up reservation
    const resQuery = PromotionReservationModel.findOne({ reservationId });
    if (session) resQuery.session(session);
    const reservation = await resQuery.exec();

    if (!reservation) {
      throw new AppError('Promotion reservation not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    // Idempotency: if already confirmed for this order, return existing redemption
    if (reservation.status === RESERVATION_STATUS.CONFIRMED) {
      const redQuery = PromotionRedemptionModel.findOne({ reservationId });
      if (session) redQuery.session(session);
      const existingRedemption = await redQuery.lean().exec();
      return {
        confirmed: true,
        isDuplicate: true,
        reservation,
        redemption: existingRedemption,
      };
    }

    if (reservation.status === RESERVATION_STATUS.RELEASED) {
      throw new AppError('Reservation has already been released', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    if (reservation.status === RESERVATION_STATUS.EXPIRED || new Date() > new Date(reservation.expiresAt)) {
      throw new AppError('Promotion reservation has expired', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // 2. Atomically shift counters on Promotion (reservedCount - 1, usedCount + 1)
    const promoUpdateQuery = PromotionModel.findOneAndUpdate(
      {
        _id: reservation.promotionId,
        reservedCount: { $gt: 0 },
      },
      {
        $inc: { reservedCount: -1, usedCount: 1 },
      },
      { new: true },
    );
    if (session) promoUpdateQuery.session(session);
    const updatedPromo = await promoUpdateQuery.exec();

    if (!updatedPromo) {
      // Fallback: increment usedCount if reservedCount was already decremented by edge race
      await PromotionModel.findByIdAndUpdate(reservation.promotionId, { $inc: { usedCount: 1 } }, session ? { session } : {});
    }

    // 3. Mark reservation CONFIRMED
    reservation.status = RESERVATION_STATUS.CONFIRMED;
    if (orderId) reservation.orderId = String(orderId);
    await reservation.save(session ? { session } : {});

    // 4. Capture immutable snapshot terms
    const promoSnapshot = await PromotionModel.findById(reservation.promotionId).lean();

    // 5. Create immutable audit redemption ledger entry
    const redemptionId = `red_${randomUUID().replace(/-/g, '')}`;
    const redDocs = await PromotionRedemptionModel.create(
      [
        {
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
          qualifyingItems: reservation.qualifyingItems,
          freeItems: reservation.freeItems,
          status: REDEMPTION_STATUS.REDEEMED,
          immutableOfferSnapshot: promoSnapshot || {},
          redeemedAt: new Date(),
        },
      ],
      session ? { session } : {},
    );

    const redemption = redDocs[0];
    await catalogCache.del(`promo:code:${reservation.promotionCode}`);

    return {
      confirmed: true,
      isDuplicate: false,
      reservation,
      redemption,
    };
  }

  /**
   * Atomic release of reservation if checkout is abandoned or payment fails
   */
  async atomicRelease({ reservationId, reason = 'Checkout cancelled', session = null }) {
    const resQuery = PromotionReservationModel.findOne({ reservationId });
    if (session) resQuery.session(session);
    const reservation = await resQuery.exec();

    if (!reservation) {
      return { released: false, message: 'Reservation not found' };
    }

    if (reservation.status === RESERVATION_STATUS.RELEASED) {
      return { released: true, isDuplicate: true, reservation };
    }

    if (reservation.status === RESERVATION_STATUS.CONFIRMED) {
      throw new AppError('Cannot release a confirmed reservation. Use refund instead.', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // Mark reservation RELEASED
    reservation.status = RESERVATION_STATUS.RELEASED;
    reservation.metadata = { ...(reservation.metadata || {}), releaseReason: reason, releasedAt: new Date() };
    await reservation.save(session ? { session } : {});

    // Decrement reservedCount atomically
    const promoUpdate = PromotionModel.findOneAndUpdate(
      { _id: reservation.promotionId, reservedCount: { $gt: 0 } },
      { $inc: { reservedCount: -1 } },
      { new: true },
    );
    if (session) promoUpdate.session(session);
    await promoUpdate.exec();

    await catalogCache.del(`promo:code:${reservation.promotionCode}`);

    return { released: true, reservation };
  }

  /**
   * Atomic refund / compensation handler
   */
  async atomicRefund({ redemptionId, orderId, reason = 'Order cancelled or refunded', session = null }) {
    const filter = {};
    if (redemptionId) filter.redemptionId = redemptionId;
    if (orderId) filter.orderId = String(orderId);
    filter.status = REDEMPTION_STATUS.REDEEMED;

    const redQuery = PromotionRedemptionModel.findOne(filter);
    if (session) redQuery.session(session);
    const redemption = await redQuery.exec();

    if (!redemption) {
      return { refunded: false, message: 'Active redemption record not found' };
    }

    redemption.status = REDEMPTION_STATUS.REFUNDED;
    redemption.refundedAt = new Date();
    redemption.refundReason = reason;
    await redemption.save(session ? { session } : {});

    // Decrement usedCount on promotion
    const promoUpdate = PromotionModel.findOneAndUpdate(
      { _id: redemption.promotionId, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } },
      { new: true },
    );
    if (session) promoUpdate.session(session);
    await promoUpdate.exec();

    await catalogCache.del(`promo:code:${redemption.promotionCode}`);

    return { refunded: true, redemption };
  }

  /**
   * Sweep expired reservations and release capacity safely
   */
  async sweepExpiredReservations() {
    const now = new Date();
    const expiredReservations = await PromotionReservationModel.find({
      status: RESERVATION_STATUS.RESERVED,
      expiresAt: { $lt: now },
    }).limit(200);

    let sweptCount = 0;
    for (const res of expiredReservations) {
      try {
        res.status = RESERVATION_STATUS.EXPIRED;
        await res.save();

        await PromotionModel.findOneAndUpdate(
          { _id: res.promotionId, reservedCount: { $gt: 0 } },
          { $inc: { reservedCount: -1 } },
        );
        sweptCount++;
      } catch (err) {
        // Continue sweeping remaining reservations
      }
    }

    return sweptCount;
  }

  /**
   * Customer redemption history
   */
  async getUserHistory(userId, { skip = 0, limit = 20 } = {}) {
    return PromotionRedemptionModel.find({ userId: String(userId) })
      .sort({ redeemedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
  }

  /**
   * Admin: Create campaign
   */
  async create(data, adminUser = 'ADMIN') {
    const promoData = {
      ...data,
      code: String(data.code).trim().toUpperCase(),
      auditLog: [
        {
          action: 'CREATE',
          changedBy: adminUser,
          timestamp: new Date(),
          changes: data,
        },
      ],
    };
    const promo = await PromotionModel.create(promoData);
    await catalogCache.del(`promo:code:${promo.code}`);
    return promo;
  }

  /**
   * Admin: Update campaign
   */
  async update(id, updates, adminUser = 'ADMIN') {
    const existing = await PromotionModel.findOne({ _id: id, deletedAt: null });
    if (!existing) {
      throw new AppError('Promotion not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const auditEntry = {
      action: 'UPDATE',
      changedBy: adminUser,
      timestamp: new Date(),
      changes: updates,
    };

    if (updates.code) {
      updates.code = String(updates.code).trim().toUpperCase();
    }

    const updated = await PromotionModel.findByIdAndUpdate(
      id,
      {
        $set: updates,
        $push: { auditLog: auditEntry },
      },
      { new: true, runValidators: true },
    );

    await catalogCache.del(`promo:code:${existing.code}`);
    if (updates.code && updates.code !== existing.code) {
      await catalogCache.del(`promo:code:${updates.code}`);
    }

    return updated;
  }

  /**
   * Admin: List promotions with filters and pagination
   */
  async findAndCount(filter = {}, { skip = 0, limit = 20, sort = { createdAt: -1 } } = {}) {
    const [items, total] = await Promise.all([
      PromotionModel.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      PromotionModel.countDocuments(filter).exec(),
    ]);

    return { items, total };
  }

  /**
   * Admin: Campaign analytics report
   */
  async getAnalytics(id) {
    const promo = await PromotionModel.findById(id).lean();
    if (!promo) {
      throw new AppError('Promotion not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const [redemptions, totalDiscountResult] = await Promise.all([
      PromotionRedemptionModel.countDocuments({ promotionId: id, status: REDEMPTION_STATUS.REDEEMED }),
      PromotionRedemptionModel.aggregate([
        { $match: { promotionId: promo._id, status: REDEMPTION_STATUS.REDEEMED } },
        { $group: { _id: null, totalDiscount: { $sum: '$discountAmount' }, totalCoins: { $sum: '$bonusCoins' } } },
      ]),
    ]);

    const stats = totalDiscountResult[0] || { totalDiscount: 0, totalCoins: 0 };

    return {
      promotion: promo,
      metrics: {
        usageLimit: promo.usageLimit,
        usedCount: promo.usedCount,
        reservedCount: promo.reservedCount,
        availableCapacity: Math.max(0, promo.usageLimit - (promo.usedCount + promo.reservedCount)),
        totalRedemptions: redemptions,
        totalDiscountGiven: stats.totalDiscount || 0,
        totalBonusCoinsIssued: stats.totalCoins || 0,
        conversionRate: promo.usageLimit > 0 ? ((promo.usedCount / promo.usageLimit) * 100).toFixed(2) + '%' : '0%',
      },
    };
  }
}

export const promotionRepository = new PromotionRepository();
export default PromotionRepository;
