import mongoose from 'mongoose';

export const MEMBERSHIP_STATUS = Object.freeze({
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  ACTIVE: 'ACTIVE',
  GRACE_PERIOD: 'GRACE_PERIOD',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
});

const cancellationDetailsSchema = new mongoose.Schema(
  {
    cancelledAt: { type: Date, default: null },
    reason: { type: String, default: null },
    effectiveEndDate: { type: Date, default: null },
    refundAmount: { type: Number, default: 0 },
    refundReference: { type: String, default: null },
  },
  { _id: false },
);

const userMembershipSchema = new mongoose.Schema(
  {
    subscriptionId: {
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
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipPlan',
      required: true,
      index: true,
    },
    planCode: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },
    planSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(MEMBERSHIP_STATUS),
      default: MEMBERSHIP_STATUS.PENDING_PAYMENT,
      index: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
      index: true,
    },
    autoRenew: {
      type: Boolean,
      default: true,
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
    sharedWithUserIds: {
      type: [String],
      default: [],
    },
    renewalCount: {
      type: Number,
      default: 0,
    },
    cancellationDetails: {
      type: cancellationDetailsSchema,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

// High-concurrency compound index & constraint:
// Partial unique index prevents duplicate concurrent active memberships for the same customer
userMembershipSchema.index(
  { userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: MEMBERSHIP_STATUS.ACTIVE } },
);
userMembershipSchema.index({ endDate: 1, status: 1 });
userMembershipSchema.index({ subscriptionId: 1, status: 1 });

userMembershipSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const UserMembershipModel =
  mongoose.models.UserMembership || mongoose.model('UserMembership', userMembershipSchema);
export default UserMembershipModel;
