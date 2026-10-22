import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    name: { type: String, trim: true, default: null },
    description: { type: String, trim: true, default: null },
    discountType: {
      type: String,
      enum: ['FLAT', 'PERCENTAGE'],
      default: 'FLAT',
    },
    discountValue: { type: Number, required: true, min: 0 },
    minOrderValue: { type: Number, default: 0, min: 0 },
    maxDiscountAmount: { type: Number, default: null, min: 0 },
    usageLimit: { type: Number, default: 1000, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    perUserLimit: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'EXPIRED'],
      default: 'ACTIVE',
      index: true,
    },
    validFrom: { type: Date, default: Date.now },
    validTo: { type: Date, default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
    isActive: { type: Boolean, default: true, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Compound indexes for high-concurrency validation and lookup
couponSchema.index({ code: 1, isActive: 1, status: 1, deletedAt: 1 });
couponSchema.index({ validFrom: 1, validTo: 1, status: 1 });

couponSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  obj.name = obj.code || obj.name;
  obj.discount = obj.discountType === 'PERCENTAGE' ? `${obj.discountValue}% OFF` : `₹${obj.discountValue} FLAT`;
  obj.used = obj.usedCount || 0;
  obj.status = obj.status || (obj.isActive ? 'ACTIVE' : 'INACTIVE');
  return obj;
};

export const CouponModel = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
export default CouponModel;
