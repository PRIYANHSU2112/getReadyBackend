import mongoose from 'mongoose';
import { PROMOTION_SCOPE, PROMOTION_BENEFIT_TYPE } from './promotion.model.js';

export const RESERVATION_STATUS = Object.freeze({
  RESERVED: 'RESERVED',
  CONFIRMED: 'CONFIRMED',
  RELEASED: 'RELEASED',
  EXPIRED: 'EXPIRED',
});

const freeItemSnapshotSchema = new mongoose.Schema(
  {
    serviceId: { type: String, required: true },
    name: { type: String, required: true },
    originalPrice: { type: Number, required: true, min: 0 },
    freeReason: { type: String, default: 'PROMOTION_BENEFIT' },
  },
  { _id: false },
);

const promotionReservationSchema = new mongoose.Schema(
  {
    reservationId: {
      type: String,
      required: true,
      unique: true,
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
      default: null,
      index: true,
    },
    cartId: {
      type: String,
      default: null,
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
      type: [freeItemSnapshotSchema],
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(RESERVATION_STATUS),
      default: RESERVATION_STATUS.RESERVED,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

// High-concurrency compound indexes
promotionReservationSchema.index({ promotionId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
promotionReservationSchema.index({ promotionId: 1, userId: 1, status: 1 });
promotionReservationSchema.index({ userPhone: 1, promotionId: 1, status: 1 }, { sparse: true });
promotionReservationSchema.index({ expiresAt: 1, status: 1 });

// Atomic per-user reservation locking to prevent concurrent double-booking of same offer
promotionReservationSchema.index(
  { promotionId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { status: 'RESERVED' } }
);
promotionReservationSchema.index(
  { promotionId: 1, userPhone: 1 },
  { unique: true, partialFilterExpression: { status: 'RESERVED', userPhone: { $type: 'string' } } }
);

promotionReservationSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const PromotionReservationModel =
  mongoose.models.PromotionReservation || mongoose.model('PromotionReservation', promotionReservationSchema);
export default PromotionReservationModel;
