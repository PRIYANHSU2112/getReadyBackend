import mongoose from 'mongoose';
import { PROMOTION_SCOPE, PROMOTION_BENEFIT_TYPE } from './promotion.model.js';

export const REDEMPTION_STATUS = Object.freeze({
  REDEEMED: 'REDEEMED',
  REFUNDED: 'REFUNDED',
  CANCELLED: 'CANCELLED',
});

const freeItemAuditSchema = new mongoose.Schema(
  {
    serviceId: { type: String, required: true },
    name: { type: String, required: true },
    originalPrice: { type: Number, required: true, min: 0 },
    freeReason: { type: String, default: 'PROMOTION_BENEFIT' },
  },
  { _id: false },
);

const promotionRedemptionSchema = new mongoose.Schema(
  {
    redemptionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    reservationId: {
      type: String,
      required: true,
      index: true,
    },
    promotionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Promotion',
      required: true,
      index: true,
    },
    promotionCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    userPhone: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    orderId: {
      type: String,
      required: true,
      index: true,
    },
    scope: {
      type: String,
      enum: Object.values(PROMOTION_SCOPE),
      required: true,
    },
    benefitType: {
      type: String,
      enum: Object.values(PROMOTION_BENEFIT_TYPE),
      required: true,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    bonusCoins: {
      type: Number,
      default: 0,
      min: 0,
    },
    qualifyingItems: {
      type: Array,
      default: [],
    },
    freeItems: {
      type: [freeItemAuditSchema],
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(REDEMPTION_STATUS),
      default: REDEMPTION_STATUS.REDEEMED,
      index: true,
    },
    immutableOfferSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    redeemedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
    refundReason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true },
);

// High-concurrency compound indexes
promotionRedemptionSchema.index({ promotionId: 1, orderId: 1 }, { unique: true });
promotionRedemptionSchema.index({ promotionId: 1, userId: 1, status: 1 });
promotionRedemptionSchema.index({ userPhone: 1, promotionId: 1, status: 1 }, { sparse: true });
promotionRedemptionSchema.index({ userId: 1, redeemedAt: -1 });

promotionRedemptionSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const PromotionRedemptionModel =
  mongoose.models.PromotionRedemption || mongoose.model('PromotionRedemption', promotionRedemptionSchema);
export default PromotionRedemptionModel;
