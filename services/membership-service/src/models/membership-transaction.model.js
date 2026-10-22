import mongoose from 'mongoose';

export const TRANSACTION_TYPE = Object.freeze({
  PURCHASE: 'PURCHASE',
  RENEWAL: 'RENEWAL',
  REFUND: 'REFUND',
  UPGRADE: 'UPGRADE',
  ADMIN_ADJUSTMENT: 'ADMIN_ADJUSTMENT',
});

export const TRANSACTION_PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  CAPTURED: 'CAPTURED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
});

const membershipTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    subscriptionId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(TRANSACTION_TYPE),
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    paymentOrderId: {
      type: String,
      default: null,
      index: true,
    },
    paymentId: {
      type: String,
      default: null,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(TRANSACTION_PAYMENT_STATUS),
      default: TRANSACTION_PAYMENT_STATUS.PENDING,
      index: true,
    },
    idempotencyKey: {
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

membershipTransactionSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
membershipTransactionSchema.index({ paymentId: 1, paymentStatus: 1 }, { sparse: true });
membershipTransactionSchema.index({ userId: 1, createdAt: -1 });

membershipTransactionSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const MembershipTransactionModel =
  mongoose.models.MembershipTransaction ||
  mongoose.model('MembershipTransaction', membershipTransactionSchema);
export default MembershipTransactionModel;
