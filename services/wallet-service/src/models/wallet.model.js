import mongoose from 'mongoose';
import {
  WalletType,
  WalletTransactionType,
  WalletTransactionCategory,
  WalletTransactionStatus,
} from './wallet.enum.js';

const walletTransactionSchema = new mongoose.Schema(
  {
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      default: null,
    },
    type: {
      type: String,
      enum: Object.values(WalletTransactionType),
      required: true,
    },
    category: {
      type: String,
      enum: Object.values(WalletTransactionCategory),
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    points: {
      type: Number,
      default: 0,
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    pointsBalanceAfter: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: Object.values(WalletTransactionStatus),
      default: WalletTransactionStatus.COMPLETED,
      index: true,
    },
    referenceId: {
      type: String,
      trim: true,
      sparse: true,
    },
    razorpayOrderId: {
      type: String,
      trim: true,
      sparse: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
      sparse: true,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    customerName: {
      type: String,
      trim: true,
      default: null,
    },
    bankName: {
      type: String,
      trim: true,
      default: null,
    },
    accountNumber: {
      type: String,
      trim: true,
      default: null,
    },
    upiId: {
      type: String,
      trim: true,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ userId: 1, category: 1, createdAt: -1 });

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    walletType: {
      type: String,
      enum: Object.values(WalletType),
      default: WalletType.CUSTOMER,
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    pendingWithdrawalBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalEarnedLifetime: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalWithdrawnLifetime: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentMonthEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    points: {
      type: Number,
      default: 0,
      min: 0,
    },
    cashbackBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCashbackEarned: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPointsEarned: {
      type: Number,
      default: 0,
      min: 0,
    },
    walletNumber: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
  },
  { timestamps: true },
);

walletSchema.index({ userId: 1, walletType: 1 }, { unique: true });

walletSchema.pre('save', function (next) {
  if (!this.walletNumber) {
    const prefix = this.walletType === WalletType.BEAUTICIAN ? 'GRBTW' : 'GRWAL';
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    this.walletNumber = `${prefix}${randomSuffix}`;
  }
  next();
});

walletSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj.walletNumber || (obj._id ? `GRWAL${obj._id.toString().slice(-6).toUpperCase()}` : 'GRWAL000001');
  obj.name = obj.walletNumber ? `Wallet (${obj.walletNumber})` : `Wallet #${obj.id}`;
  obj.status = obj.status || (obj.isActive ? 'ACTIVE' : 'INACTIVE');
  return obj;
};

export const WalletModel = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);
export const WalletTransactionModel =
  mongoose.models.WalletTransaction || mongoose.model('WalletTransaction', walletTransactionSchema);
