import mongoose from 'mongoose';

const loyaltyLedgerSchema = new mongoose.Schema(
  {
    ledgerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    subscriptionId: {
      type: String,
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ['CREDIT', 'DEBIT'],
      required: true,
    },
    category: {
      type: String,
      enum: ['WELCOME_BONUS', 'BOOKING_REWARD_2X', 'REFERRAL', 'ADMIN_ADJUSTMENT', 'REDEMPTION'],
      required: true,
    },
    points: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    referenceId: {
      type: String,
      default: null,
      index: true,
    },
    description: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

loyaltyLedgerSchema.index({ userId: 1, createdAt: -1 });

loyaltyLedgerSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const LoyaltyLedgerModel =
  mongoose.models.LoyaltyLedger || mongoose.model('LoyaltyLedger', loyaltyLedgerSchema);
export default LoyaltyLedgerModel;
