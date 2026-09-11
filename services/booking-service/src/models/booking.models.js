import mongoose from 'mongoose';

export const BOOKING_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAYMENT_PROCESSING: 'PAYMENT_PROCESSING',
  CONFIRMED: 'CONFIRMED',
  ASSIGNMENT_PENDING: 'ASSIGNMENT_PENDING',
  PARTIALLY_ASSIGNED: 'PARTIALLY_ASSIGNED',
  ASSIGNED: 'ASSIGNED',
  ARRIVING: 'ARRIVING',
  STARTED: 'STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  SERVICES_COMPLETED: 'SERVICES_COMPLETED',
  COMPLETION_PENDING: 'COMPLETION_PENDING',
  COMPLETED: 'COMPLETED',
  RESCHEDULED: 'RESCHEDULED',
  CANCELLED: 'CANCELLED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  FAILED: 'FAILED',
});

export const ITEM_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  STARTED: 'STARTED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  SKIPPED: 'SKIPPED',
});

// 1. Slot Model
const slotSchema = new mongoose.Schema(
  {
    beauticianId: { type: String, default: null, index: true },
    serviceIds: { type: [String], default: [] },
    date: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    minBookings: { type: Number, required: true, min: 1, default: 1 },
    maxBookings: { type: Number, required: true, min: 1, default: 1 },
    bookedCount: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: ['ACTIVE', 'BLOCKED', 'CANCELLED', 'COMPLETED'],
      default: 'ACTIVE',
      index: true,
    },
    isBookable: { type: Boolean, default: true },
    notes: { type: String, trim: true, default: null },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

slotSchema.index({ date: 1, status: 1, startAt: 1 });
slotSchema.index({ beauticianId: 1, startAt: 1 });
slotSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

// 2. Participant Schema (Multi-Customer)
const bookingParticipantSchema = new mongoose.Schema(
  {
    customerProfileId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    relationship: { type: String, default: 'Self', trim: true },
    gender: { type: String, default: 'FEMALE' },
    age: { type: Number, default: null },
    mobileNumber: { type: String, default: null },
    skinType: { type: String, default: null },
    hairType: { type: String, default: null },
    allergies: { type: [String], default: [] },
    notes: { type: String, default: null },
  },
  { _id: true },
);

// 3. Booking Item Schema
const bookingItemSchema = new mongoose.Schema(
  {
    participantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    customerProfileId: { type: String, required: true },
    participantName: { type: String, required: true },
    itemType: { type: String, enum: ['SERVICE', 'PACKAGE'], default: 'SERVICE' },
    serviceId: { type: String, required: true },
    serviceName: { type: String, required: true },
    categoryId: { type: String, default: null },
    categoryName: { type: String, default: null },
    basePrice: { type: Number, required: true, min: 0 },
    upgradeServiceId: { type: String, default: null },
    upgradeServiceName: { type: String, default: null },
    upgradePriceDifference: { type: Number, default: 0, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 }, // basePrice + upgradeDifference
    quantity: { type: Number, required: true, min: 1, default: 1 },
    totalPrice: { type: Number, required: true, min: 0 },
    durationMinutes: { type: Number, required: true, default: 30 },
    assignedBeauticianId: { type: String, default: null, index: true },
    assignedBeauticianName: { type: String, default: null },
    status: {
      type: String,
      enum: Object.values(ITEM_STATUS),
      default: ITEM_STATUS.PENDING,
      index: true,
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    beauticianNotes: { type: String, default: null },
  },
  { _id: true },
);

// 4. Beautician Assignment Schema (Multi-Beautician)
const beauticianAssignmentSchema = new mongoose.Schema(
  {
    beauticianId: { type: String, required: true },
    beauticianName: { type: String, required: true },
    assignedItemIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    assignmentStatus: {
      type: String,
      enum: ['ASSIGNED', 'ARRIVED', 'STARTED', 'COMPLETED', 'REASSIGNED'],
      default: 'ASSIGNED',
    },
    assignedBy: {
      type: String,
      enum: ['AUTO', 'ADMIN', 'SYSTEM'],
      default: 'AUTO',
    },
    assignedAt: { type: Date, default: Date.now },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { _id: true },
);

// 5. Hygiene Kit Snapshot Schema
const hygieneKitSnapshotSchema = new mongoose.Schema(
  {
    hygieneKitId: { type: String, default: 'default-kit' },
    title: { type: String, default: 'Safety & Hygiene Kit' },
    unitPrice: { type: Number, required: true, min: 0, default: 49 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    total: { type: Number, required: true, min: 0, default: 49 },
  },
  { _id: false },
);

// 6. Pricing Snapshot Schema
const pricingSnapshotSchema = new mongoose.Schema(
  {
    servicesSubtotal: { type: Number, required: true, min: 0 },
    upgradesTotal: { type: Number, default: 0, min: 0 },
    hygieneKitTotal: { type: Number, required: true, min: 0, default: 49 },
    subtotal: { type: Number, required: true, min: 0 },
    membershipDiscount: { type: Number, default: 0, min: 0 },
    couponDiscount: { type: Number, default: 0, min: 0 },
    walletDeduction: { type: Number, default: 0, min: 0 },
    pointsDeduction: { type: Number, default: 0, min: 0 },
    cashbackDeduction: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    totalSavings: { type: Number, default: 0, min: 0 },
    payableAmount: { type: Number, required: true, min: 0 },
    cashbackEarned: { type: Number, default: 0, min: 0 },
    pointsEarned: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

// 7. Cancellation Details Schema
const cancellationSchema = new mongoose.Schema(
  {
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, default: null },
    reason: { type: String, default: null },
    fee: { type: Number, default: 0, min: 0 },
    feeWaived: { type: Boolean, default: false },
    waiveReason: { type: String, default: null },
  },
  { _id: false },
);

// 8. Status History Schema
const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    actor: { type: String, default: 'SYSTEM' },
    reason: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

// 9. Master Booking Schema
const bookingSchema = new mongoose.Schema(
  {
    bookingNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: { type: String, required: true, index: true },
    accountOwnerId: { type: String, required: true, index: true },
    
    schedulingMode: {
      type: String,
      enum: ['INSTANT', 'SCHEDULED'],
      default: 'SCHEDULED',
      index: true,
    },
    slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', default: null, index: true },
    scheduledDate: { type: String, required: true, index: true },
    scheduledStartTime: { type: Date, default: null },
    scheduledEndTime: { type: Date, default: null },

    preferredBeauticianCount: { type: Number, default: 1, min: 1, max: 5 },
    assignedBeauticianCount: { type: Number, default: 0, min: 0 },

    addressId: { type: String, required: true },
    addressSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },

    participants: { type: [bookingParticipantSchema], required: true },
    items: { type: [bookingItemSchema], required: true },
    beauticianAssignments: { type: [beauticianAssignmentSchema], default: [] },
    
    hygieneKit: { type: hygieneKitSnapshotSchema, required: true },
    pricing: { type: pricingSnapshotSchema, required: true },

    couponCode: { type: String, default: null },
    specialInstructions: { type: String, default: null },

    // Unified OTP Lifecycle
    startOtp: { type: String, required: true },
    startOtpVerified: { type: Boolean, default: false },
    startOtpVerifiedAt: { type: Date, default: null },
    
    endOtp: { type: String, required: true },
    endOtpVerified: { type: Boolean, default: false },
    endOtpVerifiedAt: { type: Date, default: null },
    
    otpAttempts: { type: Number, default: 0 },

    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.CONFIRMED,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['online', 'wallet', 'cod', 'mixed'],
      default: 'online',
    },
    paymentId: { type: String, default: null },
    idempotencyKey: { type: String, sparse: true, index: true },

    cancellation: { type: cancellationSchema, default: null },
    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  { timestamps: true },
);

bookingSchema.index({ accountOwnerId: 1, createdAt: -1 });
bookingSchema.index({ status: 1, scheduledDate: 1 });
bookingSchema.index({ scheduledDate: 1, 'beauticianAssignments.beauticianId': 1 });
bookingSchema.index({ scheduledDate: 1, status: 1 });
bookingSchema.index({ scheduledStartTime: 1, scheduledEndTime: 1 });
bookingSchema.index({ 'items.serviceId': 1 });
bookingSchema.index({ 'addressSnapshot.city': 1 });
bookingSchema.index({ 'addressSnapshot.pincode': 1 });

bookingSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  // Mask OTP for non-owner or return appropriately
  return obj;
};

// 10. Booking Outbox Model
const bookingOutboxSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    aggregateType: { type: String, default: 'Booking', index: true },
    aggregateId: { type: String, required: true, index: true },
    eventType: { type: String, required: true, index: true },
    eventVersion: { type: Number, default: 1 },
    routingKey: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    correlationId: { type: String, required: true },
    causationId: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PUBLISHED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// 11. Idempotency Record Model
const idempotencyRecordSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true },
    service: { type: String, required: true },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const SlotModel = mongoose.models.Slot || mongoose.model('Slot', slotSchema);
export const BookingModel = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
export const BookingOutboxModel = mongoose.models.BookingOutbox || mongoose.model('BookingOutbox', bookingOutboxSchema);
export const IdempotencyRecordModel = mongoose.models.IdempotencyRecord || mongoose.model('IdempotencyRecord', idempotencyRecordSchema);
