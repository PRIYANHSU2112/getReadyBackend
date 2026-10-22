import Joi from 'joi';
import {
  PROMOTION_SCOPE,
  PROMOTION_BENEFIT_TYPE,
  PROMOTION_STATUS,
  PROMOTION_STACKING_RULE,
  BOGO_PRICING_RULE,
} from '../models/index.js';

export const promotionValidator = {
  quoteOffer: Joi.object({
    code: Joi.string().trim().uppercase().required(),
    scope: Joi.string().valid(...Object.values(PROMOTION_SCOPE)).default(PROMOTION_SCOPE.CART),
    userId: Joi.string().trim().optional().allow(null, ''),
    userPhone: Joi.string().trim().optional().allow(null, ''),
    items: Joi.array()
      .items(
        Joi.object({
          serviceId: Joi.string().optional(),
          id: Joi.string().optional(),
          name: Joi.string().optional(),
          price: Joi.number().min(0).optional(),
          unitPrice: Joi.number().min(0).optional(),
          quantity: Joi.number().integer().min(1).default(1),
          categoryId: Joi.string().optional().allow(null, ''),
        }),
      )
      .default([]),
    cartAmount: Joi.number().min(0).default(0),
    coinPackId: Joi.string().trim().optional().allow(null, ''),
  }),

  createReservation: Joi.object({
    code: Joi.string().trim().uppercase().required(),
    scope: Joi.string().valid(...Object.values(PROMOTION_SCOPE)).default(PROMOTION_SCOPE.CART),
    userId: Joi.string().trim().required(),
    userPhone: Joi.string().trim().optional().allow(null, ''),
    orderId: Joi.string().trim().optional().allow(null, ''),
    cartId: Joi.string().trim().optional().allow(null, ''),
    items: Joi.array()
      .items(
        Joi.object({
          serviceId: Joi.string().optional(),
          id: Joi.string().optional(),
          name: Joi.string().optional(),
          price: Joi.number().min(0).optional(),
          unitPrice: Joi.number().min(0).optional(),
          quantity: Joi.number().integer().min(1).default(1),
          categoryId: Joi.string().optional().allow(null, ''),
        }),
      )
      .default([]),
    cartAmount: Joi.number().min(0).default(0),
    coinPackId: Joi.string().trim().optional().allow(null, ''),
    idempotencyKey: Joi.string().trim().optional().allow(null, ''),
    metadata: Joi.object().optional().default({}),
  }),

  confirmReservation: Joi.object({
    orderId: Joi.string().trim().required(),
  }),

  releaseReservation: Joi.object({
    reason: Joi.string().trim().optional().default('Checkout cancelled'),
  }),

  adminCreatePromotion: Joi.object({
    code: Joi.string().trim().uppercase().required(),
    name: Joi.string().trim().required(),
    description: Joi.string().trim().optional().allow(null, ''),
    scope: Joi.string().valid(...Object.values(PROMOTION_SCOPE)).required(),
    benefitType: Joi.string().valid(...Object.values(PROMOTION_BENEFIT_TYPE)).required(),
    eligibility: Joi.object({
      applicableServiceIds: Joi.array().items(Joi.string()).default([]),
      applicableCategoryIds: Joi.array().items(Joi.string()).default([]),
      applicablePackageIds: Joi.array().items(Joi.string()).default([]),
      eligibleCoinPacks: Joi.array()
        .items(
          Joi.object({
            packId: Joi.string().required(),
            minAmount: Joi.number().min(0).required(),
            bonusCoins: Joi.number().min(0).required(),
          }),
        )
        .default([]),
      eligibleMembershipPlanIds: Joi.array().items(Joi.string()).default([]),
      minOrderAmount: Joi.number().min(0).default(0),
      minQuantity: Joi.number().min(0).default(0),
      requiredMobileNumbers: Joi.array().items(Joi.string()).default([]),
    }).default({}),
    bogoConfig: Joi.object({
      qualifyingQuantity: Joi.number().integer().min(1).default(1),
      freeQuantity: Joi.number().integer().min(1).default(1),
      mustMatchQualifying: Joi.boolean().default(false),
      freeItemPricingRule: Joi.string()
        .valid(...Object.values(BOGO_PRICING_RULE))
        .default(BOGO_PRICING_RULE.LOWEST_PRICED),
      eligibleFreeServiceIds: Joi.array().items(Joi.string()).default([]),
    }).default({}),
    walletConfig: Joi.object({
      bonusCoins: Joi.number().min(0).default(0),
      bonusPercentage: Joi.number().min(0).default(0),
      minCoinPurchase: Joi.number().min(0).default(0),
      maxBonusCoins: Joi.number().min(0).optional().allow(null),
    }).default({}),
    discountValue: Joi.number().min(0).default(0),
    maxDiscountAmount: Joi.number().min(0).optional().allow(null),
    validFrom: Joi.date().optional(),
    validTo: Joi.date().optional(),
    usageLimit: Joi.number().integer().min(1).default(1000),
    perUserLimit: Joi.number().integer().min(1).default(1),
    priority: Joi.number().integer().default(0),
    stackingRule: Joi.string()
      .valid(...Object.values(PROMOTION_STACKING_RULE))
      .default(PROMOTION_STACKING_RULE.CANNOT_STACK_WITH_COUPON),
    status: Joi.string()
      .valid(...Object.values(PROMOTION_STATUS))
      .default(PROMOTION_STATUS.ACTIVE),
    fundingPolicy: Joi.string().valid('PLATFORM', 'VENDOR', 'SHARED').default('PLATFORM'),
    isLaunchOffer: Joi.boolean().default(false),
  }),

  adminUpdatePromotion: Joi.object({
    name: Joi.string().trim().optional(),
    description: Joi.string().trim().optional().allow(null, ''),
    scope: Joi.string().valid(...Object.values(PROMOTION_SCOPE)).optional(),
    benefitType: Joi.string().valid(...Object.values(PROMOTION_BENEFIT_TYPE)).optional(),
    eligibility: Joi.object().optional(),
    bogoConfig: Joi.object().optional(),
    walletConfig: Joi.object().optional(),
    discountValue: Joi.number().min(0).optional(),
    maxDiscountAmount: Joi.number().min(0).optional().allow(null),
    validFrom: Joi.date().optional(),
    validTo: Joi.date().optional(),
    usageLimit: Joi.number().integer().min(1).optional(),
    perUserLimit: Joi.number().integer().min(1).optional(),
    priority: Joi.number().integer().optional(),
    stackingRule: Joi.string().valid(...Object.values(PROMOTION_STACKING_RULE)).optional(),
    status: Joi.string().valid(...Object.values(PROMOTION_STATUS)).optional(),
    fundingPolicy: Joi.string().valid('PLATFORM', 'VENDOR', 'SHARED').optional(),
    isLaunchOffer: Joi.boolean().optional(),
  }),

  adminStatusUpdate: Joi.object({
    status: Joi.string().valid(...Object.values(PROMOTION_STATUS)).required(),
  }),
};

export default promotionValidator;
