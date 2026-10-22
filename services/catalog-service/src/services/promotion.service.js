import {
  PromotionRepository,
  promotionRepository as defaultPromotionRepo,
} from '../repositories/promotion.repository.js';
import {
  ServiceModel,
  PackageModel,
  PROMOTION_SCOPE,
  PROMOTION_BENEFIT_TYPE,
  PROMOTION_STATUS,
  BOGO_PRICING_RULE,
} from '../models/index.js';
import { AppError, HttpStatus, ErrorCodes } from '@getready/errors';
import { logger } from '@getready/logger';

function roundToTwo(num) {
  return Math.round((Number(num) || 0) * 100) / 100;
}

export class PromotionService {
  constructor(promotionRepo = defaultPromotionRepo, eventPublisher = null) {
    this.promoRepo = promotionRepo;
    this.eventPublisher = eventPublisher;
  }

  /**
   * Helper to fetch authoritative prices for line items from DB
   */
  async resolveAuthoritativeItems(items = []) {
    if (!Array.isArray(items) || items.length === 0) return [];

    const serviceIds = items.map((i) => String(i.serviceId || i.id || i._id)).filter(Boolean);
    const services = await ServiceModel.find({ _id: { $in: serviceIds }, deletedAt: null })
      .select('_id name price categoryId')
      .lean();
    const serviceMap = new Map(services.map((s) => [s._id.toString(), s]));

    const packages = await PackageModel.find({ _id: { $in: serviceIds }, deletedAt: null })
      .select('_id name price')
      .lean();
    const packageMap = new Map(packages.map((p) => [p._id.toString(), p]));

    const resolved = [];
    for (const item of items) {
      const idStr = String(item.serviceId || item.id || item._id);
      const svc = serviceMap.get(idStr);
      const pkg = packageMap.get(idStr);

      const authoritativePrice = svc ? Number(svc.price) : pkg ? Number(pkg.price) : Number(item.price || item.unitPrice || 0);
      const name = svc ? svc.name : pkg ? pkg.name : item.name || 'Service';
      const categoryId = svc?.categoryId ? svc.categoryId.toString() : null;
      const qty = Math.max(1, Number(item.quantity) || 1);

      resolved.push({
        id: idStr,
        serviceId: idStr,
        name,
        categoryId,
        price: authoritativePrice,
        unitPrice: authoritativePrice,
        quantity: qty,
        isPackage: Boolean(pkg),
      });
    }

    return resolved;
  }

  /**
   * Calculate BOGO discount & free items with server-authoritative prices
   */
  calculateBogoBenefit({ promo, items = [] }) {
    const { bogoConfig = {}, isLaunchOffer = false } = promo;
    const qualifyingQty = bogoConfig.qualifyingQuantity || (isLaunchOffer ? 4 : 1);
    const freeQty = bogoConfig.freeQuantity || (isLaunchOffer ? 2 : 1);
    const pricingRule = bogoConfig.freeItemPricingRule || BOGO_PRICING_RULE.LOWEST_PRICED;
    const applicableServices = new Set((promo.eligibility?.applicableServiceIds || []).map(String));
    const applicableCategories = new Set((promo.eligibility?.applicableCategoryIds || []).map(String));

    // 1. Filter qualifying items
    const qualifyingUnits = [];
    for (const item of items) {
      const isServiceMatch = applicableServices.size === 0 || applicableServices.has(item.serviceId);
      const isCategoryMatch = applicableCategories.size === 0 || (item.categoryId && applicableCategories.has(item.categoryId));

      if (isServiceMatch && isCategoryMatch) {
        for (let q = 0; q < item.quantity; q++) {
          qualifyingUnits.push({
            serviceId: item.serviceId,
            name: item.name,
            originalPrice: item.price,
          });
        }
      }
    }

    if (qualifyingUnits.length === 0) {
      return {
        isEligible: false,
        reason: 'No qualifying items found in cart for this offer',
        discountAmount: 0,
        freeItems: [],
        qualifyingItems: [],
      };
    }

    // 2. Launch Offer specific rules:
    // Requires at least 4 eligible services. For every group of 4, the 2 lowest-priced items are FREE.
    if (isLaunchOffer) {
      if (qualifyingUnits.length < 4) {
        return {
          isEligible: false,
          reason: `Launch Offer requires at least 4 eligible services (found ${qualifyingUnits.length})`,
          discountAmount: 0,
          freeItems: [],
          qualifyingItems: qualifyingUnits,
        };
      }

      // Sort ascending by price so lowest priced are free
      qualifyingUnits.sort((a, b) => a.originalPrice - b.originalPrice);

      const numGroups = Math.floor(qualifyingUnits.length / 4);
      const totalFreeAllowed = numGroups * 2;
      const freeItems = qualifyingUnits.slice(0, totalFreeAllowed).map((item) => ({
        ...item,
        freeReason: 'LAUNCH_OFFER_FREE_ITEM',
      }));

      const discountAmount = roundToTwo(freeItems.reduce((acc, curr) => acc + curr.originalPrice, 0));

      return {
        isEligible: true,
        discountAmount,
        freeItems,
        qualifyingItems: qualifyingUnits,
      };
    }

    // 3. Generic Buy X Get Y logic:
    // E.g. Buy 1 Get 1 (qualifyingQty: 1, freeQty: 1) -> In a set of (1+1)=2 items, 1 lowest priced is free.
    // E.g. Buy 1 Get 2 (qualifyingQty: 1, freeQty: 2) -> In a set of (1+2)=3 items, 2 lowest priced are free.
    const groupSize = qualifyingQty + freeQty;
    if (qualifyingUnits.length < groupSize) {
      return {
        isEligible: false,
        reason: `Offer requires at least ${groupSize} eligible items (found ${qualifyingUnits.length})`,
        discountAmount: 0,
        freeItems: [],
        qualifyingItems: qualifyingUnits,
      };
    }

    // Sort according to pricing rule
    if (pricingRule === BOGO_PRICING_RULE.LOWEST_PRICED || pricingRule === BOGO_PRICING_RULE.EQUAL_OR_LOWER) {
      qualifyingUnits.sort((a, b) => a.originalPrice - b.originalPrice);
    }

    const numGroups = Math.floor(qualifyingUnits.length / groupSize);
    const totalFree = numGroups * freeQty;
    const freeItems = qualifyingUnits.slice(0, totalFree).map((item) => ({
      ...item,
      freeReason: 'BOGO_BENEFIT',
    }));

    const discountAmount = roundToTwo(freeItems.reduce((acc, curr) => acc + curr.originalPrice, 0));

    return {
      isEligible: true,
      discountAmount,
      freeItems,
      qualifyingItems: qualifyingUnits,
    };
  }

  /**
   * Calculate Wallet Coin purchase bonus
   */
  calculateWalletBonus({ promo, coinPackId, purchaseAmount = 0 }) {
    const { walletConfig = {}, eligibility = {} } = promo;
    const eligiblePacks = eligibility.eligibleCoinPacks || [];

    let bonusCoins = 0;

    // Check if configured for specific coin packs
    if (eligiblePacks.length > 0) {
      const matchedPack = eligiblePacks.find((p) => String(p.packId) === String(coinPackId));
      if (!matchedPack) {
        return {
          isEligible: false,
          reason: `Coin pack ${coinPackId} is not eligible for offer ${promo.code}`,
          bonusCoins: 0,
        };
      }
      bonusCoins = matchedPack.bonusCoins;
    } else {
      // Amount / percentage based bonus
      const minAmount = walletConfig.minCoinPurchase || eligibility.minOrderAmount || 0;
      if (purchaseAmount < minAmount) {
        return {
          isEligible: false,
          reason: `Minimum coin purchase amount of ₹${minAmount} required (provided ₹${purchaseAmount})`,
          bonusCoins: 0,
        };
      }

      if (walletConfig.bonusCoins > 0) {
        bonusCoins = walletConfig.bonusCoins;
      } else if (walletConfig.bonusPercentage > 0) {
        bonusCoins = Math.floor((purchaseAmount * walletConfig.bonusPercentage) / 100);
      }

      if (walletConfig.maxBonusCoins && bonusCoins > walletConfig.maxBonusCoins) {
        bonusCoins = walletConfig.maxBonusCoins;
      }
    }

    return {
      isEligible: true,
      bonusCoins,
      purchaseAmount,
    };
  }

  /**
   * Quote an offer without reserving capacity
   * Authoritative discount calculation
   */
  async quoteOffer({
    code,
    scope = PROMOTION_SCOPE.CART,
    userId,
    userPhone = null,
    items = [],
    cartAmount = 0,
    coinPackId = null,
  }) {
    if (!code) {
      throw new AppError('Promotion code is required', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const promo = await this.promoRepo.findActiveByCode(code);
    if (!promo) {
      throw new AppError(`Promotion code '${code.toUpperCase()}' is invalid or expired`, HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    // 1. Verify Scope
    if (promo.scope !== scope) {
      throw new AppError(
        `Offer '${promo.code}' cannot be applied to ${scope}. It is only valid for ${promo.scope}`,
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    // 2. Launch Offer specific constraints:
    // Strictly 1 redemption per registered mobile number, booking scope only, no wallet coins.
    if (promo.isLaunchOffer) {
      if (scope !== PROMOTION_SCOPE.SERVICE && scope !== PROMOTION_SCOPE.CART) {
        throw new AppError('Launch Offer is only applicable on service bookings', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
      }
      if (!userPhone && !userId) {
        throw new AppError('A registered customer mobile number is required to claim the Launch Offer', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
      }
    }

    // 3. Check user claim quota
    if (userId || userPhone) {
      const claims = await this.promoRepo.countUserClaims({
        promotionId: promo._id,
        userId,
        userPhone,
      });
      if (claims >= (promo.perUserLimit || 1)) {
        throw new AppError(
          `You have already redeemed offer '${promo.code}' the maximum allowed times (${promo.perUserLimit || 1})`,
          HttpStatus.CONFLICT,
          ErrorCodes.CONFLICT,
        );
      }
    }

    // 4. Calculate Authoritative Benefit
    let discountAmount = 0;
    let bonusCoins = 0;
    let freeItems = [];
    let qualifyingItems = [];

    // Wallet Topup Offer
    if (promo.scope === PROMOTION_SCOPE.WALLET_PURCHASE || promo.benefitType === PROMOTION_BENEFIT_TYPE.BONUS_COINS) {
      const walletResult = this.calculateWalletBonus({
        promo,
        coinPackId,
        purchaseAmount: cartAmount,
      });
      if (!walletResult.isEligible) {
        throw new AppError(walletResult.reason, HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
      }
      bonusCoins = walletResult.bonusCoins;
    }
    // BOGO Service Offer
    else if (promo.benefitType === PROMOTION_BENEFIT_TYPE.BUY_X_GET_Y) {
      const resolvedItems = await this.resolveAuthoritativeItems(items);
      const bogoResult = this.calculateBogoBenefit({ promo, items: resolvedItems });
      if (!bogoResult.isEligible) {
        throw new AppError(bogoResult.reason, HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
      }
      discountAmount = bogoResult.discountAmount;
      freeItems = bogoResult.freeItems;
      qualifyingItems = bogoResult.qualifyingItems;
    }
    // Percentage / Flat / Free item cart offer
    else {
      // Validate minimum order amount
      const minOrder = promo.eligibility?.minOrderAmount || 0;
      if (cartAmount < minOrder) {
        throw new AppError(
          `Minimum order amount of ₹${minOrder} required for offer ${promo.code} (cart total: ₹${cartAmount})`,
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
        );
      }

      if (promo.benefitType === PROMOTION_BENEFIT_TYPE.PERCENTAGE) {
        discountAmount = roundToTwo((cartAmount * promo.discountValue) / 100);
        if (promo.maxDiscountAmount && discountAmount > promo.maxDiscountAmount) {
          discountAmount = promo.maxDiscountAmount;
        }
      } else if (promo.benefitType === PROMOTION_BENEFIT_TYPE.FLAT) {
        discountAmount = Math.min(cartAmount, promo.discountValue);
      }
    }

    const netPayable = Math.max(0, roundToTwo(cartAmount - discountAmount));

    return {
      isValid: true,
      promotionId: promo._id,
      code: promo.code,
      name: promo.name,
      scope: promo.scope,
      benefitType: promo.benefitType,
      discountAmount,
      bonusCoins,
      freeItems,
      qualifyingItems,
      originalAmount: cartAmount,
      netPayable,
      stackingRule: promo.stackingRule,
      isLaunchOffer: promo.isLaunchOffer,
    };
  }

  /**
   * Atomically reserve promotion capacity during checkout
   */
  async createReservation({
    code,
    scope = PROMOTION_SCOPE.CART,
    userId,
    userPhone = null,
    orderId = null,
    cartId = null,
    items = [],
    cartAmount = 0,
    coinPackId = null,
    idempotencyKey = null,
    metadata = {},
  }) {
    if (!userId) {
      throw new AppError('User ID is required to reserve an offer', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    // 1. Authoritative Quote verification first (does NOT consume capacity)
    const quote = await this.quoteOffer({
      code,
      scope,
      userId,
      userPhone,
      items,
      cartAmount,
      coinPackId,
    });

    // 2. Perform atomic capacity reservation with MongoDB document lock
    const { reservation, isDuplicate, updatedPromo } = await this.promoRepo.atomicReserve({
      promotionId: quote.promotionId,
      code: quote.code,
      userId,
      userPhone,
      orderId,
      cartId,
      scope: quote.scope,
      benefitType: quote.benefitType,
      discountAmount: quote.discountAmount,
      bonusCoins: quote.bonusCoins,
      qualifyingItems: quote.qualifyingItems,
      freeItems: quote.freeItems,
      idempotencyKey,
      metadata,
    });

    return {
      reservationId: reservation.reservationId,
      code: reservation.promotionCode,
      name: quote.name,
      status: reservation.status,
      discountAmount: reservation.discountAmount,
      bonusCoins: reservation.bonusCoins,
      freeItems: reservation.freeItems,
      netPayable: quote.netPayable,
      expiresAt: reservation.expiresAt,
      isDuplicate,
    };
  }

  /**
   * Confirm reservation upon successful booking or payment
   */
  async confirmReservation({ reservationId, orderId }) {
    const result = await this.promoRepo.atomicConfirm({ reservationId, orderId });

    if (this.eventPublisher && !result.isDuplicate) {
      try {
        await this.eventPublisher.publish('promotion.redeemed', {
          reservationId,
          orderId,
          promotionCode: result.redemption?.promotionCode,
          userId: result.redemption?.userId,
          discountAmount: result.redemption?.discountAmount,
          bonusCoins: result.redemption?.bonusCoins,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        logger.error({ err, reservationId }, 'Failed to publish promotion.redeemed event');
      }
    }

    return result;
  }

  /**
   * Release reservation when checkout is cancelled or payment fails
   */
  async releaseReservation({ reservationId, reason = 'Checkout cancelled' }) {
    return this.promoRepo.atomicRelease({ reservationId, reason });
  }

  /**
   * Compensate / refund promotion when order is cancelled or refunded
   */
  async refundRedemption({ redemptionId, orderId, reason = 'Order cancelled or refunded' }) {
    return this.promoRepo.atomicRefund({ redemptionId, orderId, reason });
  }

  /**
   * Query eligible promotions for display in User App
   */
  async getEligibleOffers({ scope, userId = null, userPhone = null }) {
    const activePromos = await this.promoRepo.findEligiblePromotions({ scope });

    const results = [];
    for (const promo of activePromos) {
      // Check remaining global capacity
      const remainingGlobal = promo.usageLimit - (promo.usedCount + promo.reservedCount);
      if (remainingGlobal <= 0) continue;

      // Check per-user limit if user is identified
      if (userId || userPhone) {
        const claims = await this.promoRepo.countUserClaims({
          promotionId: promo._id,
          userId,
          userPhone,
        });
        if (claims >= (promo.perUserLimit || 1)) continue;
      }

      results.push({
        id: promo._id.toString(),
        code: promo.code,
        name: promo.name,
        description: promo.description,
        scope: promo.scope,
        benefitType: promo.benefitType,
        discountValue: promo.discountValue,
        maxDiscountAmount: promo.maxDiscountAmount,
        minOrderAmount: promo.eligibility?.minOrderAmount || 0,
        bogoConfig: promo.bogoConfig,
        walletConfig: promo.walletConfig,
        isLaunchOffer: promo.isLaunchOffer,
        validTo: promo.validTo,
      });
    }

    return results;
  }

  /**
   * Customer redemption history
   */
  async getUserHistory(userId, pagination) {
    return this.promoRepo.getUserHistory(userId, pagination);
  }

  /**
   * Admin: Create campaign
   */
  async createPromotion(data, adminUser) {
    return this.promoRepo.create(data, adminUser);
  }

  /**
   * Admin: Update campaign
   */
  async updatePromotion(id, updates, adminUser) {
    return this.promoRepo.update(id, updates, adminUser);
  }

  /**
   * Admin: List promotions
   */
  async listPromotions(filter, pagination) {
    return this.promoRepo.findAndCount(filter, pagination);
  }

  /**
   * Admin: Analytics
   */
  async getPromotionAnalytics(id) {
    return this.promoRepo.getAnalytics(id);
  }

  /**
   * Sweep expired reservations
   */
  async sweepExpiredReservations() {
    return this.promoRepo.sweepExpiredReservations();
  }
}

export const promotionService = new PromotionService();
export default PromotionService;
