import {
  CategoryModel,
  ServiceModel,
  ServiceChangeRequestModel,
  PackageModel,
  FilterModel,
  FilterValueModel,
  HygieneKitModel,
  CouponModel,
  CouponRedemptionModel,
} from '../models/index.js';
import { catalogCache } from '../cache/catalog.cache.js';
import { AppError, HttpStatus, ErrorCodes } from '@getready/errors';

export class CategoryRepository {
  async create(data) {
    return CategoryModel.create(data);
  }

  async findActive() {
    return CategoryModel.find({ isActive: true, deletedAt: null }).sort({ displayOrder: 1, name: 1 }).lean();
  }

  async findBySlug(slug) {
    return CategoryModel.findOne({ slug: slug.toLowerCase(), deletedAt: null }).lean();
  }

  async findActiveBySlug(slug) {
    return CategoryModel.findOne({ slug: slug.toLowerCase(), isActive: true, deletedAt: null }).lean();
  }

  async findById(id) {
    return CategoryModel.findOne({ _id: id, deletedAt: null });
  }

  async updateById(id, data) {
    return CategoryModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: data }, { new: true });
  }

  async deleteById(id) {
    return CategoryModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: { deletedAt: new Date(), isActive: false } }, { new: true });
  }

  async restoreById(id) {
    return CategoryModel.findByIdAndUpdate(id, { $set: { deletedAt: null, isActive: true } }, { new: true });
  }

  async findAndCount(filter = {}, { skip = 0, limit = 10, sort = 'displayOrder' } = {}) {
    const [items, total] = await Promise.all([
      CategoryModel.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      CategoryModel.countDocuments(filter),
    ]);
    return { items, total };
  }

  async getAdminStats() {
    const [facetResults] = await CategoryModel.aggregate([
      {
        $facet: {
          total: [
            { $match: { deletedAt: null } },
            { $count: 'count' },
          ],
          active: [
            { $match: { isActive: true, deletedAt: null } },
            { $count: 'count' },
          ],
        },
      },
    ]);

    const total = facetResults.total[0]?.count || 0;
    const active = facetResults.active[0]?.count || 0;
    const totalServices = await ServiceModel.countDocuments({ deletedAt: null });

    return {
      totalCategories: total,
      activeCategories: active,
      totalLinkedServices: totalServices,
    };
  }
}

export class ServiceRepository {
  async create(data) {
    return ServiceModel.create(data);
  }

  async findActive() {
    return ServiceModel.find({ isActive: true, status: 'APPROVED', deletedAt: null }).sort({ displayOrder: 1, name: 1 }).lean();
  }

  async findActiveByCategory(categoryId) {
    return ServiceModel.find({ categoryId, isActive: true, status: 'APPROVED', deletedAt: null }).sort({ displayOrder: 1, name: 1 }).lean();
  }

  async findActiveBySlug(slug) {
    return ServiceModel.findOne({ slug: slug.toLowerCase(), isActive: true, status: 'APPROVED', deletedAt: null }).populate('categoryId').lean();
  }

  async findActiveById(id) {
    return ServiceModel.findOne({ _id: id, isActive: true, deletedAt: null }).lean();
  }

  async findById(id) {
    return ServiceModel.findOne({ _id: id, deletedAt: null }).populate('categoryId');
  }

  async updateById(id, data) {
    return ServiceModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: data }, { new: true });
  }

  async deleteById(id) {
    return ServiceModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: { deletedAt: new Date(), isActive: false } }, { new: true });
  }

  async restoreById(id) {
    return ServiceModel.findByIdAndUpdate(id, { $set: { deletedAt: null, isActive: true } }, { new: true });
  }

  async findAndCount(filter = {}, { skip = 0, limit = 10, sort = '-createdAt' } = {}) {
    const [items, total] = await Promise.all([
      ServiceModel.find(filter).populate('categoryId').sort(sort).skip(skip).limit(limit).lean().exec(),
      ServiceModel.countDocuments(filter),
    ]);
    return { items, total };
  }

  async getAdminStats({ categoryId } = {}) {
    const match = { deletedAt: null };
    if (categoryId) match.categoryId = categoryId;

    const [facetResults] = await ServiceModel.aggregate([
      { $match: match },
      {
        $facet: {
          total: [{ $count: 'count' }],
          approved: [{ $match: { status: 'APPROVED', isActive: true } }, { $count: 'count' }],
          pending: [{ $match: { status: 'PENDING_APPROVAL' } }, { $count: 'count' }],
          priceStats: [
            {
              $group: {
                _id: null,
                avgPrice: { $avg: '$price' },
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' },
              },
            },
          ],
        },
      },
    ]);

    const total = facetResults.total[0]?.count || 0;
    const approved = facetResults.approved[0]?.count || 0;
    const pending = facetResults.pending[0]?.count || 0;
    const avgPrice = Math.round(facetResults.priceStats[0]?.avgPrice || 0);

    return {
      totalServices: total,
      approvedLive: approved,
      pendingApprovals: pending,
      averageListPrice: avgPrice,
    };
  }
}

export class ServiceChangeRequestRepository {
  async create(data) {
    return ServiceChangeRequestModel.create(data);
  }

  async findById(id) {
    return ServiceChangeRequestModel.findById(id).populate('serviceId');
  }

  async findAndCount(filter = {}, { skip = 0, limit = 10, sort = '-createdAt' } = {}) {
    const [items, total] = await Promise.all([
      ServiceChangeRequestModel.find(filter).populate('serviceId').sort(sort).skip(skip).limit(limit).lean().exec(),
      ServiceChangeRequestModel.countDocuments(filter),
    ]);
    return { items, total };
  }

  async updateStatus(id, status, extra = {}) {
    return ServiceChangeRequestModel.findByIdAndUpdate(id, { $set: { status, ...extra } }, { new: true });
  }
}

export class PackageRepository {
  async create(data) {
    return PackageModel.create(data);
  }

  async findPublic() {
    return PackageModel.find({ isActive: true, status: 'APPROVED', deletedAt: null }).sort({ createdAt: -1 }).lean();
  }

  async findPublicByCategory(categoryId) {
    return PackageModel.find({ categoryId, isActive: true, status: 'APPROVED', deletedAt: null }).sort({ createdAt: -1 }).lean();
  }

  async findPublicBySlug(slug) {
    return PackageModel.findOne({ slug: slug.toLowerCase(), isActive: true, status: 'APPROVED', deletedAt: null }).lean();
  }

  async findPublicById(id) {
    return PackageModel.findOne({ _id: id, isActive: true, status: 'APPROVED', deletedAt: null }).lean();
  }

  async findById(id) {
    return PackageModel.findOne({ _id: id, deletedAt: null });
  }

  async updateById(id, data) {
    return PackageModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: data }, { new: true });
  }

  async deleteById(id) {
    return PackageModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: { deletedAt: new Date(), isActive: false } }, { new: true });
  }

  async findAndCount(filter = {}, { skip = 0, limit = 10, sort = '-createdAt' } = {}) {
    const [items, total] = await Promise.all([
      PackageModel.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      PackageModel.countDocuments(filter),
    ]);
    return { items, total };
  }

  async getAdminStats() {
    const [result] = await PackageModel.aggregate([
      { $match: { deletedAt: null } },
      {
        $facet: {
          totals: [{ $count: 'count' }],
          pending: [{ $match: { status: 'PENDING_APPROVAL' } }, { $count: 'count' }],
          approved: [{ $match: { status: 'APPROVED', isActive: true } }, { $count: 'count' }],
          partnerCreated: [{ $match: { isBeauticianCreated: true } }, { $count: 'count' }],
        },
      },
    ]);
    return {
      total: result?.totals?.[0]?.count || 0,
      pending: result?.pending?.[0]?.count || 0,
      approved: result?.approved?.[0]?.count || 0,
      partnerCreated: result?.partnerCreated?.[0]?.count || 0,
    };
  }
}

export class FilterRepository {
  async create(data) {
    return FilterModel.create(data);
  }

  async findActive() {
    return FilterModel.find({ isActive: true, deletedAt: null }).sort({ displayOrder: 1 }).lean();
  }

  async findById(id) {
    return FilterModel.findOne({ _id: id, deletedAt: null });
  }

  async updateById(id, data) {
    return FilterModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: data }, { new: true });
  }

  async deleteById(id) {
    return FilterModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: { deletedAt: new Date(), isActive: false } }, { new: true });
  }

  async restoreById(id) {
    return FilterModel.findByIdAndUpdate(id, { $set: { deletedAt: null, isActive: true } }, { new: true });
  }

  // Filter Values
  async createValue(data) {
    return FilterValueModel.create(data);
  }

  async findValuesByFilterId(filterId) {
    return FilterValueModel.find({ filterId, isActive: true, deletedAt: null }).sort({ displayOrder: 1 }).lean();
  }

  async updateValueById(id, data) {
    return FilterValueModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: data }, { new: true });
  }

  async deleteValueById(id) {
    return FilterValueModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: { deletedAt: new Date(), isActive: false } }, { new: true });
  }

  async restoreValueById(id) {
    return FilterValueModel.findByIdAndUpdate(id, { $set: { deletedAt: null, isActive: true } }, { new: true });
  }

  async getAdminStats() {
    const [filtersFacet, valuesCount] = await Promise.all([
      FilterModel.aggregate([
        { $match: { deletedAt: null } },
        {
          $facet: {
            totalFilters: [{ $count: 'count' }],
            activeFilters: [{ $match: { isActive: true } }, { $count: 'count' }],
            byDisplayType: [{ $group: { _id: '$displayType', count: { $sum: 1 } } }],
          },
        },
      ]),
      FilterValueModel.countDocuments({ deletedAt: null, isActive: true }),
    ]);

    const facet = filtersFacet[0] || {};
    return {
      totalFilters: facet.totalFilters?.[0]?.count || 0,
      activeFilters: facet.activeFilters?.[0]?.count || 0,
      totalValues: valuesCount || 0,
      types: facet.byDisplayType || [],
    };
  }
}

export class HygieneKitRepository {
  async create(data) {
    if (data.isDefault) {
      await HygieneKitModel.updateMany({}, { $set: { isDefault: false } });
    }
    return HygieneKitModel.create(data);
  }

  async findDefault() {
    return HygieneKitModel.findOne({ isDefault: true, isActive: true, deletedAt: null }).lean();
  }

  async findActive() {
    return HygieneKitModel.find({ isActive: true, deletedAt: null }).sort({ isDefault: -1, createdAt: -1 }).lean();
  }

  async findById(id) {
    return HygieneKitModel.findOne({ _id: id, deletedAt: null });
  }

  async updateById(id, data) {
    if (data.isDefault) {
      await HygieneKitModel.updateMany({}, { $set: { isDefault: false } });
    }
    return HygieneKitModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: data }, { new: true });
  }

  async deleteById(id) {
    return HygieneKitModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: { deletedAt: new Date(), isActive: false } }, { new: true });
  }

  async restoreById(id) {
    return HygieneKitModel.findByIdAndUpdate(id, { $set: { deletedAt: null, isActive: true } }, { new: true });
  }

  async setDefault(id) {
    await HygieneKitModel.updateMany({}, { $set: { isDefault: false } });
    return HygieneKitModel.findByIdAndUpdate(id, { $set: { isDefault: true, isActive: true, deletedAt: null } }, { new: true });
  }

  async findAndCount(filter = {}, { skip = 0, limit = 10 } = {}) {
    const [items, total] = await Promise.all([
      HygieneKitModel.find(filter).skip(skip).limit(limit).lean().exec(),
      HygieneKitModel.countDocuments(filter),
    ]);
    return { items, total };
  }

  async getAdminStats() {
    const [result] = await HygieneKitModel.aggregate([
      { $match: { deletedAt: null } },
      {
        $facet: {
          totalKits: [{ $count: 'count' }],
          activeKits: [{ $match: { isActive: true, status: 'ACTIVE' } }, { $count: 'count' }],
          defaultKit: [{ $match: { isDefault: true, isActive: true } }, { $limit: 1 }],
          avgPrice: [{ $group: { _id: null, avgPrice: { $avg: '$price' } } }],
        },
      },
    ]);

    const facet = result || {};
    return {
      totalKits: facet.totalKits?.[0]?.count || 0,
      activeKits: facet.activeKits?.[0]?.count || 0,
      hasDefault: (facet.defaultKit?.length || 0) > 0,
      defaultKitTitle: facet.defaultKit?.[0]?.title || null,
      defaultKitPrice: facet.defaultKit?.[0]?.price ?? 49,
      averagePrice: Math.round(facet.avgPrice?.[0]?.avgPrice || 49),
    };
  }
}

export class CouponRepository {
  async create(data) {
    const coupon = await CouponModel.create(data);
    await catalogCache.del('coupon:code:' + coupon.code);
    return coupon;
  }

  async findById(id) {
    return CouponModel.findById(id);
  }

  async findByCode(code, { useCache = false } = {}) {
    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) return null;

    const cacheKey = `coupon:code:${cleanCode}`;
    if (useCache) {
      const cached = await catalogCache.get(cacheKey);
      if (cached) return cached;
    }

    const coupon = await CouponModel.findOne({
      code: cleanCode,
      isActive: true,
      deletedAt: null,
    }).lean();

    if (coupon && useCache) {
      await catalogCache.set(cacheKey, coupon, 60); // 60s L1 TTL
    }

    return coupon;
  }

  async findAndCount(filter = {}, { skip = 0, limit = 25, sort = { createdAt: -1 } } = {}) {
    const [items, total] = await Promise.all([
      CouponModel.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      CouponModel.countDocuments(filter),
    ]);

    const formatted = items.map((c) => ({
      ...c,
      id: c._id?.toString(),
      name: c.code || c.name,
      discount: c.discountType === 'PERCENTAGE' ? `${c.discountValue}% OFF` : `₹${c.discountValue} FLAT`,
      used: c.usedCount || 0,
      status: c.status || (c.isActive ? 'ACTIVE' : 'INACTIVE'),
    }));

    return { items: formatted, total };
  }

  async updateById(id, data) {
    const updated = await CouponModel.findByIdAndUpdate(id, { $set: data }, { new: true });
    if (updated?.code) {
      await catalogCache.del('coupon:code:' + updated.code);
    }
    return updated;
  }

  async deleteById(id) {
    const deleted = await CouponModel.findByIdAndUpdate(
      id,
      { $set: { deletedAt: new Date(), isActive: false, status: 'INACTIVE' } },
      { new: true }
    );
    if (deleted?.code) {
      await catalogCache.del('coupon:code:' + deleted.code);
    }
    return deleted;
  }

  /**
   * Count active (APPLIED or REDEEMED) redemptions for a user on a given coupon
   */
  async countUserRedemptions(couponId, userId, session = null) {
    const query = CouponRedemptionModel.countDocuments({
      couponId,
      userId: String(userId),
      status: { $in: ['APPLIED', 'REDEEMED'] },
    });
    if (session) query.session(session);
    return query.exec();
  }

  /**
   * Check if a specific order has already redeemed this coupon
   */
  async findRedemptionByOrder(couponId, orderId, session = null) {
    const query = CouponRedemptionModel.findOne({
      couponId,
      orderId: String(orderId),
    });
    if (session) query.session(session);
    return query.exec();
  }

  /**
   * Atomic coupon redemption with concurrency lock and duplicate prevention
   */
  async atomicRedeem({
    couponId,
    code,
    userId,
    orderId,
    discountAmount,
    orderAmount,
    perUserLimit = 1,
    session = null,
  }) {
    const cleanCode = String(code || '').trim().toUpperCase();

    // 1. Idempotency check: if this order already redeemed this coupon, return existing redemption
    const existing = await this.findRedemptionByOrder(couponId, orderId, session);
    if (existing && ['APPLIED', 'REDEEMED'].includes(existing.status)) {
      return { success: true, redemption: existing, alreadyRedeemed: true };
    }

    // 2. Enforce per-user redemption limit
    if (userId) {
      const userUsageCount = await this.countUserRedemptions(couponId, userId, session);
      if (userUsageCount >= perUserLimit) {
        throw new AppError(
          `You have already used coupon ${cleanCode} the maximum allowed times (${perUserLimit})`,
          HttpStatus.CONFLICT,
          ErrorCodes.CONFLICT
        );
      }
    }

    // 3. Atomic increment on Coupon with strict usage limit check
    // MongoDB's document-level write lock ensures usedCount never exceeds usageLimit
    const now = new Date();
    const query = {
      _id: couponId,
      status: 'ACTIVE',
      isActive: true,
      deletedAt: null,
      validFrom: { $lte: now },
      validTo: { $gte: now },
      $expr: { $lt: ['$usedCount', '$usageLimit'] },
    };

    const updateQuery = CouponModel.findOneAndUpdate(
      query,
      { $inc: { usedCount: 1 } },
      { new: true }
    );
    if (session) updateQuery.session(session);

    const updatedCoupon = await updateQuery.exec();

    if (!updatedCoupon) {
      // Investigate why condition failed to provide clear diagnostic error
      const current = await CouponModel.findById(couponId).lean();
      if (!current || !current.isActive || current.deletedAt) {
        throw new AppError('Coupon is no longer available', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
      }
      if (current.status !== 'ACTIVE' || now > current.validTo || now < current.validFrom) {
        throw new AppError('Coupon has expired or is inactive', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
      }
      if (current.usedCount >= current.usageLimit) {
        throw new AppError('Coupon usage limit has been reached', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
      }
      throw new AppError('Coupon could not be applied at this time', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
    }

    // 4. Record audit ledger entry in CouponRedemption
    let redemption;
    if (existing) {
      // Re-activate a previously cancelled redemption for the same order
      existing.status = 'REDEEMED';
      existing.discountAmount = discountAmount;
      existing.orderAmount = orderAmount;
      existing.redeemedAt = new Date();
      existing.cancelledAt = null;
      existing.cancelReason = null;
      redemption = await existing.save({ session });
    } else {
      const docs = await CouponRedemptionModel.create(
        [
          {
            couponId,
            couponCode: cleanCode,
            userId: String(userId),
            orderId: String(orderId),
            discountAmount,
            orderAmount,
            status: 'REDEEMED',
            redeemedAt: new Date(),
          },
        ],
        session ? { session } : {}
      );
      redemption = docs[0];
    }

    // Invalidate cached coupon details
    await catalogCache.del(`coupon:code:${cleanCode}`);

    return {
      success: true,
      redemption,
      updatedCoupon,
    };
  }

  /**
   * Atomic rollback if booking/payment fails or is cancelled
   */
  async atomicRollback({ couponId, orderId, userId, reason = 'Order cancelled or payment failed', session = null }) {
    const filter = {
      orderId: String(orderId),
      status: { $in: ['APPLIED', 'REDEEMED'] },
    };
    if (couponId) filter.couponId = couponId;
    if (userId) filter.userId = String(userId);

    const updateQuery = CouponRedemptionModel.findOneAndUpdate(
      filter,
      {
        $set: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      },
      { new: true }
    );
    if (session) updateQuery.session(session);

    const redemption = await updateQuery.exec();

    if (redemption) {
      const couponUpdateQuery = CouponModel.findByIdAndUpdate(
        redemption.couponId,
        { $inc: { usedCount: -1 } },
        { new: true }
      );
      if (session) couponUpdateQuery.session(session);
      await couponUpdateQuery.exec();

      await catalogCache.del(`coupon:code:${redemption.couponCode}`);
    }

    return {
      rolledBack: Boolean(redemption),
      redemption,
    };
  }

  /**
   * Retrieve redemption history for a specific customer
   */
  async getUserRedemptions(userId, { skip = 0, limit = 20 } = {}) {
    return CouponRedemptionModel.find({ userId: String(userId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
  }

  async getAdminStats() {
    const now = new Date();
    const [facetResults] = await CouponModel.aggregate([
      { $match: { deletedAt: null } },
      {
        $facet: {
          total: [{ $count: 'count' }],
          active: [
            {
              $match: {
                isActive: true,
                status: 'ACTIVE',
                $or: [{ validTo: { $gte: now } }, { validTo: null }],
              },
            },
            { $count: 'count' },
          ],
          totalRedeemed: [{ $group: { _id: null, total: { $sum: '$usedCount' } } }],
          expired: [
            {
              $match: {
                $or: [{ status: 'EXPIRED' }, { validTo: { $lt: now } }],
              },
            },
            { $count: 'count' },
          ],
        },
      },
    ]);

    return {
      totalCoupons: facetResults.total[0]?.count || 0,
      activePromos: facetResults.active[0]?.count || 0,
      totalRedemptions: facetResults.totalRedeemed[0]?.total || 0,
      expiredCount: facetResults.expired[0]?.count || 0,
    };
  }
}

export { PromotionRepository } from './promotion.repository.js';
