import mongoose from 'mongoose';

const payoutConfigSchema = new mongoose.Schema(
  {
    minWithdrawalAmount: {
      type: Number,
      default: 100,
      min: 1,
    },
    maxWithdrawalAmount: {
      type: Number,
      default: 50000,
      min: 100,
    },
    defaultCommissionPercentage: {
      type: Number,
      default: 10,
      min: 0,
      max: 100,
    },
    dailyWithdrawalLimit: {
      type: Number,
      default: 25000,
      min: 500,
    },
    allowUpiPayout: {
      type: Boolean,
      default: true,
    },
    allowBankPayout: {
      type: Boolean,
      default: true,
    },
    autoApproveBelowAmount: {
      type: Number,
      default: 0, // 0 = manual admin approval for all
      min: 0,
    },
    notes: {
      type: String,
      default: 'Dynamic Payout & Commission Rules configured via Admin Panel',
    },
    updatedBy: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

export const PayoutConfigModel =
  mongoose.models.PayoutConfig || mongoose.model('PayoutConfig', payoutConfigSchema);
