import mongoose from 'mongoose';

const loyaltyRuleSchema = new mongoose.Schema(
  {
    earnRatio: {
      type: Number,
      default: 0.1,
      min: 0,
      max: 1,
    },
    redeemRatio: {
      type: Number,
      default: 0.1,
      min: 0,
      max: 1,
    },
    minPointsToRedeem: {
      type: Number,
      default: 100,
      min: 0,
    },
    maxRedeemPercentage: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true },
);

export const LoyaltyRuleModel = mongoose.models.LoyaltyRule || mongoose.model('LoyaltyRule', loyaltyRuleSchema);
