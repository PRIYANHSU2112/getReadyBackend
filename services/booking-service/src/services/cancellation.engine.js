import { getOrCreateBookingSettings } from '../models/booking-settings.model.js';

export class CancellationEngine {
  /**
   * Calculate cancellation fee and policy applicability
   *
   * @param {Object} booking
   * @param {Object} options
   * @param {boolean} [options.isDelayed=false]
   * @param {Object} [options.settingsOverride]
   */
  static async calculateFee(booking, options = {}) {
    const settings = options.settingsOverride || (await getOrCreateBookingSettings());
    const policy = settings.cancellationPolicy || {
      freeBeforeHours: 6,
      tier1Hours: 2,
      tier1Fee: 100,
      tier2Fee: 200,
      waiveIfDelayed: true,
      waiveIfUnassigned: true,
    };

    // 1. Check waiver conditions
    const isUnassigned =
      !booking.beauticianAssignments ||
      booking.beauticianAssignments.length === 0 ||
      booking.status === 'ASSIGNMENT_PENDING' ||
      booking.status === 'PENDING';

    if (policy.waiveIfUnassigned && isUnassigned) {
      return {
        fee: 0,
        feeWaived: true,
        waiveReason: 'Professional was not assigned.',
        message: 'Free cancellation: Professional was not assigned in time.',
      };
    }

    if (policy.waiveIfDelayed && options.isDelayed) {
      return {
        fee: 0,
        feeWaived: true,
        waiveReason: 'Professional is delayed beyond promised time.',
        message: 'Free cancellation: Professional is delayed.',
      };
    }

    // 2. Calculate time difference from scheduled start
    const scheduledTime = booking.scheduledStartTime
      ? new Date(booking.scheduledStartTime).getTime()
      : Date.now() + 8 * 3600 * 1000; // Default fallback to future if not set
    const now = Date.now();
    const diffHours = (scheduledTime - now) / (1000 * 60 * 60);

    if (diffHours >= policy.freeBeforeHours) {
      return {
        fee: 0,
        feeWaived: false,
        waiveReason: null,
        message: `Free cancellation: Cancelled more than ${policy.freeBeforeHours} hours before scheduled time.`,
      };
    }

    if (diffHours >= policy.tier1Hours) {
      return {
        fee: policy.tier1Fee,
        feeWaived: false,
        waiveReason: null,
        message: `Cancellation fee of ₹${policy.tier1Fee} applies (${policy.tier1Hours} to ${policy.freeBeforeHours} hours before slot).`,
      };
    }

    return {
      fee: policy.tier2Fee,
      feeWaived: false,
      waiveReason: null,
      message: `Late cancellation fee of ₹${policy.tier2Fee} applies (within ${policy.tier1Hours} hours of slot).`,
    };
  }
}
