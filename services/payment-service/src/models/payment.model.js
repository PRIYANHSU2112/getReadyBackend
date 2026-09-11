import mongoose from 'mongoose';

export const PaymentStatus = Object.freeze({
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
});

export const PaymentMethod = Object.freeze({
  RAZORPAY: 'RAZORPAY',
  WALLET: 'WALLET',
  COD: 'COD',
});

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
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
      uppercase: true,
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      default: PaymentMethod.RAZORPAY,
    },
    razorpayOrderId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
      sparse: true,
    },
    razorpaySignature: {
      type: String,
      trim: true,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentNumber: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    failureReason: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

paymentSchema.pre('save', function (next) {
  if (!this.paymentNumber) {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    this.paymentNumber = `GRPAY${randomSuffix}`;
  }
  next();
});

paymentSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj.paymentNumber || (obj._id ? `GRPAY${obj._id.toString().slice(-6).toUpperCase()}` : 'GRPAY000001');
  obj.name = obj.paymentNumber || obj.razorpayOrderId || `Payment #${obj.id}`;
  obj.method = obj.paymentMethod || 'RAZORPAY';
  return obj;
};

export const PaymentModel = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
export default PaymentModel;
