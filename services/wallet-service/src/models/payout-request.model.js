import mongoose from 'mongoose';
import { PayoutStatus, PayoutDestinationType } from './wallet.enum.js';

const payoutRequestSchema = new mongoose.Schema(
  {
    payoutNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    beauticianId: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 100,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    destination: {
      payoutType: {
        type: String,
        enum: Object.values(PayoutDestinationType),
        default: PayoutDestinationType.BANK_ACCOUNT,
      },
      bankName: { type: String, default: null },
      accountNumberMasked: { type: String, default: null },
      ifscCode: { type: String, default: null },
      upiId: { type: String, default: null },
      accountHolderName: { type: String, default: null },
    },
    status: {
      type: String,
      enum: Object.values(PayoutStatus),
      default: PayoutStatus.REQUESTED,
      index: true,
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        actor: { type: String, default: 'BEAUTICIAN' },
        notes: { type: String, default: null },
      },
    ],
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WalletTransaction',
      default: null,
    },
    razorpayPayoutId: {
      type: String,
      default: null,
    },
    adminNotes: {
      type: String,
      default: null,
    },
    processedBy: {
      type: String,
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

payoutRequestSchema.index({ beauticianId: 1, createdAt: -1 });
payoutRequestSchema.index({ status: 1, createdAt: -1 });

payoutRequestSchema.pre('validate', function generatePayoutNumber(next) {
  if (!this.payoutNumber) {
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    const suffix = Math.floor(10 + Math.random() * 90);
    this.payoutNumber = `WT-${randomHex}-XM${suffix}`;
  }
  next();
});

export const PayoutRequestModel =
  mongoose.models.PayoutRequest || mongoose.model('PayoutRequest', payoutRequestSchema);
