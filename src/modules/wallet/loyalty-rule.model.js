import mongoose from 'mongoose';

const loyaltyRuleSchema = new mongoose.Schema(
  {
    earnRatio: {
      type: Number,
      default: 0.10,
      min: 0,
      max: 1,
      description: 'Fraction of booking amount awarded as points (e.g. 0.10 = 10%)',
    },
    redeemRatio: {
      type: Number,
      default: 0.10,
      min: 0.001,
      max: 10,
      description: 'Rupee value per 1 point (e.g. 0.10 means 10 points = ₹1, 3000 pts = ₹300)',
    },
    minPointsToRedeem: {
      type: Number,
      default: 100,
      min: 0,
      description: 'Minimum points balance required before redemption is permitted',
    },
    maxRedeemPercentage: {
      type: Number,
      default: 50,
      min: 1,
      max: 100,
      description: 'Maximum percentage of order payable using points (e.g. 50%)',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
      default: '10 Points = ₹1. Earn 10% reward points on all completed bookings.',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

export const LoyaltyRuleModel =
  mongoose.models.LoyaltyRule || mongoose.model('LoyaltyRule', loyaltyRuleSchema);
