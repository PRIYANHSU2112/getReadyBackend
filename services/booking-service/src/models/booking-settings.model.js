import mongoose from 'mongoose';

const cancellationTierSchema = new mongoose.Schema(
  {
    hoursBeforeBooking: { type: Number, required: true },
    fee: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const bookingSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true, index: true },
    
    // Multi-beautician settings
    multipleBeauticianEnabled: { type: Boolean, default: true },
    maxBeauticiansPerBooking: { type: Number, default: 2, min: 1, max: 10 },
    maxCustomersPerBeautician: { type: Number, default: 4, min: 1 },
    maxServicesPerBeautician: { type: Number, default: 10, min: 1 },
    maxDurationPerBeauticianMinutes: { type: Number, default: 240, min: 30 },
    manualAssignmentEnabled: { type: Boolean, default: true },
    autoAssignmentEnabled: { type: Boolean, default: true },

    // Service upgrade settings
    serviceUpgradeEnabled: { type: Boolean, default: true },
    minUpgradeDifference: { type: Number, default: 100, min: 0 },
    maxUpgradeDifference: { type: Number, default: 200, min: 0 },

    // Hygiene kit settings
    hygieneKitMandatory: { type: Boolean, default: true },
    hygieneKitPrice: { type: Number, default: 49, min: 0 },
    hygieneKitDefaultQuantity: { type: Number, default: 1, min: 1 },
    hygieneKitTitle: { type: String, default: 'Safety & Hygiene Kit' },
    hygieneKitDescription: {
      type: String,
      default: 'Sanitized disposable cape, gloves, sanitized tools, and sealed safety pouch.',
    },
    hygieneKitIncludedItems: {
      type: [String],
      default: [
        'Single-use disposable bed sheet & cape',
        'Sterilized manicure/pedicure tools',
        'Alcohol sanitization wipes (70% IPA)',
        'Eco-friendly disposable wooden spatulas',
      ],
    },

    // Scheduling settings
    instantServiceEnabled: { type: Boolean, default: true },
    instantServiceMembersOnly: { type: Boolean, default: true },
    instantServiceMaxLeadTimeMinutes: { type: Number, default: 30, min: 15 },
    instantServiceNoticeMessage: {
      type: String,
      default: 'Instant Service – Members Only. Get your service booked within as little as 30 minutes.',
    },

    // Cancellation policy
    cancellationPolicy: {
      freeBeforeHours: { type: Number, default: 6, min: 0 },
      tier1Hours: { type: Number, default: 2, min: 0 },
      tier1Fee: { type: Number, default: 100, min: 0 },
      tier2Fee: { type: Number, default: 200, min: 0 },
      waiveIfDelayed: { type: Boolean, default: true },
      waiveIfUnassigned: { type: Boolean, default: true },
      policySummary: {
        type: String,
        default: 'Free cancellation up to 6 hours before slot. ₹100 fee between 6 to 2 hours. ₹200 fee within 2 hours. No fee if beautician is delayed or unassigned.',
      },
    },

    // Rewards & Discounts settings
    couponEnabled: { type: Boolean, default: true },
    cashbackEnabled: { type: Boolean, default: true },
    cashbackPercentage: { type: Number, default: 10, min: 0, max: 100 },
    pointsEnabled: { type: Boolean, default: true },
    pointsPercentage: { type: Number, default: 10, min: 0, max: 100 },
    
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

bookingSettingsSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const BookingSettingsModel =
  mongoose.models.BookingSettings || mongoose.model('BookingSettings', bookingSettingsSchema);

export const DEFAULT_BOOKING_SETTINGS = Object.freeze({
  multipleBeauticianEnabled: true,
  maxBeauticiansPerBooking: 2,
  maxCustomersPerBeautician: 4,
  maxServicesPerBeautician: 10,
  maxDurationPerBeauticianMinutes: 240,
  manualAssignmentEnabled: true,
  autoAssignmentEnabled: true,
  serviceUpgradeEnabled: true,
  minUpgradeDifference: 100,
  maxUpgradeDifference: 200,
  hygieneKitMandatory: true,
  hygieneKitPrice: 49,
  hygieneKitDefaultQuantity: 1,
  hygieneKitTitle: 'Safety & Hygiene Kit',
  hygieneKitDescription: 'Sanitized disposable cape, gloves, sanitized tools, and sealed safety pouch.',
  hygieneKitIncludedItems: [
    'Single-use disposable bed sheet & cape',
    'Sterilized manicure/pedicure tools',
    'Alcohol sanitization wipes (70% IPA)',
    'Eco-friendly disposable wooden spatulas',
  ],
  instantServiceEnabled: true,
  instantServiceMembersOnly: true,
  instantServiceMaxLeadTimeMinutes: 30,
  instantServiceNoticeMessage: 'Instant Service – Members Only. Get your service booked within as little as 30 minutes.',
  cancellationPolicy: {
    freeBeforeHours: 6,
    tier1Hours: 2,
    tier1Fee: 100,
    tier2Fee: 200,
    waiveIfDelayed: true,
    waiveIfUnassigned: true,
    policySummary:
      'Free cancellation up to 6 hours before slot. ₹100 fee between 6 to 2 hours. ₹200 fee within 2 hours. No fee if beautician is delayed or unassigned.',
  },
  couponEnabled: true,
  cashbackEnabled: true,
  cashbackPercentage: 10,
  pointsEnabled: true,
  pointsPercentage: 10,
});

let cachedSettings = null;

export function invalidateSettingsCache() {
  cachedSettings = null;
}

export async function getOrCreateBookingSettings() {
  if (cachedSettings) {
    return cachedSettings;
  }

  if (mongoose.connection.readyState !== 1) {
    return { ...DEFAULT_BOOKING_SETTINGS };
  }

  try {
    let settings = await BookingSettingsModel.findOne({ key: 'default' }).maxTimeMS(2000);
    if (!settings) {
      settings = await BookingSettingsModel.create({ key: 'default' });
    }
    cachedSettings = settings;
    return settings;
  } catch (err) {
    return { ...DEFAULT_BOOKING_SETTINGS };
  }
}

