import mongoose from 'mongoose';
import {
  WalletTransactionType,
  WalletTransactionCategory,
  WalletTransactionStatus,
} from './wallet.enum.js';

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    balance: {
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
    currency: {
      type: String,
      default: 'INR',
      trim: true,
      uppercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const walletTransactionSchema = new mongoose.Schema(
  {
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
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
    status: {
      type: String,
      enum: Object.values(WalletTransactionStatus),
      default: WalletTransactionStatus.PENDING,
      index: true,
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    points: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceAfter: {
      type: Number,
      default: 0,
      min: 0,
    },
    pointsAfter: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentGateway: {
      type: String,
      trim: true,
      default: 'SYSTEM',
    },
    razorpayOrderId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
      default: null,
    },
    razorpaySignature: {
      type: String,
      trim: true,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    referenceId: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true },
);

walletTransactionSchema.index({ walletId: 1, createdAt: -1 });
walletTransactionSchema.index({ userId: 1, createdAt: -1 });

walletSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  delete obj.__v;
  return obj;
};

walletTransactionSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  delete obj.__v;
  return obj;
};

export const WalletModel =
  mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);

export const WalletTransactionModel =
  mongoose.models.WalletTransaction ||
  mongoose.model('WalletTransaction', walletTransactionSchema);

export default WalletModel;
