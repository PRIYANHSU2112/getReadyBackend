import mongoose from 'mongoose';

const couponRedemptionSchema = new mongoose.Schema(
  {
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
      index: true,
    },
    couponCode: {
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
    orderId: {
      type: String,
      required: true,
      index: true,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    orderAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['APPLIED', 'REDEEMED', 'CANCELLED', 'REFUNDED'],
      default: 'REDEEMED',
      index: true,
    },
    redeemedAt: {
      type: Date,
      default: Date.now,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelReason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true },
);

// Prevent duplicate redemption for the exact same order
couponRedemptionSchema.index({ couponId: 1, orderId: 1 }, { unique: true });

// Optimize per-user redemption limit checks
couponRedemptionSchema.index({ couponId: 1, userId: 1, status: 1 });
couponRedemptionSchema.index({ userId: 1, status: 1 });

couponRedemptionSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const CouponRedemptionModel =
  mongoose.models.CouponRedemption || mongoose.model('CouponRedemption', couponRedemptionSchema);
export default CouponRedemptionModel;
