import mongoose from 'mongoose';

export const PROMOTION_SCOPE = Object.freeze({
  WALLET_PURCHASE: 'WALLET_PURCHASE',
  SERVICE: 'SERVICE',
  PACKAGE: 'PACKAGE',
  MEMBERSHIP: 'MEMBERSHIP',
  CART: 'CART',
});

export const PROMOTION_BENEFIT_TYPE = Object.freeze({
  BONUS_COINS: 'BONUS_COINS',
  BUY_X_GET_Y: 'BUY_X_GET_Y',
  PERCENTAGE: 'PERCENTAGE',
  FLAT: 'FLAT',
  FREE_ITEM: 'FREE_ITEM',
});

export const PROMOTION_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  EXPIRED: 'EXPIRED',
});

export const PROMOTION_STACKING_RULE = Object.freeze({
  EXCLUSIVE: 'EXCLUSIVE',
  STACKABLE: 'STACKABLE',
  CANNOT_STACK_WITH_COUPON: 'CANNOT_STACK_WITH_COUPON',
});

export const BOGO_PRICING_RULE = Object.freeze({
  LOWEST_PRICED: 'LOWEST_PRICED',
  EQUAL_OR_LOWER: 'EQUAL_OR_LOWER',
  SPECIFIC_ITEMS: 'SPECIFIC_ITEMS',
});

const eligibleCoinPackSchema = new mongoose.Schema(
  {
    packId: { type: String, required: true },
    minAmount: { type: Number, required: true, min: 0 },
    bonusCoins: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    changedBy: { type: String, default: 'SYSTEM' },
    timestamp: { type: Date, default: Date.now },
    changes: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const promotionSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    scope: {
      type: String,
      enum: Object.values(PROMOTION_SCOPE),
      required: true,
      index: true,
    },
    benefitType: {
      type: String,
      enum: Object.values(PROMOTION_BENEFIT_TYPE),
      required: true,
      index: true,
    },
    eligibility: {
      applicableServiceIds: { type: [String], default: [] },
      applicableCategoryIds: { type: [String], default: [] },
      applicablePackageIds: { type: [String], default: [] },
      eligibleCoinPacks: { type: [eligibleCoinPackSchema], default: [] },
      eligibleMembershipPlanIds: { type: [String], default: [] },
      minOrderAmount: { type: Number, default: 0, min: 0 },
      minQuantity: { type: Number, default: 0, min: 0 },
      requiredMobileNumbers: { type: [String], default: [] },
    },
    bogoConfig: {
      qualifyingQuantity: { type: Number, default: 1, min: 1 },
      freeQuantity: { type: Number, default: 1, min: 1 },
      mustMatchQualifying: { type: Boolean, default: false },
      freeItemPricingRule: {
        type: String,
        enum: Object.values(BOGO_PRICING_RULE),
        default: BOGO_PRICING_RULE.LOWEST_PRICED,
      },
      eligibleFreeServiceIds: { type: [String], default: [] },
    },
    walletConfig: {
      bonusCoins: { type: Number, default: 0, min: 0 },
      bonusPercentage: { type: Number, default: 0, min: 0 },
      minCoinPurchase: { type: Number, default: 0, min: 0 },
      maxBonusCoins: { type: Number, default: null, min: 0 },
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validTo: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
    usageLimit: {
      type: Number,
      default: 1000,
      min: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    reservedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    perUserLimit: {
      type: Number,
      default: 1,
      min: 1,
    },
    priority: {
      type: Number,
      default: 0,
      index: true,
    },
    stackingRule: {
      type: String,
      enum: Object.values(PROMOTION_STACKING_RULE),
      default: PROMOTION_STACKING_RULE.CANNOT_STACK_WITH_COUPON,
    },
    status: {
      type: String,
      enum: Object.values(PROMOTION_STATUS),
      default: PROMOTION_STATUS.ACTIVE,
      index: true,
    },
    fundingPolicy: {
      type: String,
      enum: ['PLATFORM', 'VENDOR', 'SHARED'],
      default: 'PLATFORM',
    },
    isLaunchOffer: {
      type: Boolean,
      default: false,
      index: true,
    },
    auditLog: {
      type: [auditLogSchema],
      default: [],
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

// High-concurrency compound indexes
promotionSchema.index({ code: 1, status: 1, deletedAt: 1 });
promotionSchema.index({ scope: 1, status: 1, validFrom: 1, validTo: 1, deletedAt: 1 });
promotionSchema.index({ priority: -1, status: 1, deletedAt: 1 });
promotionSchema.index({ isLaunchOffer: 1, status: 1 });

promotionSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const PromotionModel = mongoose.models.Promotion || mongoose.model('Promotion', promotionSchema);
export default PromotionModel;
