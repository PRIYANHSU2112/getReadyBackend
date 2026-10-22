import mongoose from 'mongoose';

export const PLAN_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  RETIRED: 'RETIRED',
});

export const BILLING_CYCLE = Object.freeze({
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  ANNUAL: 'ANNUAL',
});

export const STACKING_RULE = Object.freeze({
  EXCLUSIVE: 'EXCLUSIVE',
  CANNOT_STACK_WITH_COUPON: 'CANNOT_STACK_WITH_COUPON',
  STACKABLE: 'STACKABLE',
});

const complimentaryServiceConfigSchema = new mongoose.Schema(
  {
    serviceId: { type: String, required: true },
    name: { type: String, required: true },
    quantityPerCycle: { type: Number, default: 1, min: 1 },
    rolloverAllowed: { type: Boolean, default: true },
    rolloverMaxDays: { type: Number, default: 60, min: 0 },
  },
  { _id: false },
);

const marketingConfigSchema = new mongoose.Schema(
  {
    badgeText: { type: String, default: 'EXCLUSIVE MEMBERSHIP' },
    heroTitle: { type: String, default: 'Get Ready. Glow Club.' },
    heroSubtitle: {
      type: String,
      default: 'One membership. Unlimited beauty. Savings that compound every visit.',
    },
    bannerImageUrl: { type: String, default: null },
    accentColor: { type: String, default: '#FBBF24' },
    perceivedWorthText: { type: String, default: '₹2,400+' },
    cartOptInTitle: { type: String, default: 'Join Glow Club & Save More Today' },
    cartOptInSubtitle: { type: String, default: 'Get 15% OFF this booking + 500 Welcome Points' },
  },
  { _id: false },
);

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    displayOrder: { type: Number, default: 0 },
  },
  { _id: false },
);

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    changedBy: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    changes: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const membershipPlanSchema = new mongoose.Schema(
  {
    planCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    displayOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    // Dynamic Pricing & Duration
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    billingCycle: {
      type: String,
      enum: Object.values(BILLING_CYCLE),
      default: BILLING_CYCLE.MONTHLY,
    },
    durationDays: {
      type: Number,
      required: true,
      default: 30,
    },
    // Dynamic Discount Rules (Configured by Admin)
    discountType: {
      type: String,
      enum: ['PERCENTAGE', 'FLAT'],
      default: 'PERCENTAGE',
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
      default: 15,
    },
    maxDiscountPerBooking: {
      type: Number,
      default: 500,
    },
    minBookingSubtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    applicableCategoryIds: {
      type: [String],
      default: [],
    },
    excludedServiceIds: {
      type: [String],
      default: [],
    },
    // Dynamic Loyalty & Welcome Perks
    loyaltyMultiplier: {
      type: Number,
      default: 2.0,
      min: 1.0,
    },
    bonusPointsOnJoin: {
      type: Number,
      default: 500,
      min: 0,
    },
    // Dynamic Complimentary Monthly Treatments (Selectable from Catalog by Admin)
    complimentaryServices: {
      type: [complimentaryServiceConfigSchema],
      default: [],
    },
    // Dynamic Family Sharing Rules
    familySharingAllowed: {
      type: Boolean,
      default: true,
    },
    maxFamilyMembers: {
      type: Number,
      default: 4,
      min: 0,
    },
    // Dynamic Stacking Policy
    stackingRule: {
      type: String,
      enum: Object.values(STACKING_RULE),
      default: STACKING_RULE.CANNOT_STACK_WITH_COUPON,
    },
    // Dynamic UI & Cart Opt-In Marketing Content (Managed from Admin)
    marketingConfig: {
      type: marketingConfigSchema,
      default: () => ({}),
    },
    // Dynamic Plan FAQs (Editable in Admin Dashboard)
    faqs: {
      type: [faqSchema],
      default: [],
    },
    // Audit Trail & Status
    status: {
      type: String,
      enum: Object.values(PLAN_STATUS),
      default: PLAN_STATUS.ACTIVE,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    auditLog: {
      type: [auditLogSchema],
      default: [],
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

membershipPlanSchema.index({ planCode: 1, status: 1, deletedAt: 1 });
membershipPlanSchema.index({ status: 1, isActive: 1, displayOrder: 1, deletedAt: 1 });

membershipPlanSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const MembershipPlanModel =
  mongoose.models.MembershipPlan || mongoose.model('MembershipPlan', membershipPlanSchema);
export default MembershipPlanModel;
