/** Soft-hold TTL in Redis (seconds). */
export const SLOT_HOLD_TTL_SECONDS = 600;

/** Public available-by-date cache TTL. */
export const SLOT_AVAILABLE_CACHE_TTL_SECONDS = 15;

/** Max party size per hold. */
export const MAX_SLOT_PARTY_SIZE = 20;

/** Max seats / maxBookings on a slot. */
export const MAX_SLOT_CAPACITY = 100;

/** Max slots in one bulk create. */
export const MAX_SLOT_BULK_CREATE = 48;

/** Default capacity for exclusive salon visit. */
export const DEFAULT_SLOT_MIN_BOOKINGS = 1;
export const DEFAULT_SLOT_MAX_BOOKINGS = 1;

export const SLOT_SORT_FIELDS = Object.freeze(['startAt', 'createdAt', 'date']);
export const DEFAULT_SLOT_SORT = 'startAt';

/** Notes max length. */
export const MAX_SLOT_NOTES_LENGTH = 500;
