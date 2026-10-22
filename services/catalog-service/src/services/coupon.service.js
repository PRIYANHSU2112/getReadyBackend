import { AppError, HttpStatus, ErrorCodes } from '@getready/errors';

export class CouponService {
  constructor(couponRepo, eventPublisher = null) {
    this.couponRepo = couponRepo;
    this.eventPublisher = eventPublisher;
  }

  async list(query = {}) {
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '25', 10), 100);
    const skip = (page - 1) * limit;

    const filter = { deletedAt: null };
    if (query.status && query.status !== 'all' && query.status !== 'ALL') {
      filter.status = query.status.toUpperCase();
    }
    if (query.search && query.search.trim()) {
      filter.code = new RegExp(query.search.trim(), 'i');
    }

    const { items, total } = await this.couponRepo.findAndCount(filter, { skip, limit });
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async getById(id) {
    const coupon = await this.couponRepo.findById(id);
    if (!coupon) throw new AppError('Coupon not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return coupon;
  }

  async create(data) {
    const code = String(data.code || data.name || '').trim().toUpperCase();
    if (!code) throw new AppError('Coupon code is required', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);

    const discountValue = Number(data.discountValue || data.discount || 0);
    const coupon = await this.couponRepo.create({
      ...data,
      code,
      name: data.name || code,
      discountValue: discountValue > 0 ? discountValue : 100,
      discountType: data.discountType || 'FLAT',
      minOrderValue: Number(data.minOrderValue || 0),
      status: (data.status || 'ACTIVE').toUpperCase(),
    });

    return coupon;
  }

  async update(id, data) {
    const payload = { ...data };
    if (payload.code) payload.code = payload.code.trim().toUpperCase();
    if (payload.discountValue) payload.discountValue = Number(payload.discountValue);
    if (payload.discount && !payload.discountValue) {
      const parsed = parseFloat(String(payload.discount).replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed)) payload.discountValue = parsed;
    }

    const updated = await this.couponRepo.updateById(id, payload);
    if (!updated) throw new AppError('Coupon not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return updated;
  }

  async remove(id) {
    await this.couponRepo.deleteById(id);
    return true;
  }

  /**
   * Securely validate coupon with date, lifecycle, usage-limit, per-user checks and accurate discount math
   */
  async validateCoupon(code, options = {}) {
    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) {
      throw new AppError('Coupon code is required', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const orderAmount = Number(
      typeof options === 'number'
        ? options
        : options?.amount ?? options?.orderAmount ?? 0
    );
    const userId = typeof options === 'object' ? options?.userId : null;

    // 1. Fetch coupon (uses cache if available)
    const coupon = await this.couponRepo.findByCode(cleanCode, { useCache: true });
    if (!coupon) {
      throw new AppError('Invalid coupon code', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    // 2. Lifecycle & status checks
    const now = new Date();
    if (coupon.status !== 'ACTIVE' || !coupon.isActive || coupon.deletedAt) {
      throw new AppError('This coupon is currently inactive or disabled', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    if (coupon.validFrom && now < new Date(coupon.validFrom)) {
      throw new AppError('This coupon is not active yet', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    if (coupon.validTo && now > new Date(coupon.validTo)) {
      throw new AppError('This coupon has expired', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // 3. Global usage limit check
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw new AppError('Coupon usage limit has been reached', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
    }

    // 4. Minimum order value requirement
    if (coupon.minOrderValue && orderAmount < coupon.minOrderValue) {
      throw new AppError(
        `Minimum order value of ₹${coupon.minOrderValue} required for this coupon`,
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // 5. Per-user redemption limit check
    const perUserLimit = coupon.perUserLimit || 1;
    if (userId) {
      const userUsageCount = await this.couponRepo.countUserRedemptions(coupon._id || coupon.id, userId);
      if (userUsageCount >= perUserLimit) {
        throw new AppError(
          `You have already used coupon ${cleanCode} the maximum allowed times (${perUserLimit})`,
          HttpStatus.CONFLICT,
          ErrorCodes.CONFLICT
        );
      }
    }

    // 6. Precise discount calculation
    let calculatedDiscount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      calculatedDiscount = (orderAmount * Number(coupon.discountValue || 0)) / 100;
      if (coupon.maxDiscountAmount != null && coupon.maxDiscountAmount > 0) {
        calculatedDiscount = Math.min(calculatedDiscount, Number(coupon.maxDiscountAmount));
      }
    } else {
      calculatedDiscount = Number(coupon.discountValue || 0);
    }

    const discountAmount = Math.round(Math.min(calculatedDiscount, orderAmount) * 100) / 100;
    const payableAmount = Math.max(0, Math.round((orderAmount - discountAmount) * 100) / 100);

    return {
      ...coupon,
      id: coupon._id?.toString() || coupon.id,
      valid: true,
      discountAmount,
      payableAmount,
      orderAmount,
      perUserLimit,
    };
  }

  /**
   * Redeem coupon atomically for an order/booking
   */
  async redeemCoupon({ code, amount, orderAmount, userId, orderId }) {
    if (!orderId) {
      throw new AppError('orderId is required for coupon redemption', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
    if (!userId) {
      throw new AppError('userId is required for coupon redemption', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const orderValue = Number(amount ?? orderAmount ?? 0);

    // Validate coupon and calculate exact discount
    const validated = await this.validateCoupon(code, { amount: orderValue, userId });

    // Execute atomic redemption
    const result = await this.couponRepo.atomicRedeem({
      couponId: validated._id || validated.id,
      code: validated.code,
      userId,
      orderId,
      discountAmount: validated.discountAmount,
      orderAmount: orderValue,
      perUserLimit: validated.perUserLimit,
    });

    if (this.eventPublisher && typeof this.eventPublisher.publish === 'function') {
      this.eventPublisher.publish('coupon.redeemed', {
        couponCode: validated.code,
        userId,
        orderId,
        discountAmount: validated.discountAmount,
        redeemedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    return {
      success: true,
      code: validated.code,
      discountAmount: validated.discountAmount,
      payableAmount: validated.payableAmount,
      orderAmount: orderValue,
      orderId,
      redemption: result.redemption,
      alreadyRedeemed: Boolean(result.alreadyRedeemed),
    };
  }

  /**
   * Release/rollback coupon usage if booking or payment fails
   */
  async releaseCoupon({ orderId, couponId, userId, reason }) {
    if (!orderId) {
      throw new AppError('orderId is required to release coupon', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const result = await this.couponRepo.atomicRollback({
      couponId,
      orderId,
      userId,
      reason: reason || 'Order cancelled or payment failed',
    });

    if (this.eventPublisher && typeof this.eventPublisher.publish === 'function') {
      this.eventPublisher.publish('coupon.released', {
        orderId,
        couponId,
        userId,
        reason,
        releasedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    return {
      success: true,
      rolledBack: result.rolledBack,
      orderId,
      message: result.rolledBack
        ? 'Coupon usage released and restored successfully'
        : 'No active coupon redemption found for this order',
    };
  }

  async getAdminStats() {
    return this.couponRepo.getAdminStats();
  }
}

export default CouponService;
