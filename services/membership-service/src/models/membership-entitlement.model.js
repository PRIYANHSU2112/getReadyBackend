import mongoose from 'mongoose';

export const ENTITLEMENT_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  USED: 'USED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
});

const membershipEntitlementSchema = new mongoose.Schema(
  {
    entitlementId: {
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
    serviceId: {
      type: String,
      required: true,
      index: true,
    },
    serviceName: {
      type: String,
      required: true,
    },
    totalAllowed: {
      type: Number,
      default: 1,
      min: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    cycleStartDate: {
      type: Date,
      required: true,
    },
    cycleEndDate: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ENTITLEMENT_STATUS),
      default: ENTITLEMENT_STATUS.AVAILABLE,
      index: true,
    },
    claimedBookingId: {
      type: String,
      default: null,
      index: true,
    },
    claimedBookingIds: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

membershipEntitlementSchema.index({ userId: 1, status: 1, expiresAt: 1 });
membershipEntitlementSchema.index({ subscriptionId: 1, cycleStartDate: 1 });

membershipEntitlementSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const MembershipEntitlementModel =
  mongoose.models.MembershipEntitlement ||
  mongoose.model('MembershipEntitlement', membershipEntitlementSchema);
export default MembershipEntitlementModel;
