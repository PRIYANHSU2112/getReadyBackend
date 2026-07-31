/**
 * Beautician profile-domain limits, cache TTL, and sort fields.
 */
export const BEAUTICIAN_PROFILE_CACHE_TTL_SECONDS = 120;

export const BEAUTICIAN_PROFILE_SORT_FIELDS = Object.freeze([
  'createdAt',
  'submittedAt',
  'ratingAvg',
  'profileStatus',
]);

export const DEFAULT_BEAUTICIAN_PROFILE_SORT = '-createdAt';

export const MAX_BIO_LENGTH = 1000;
export const MAX_LANGUAGES = 10;
export const MAX_SKILLS = 20;
export const MAX_CERTIFICATE_TITLE_LENGTH = 200;
export const MAX_WORK_HISTORY_ENTRIES = 20;
export const MAX_CERTIFICATE_ENTRIES = 20;
export const MAX_SALON_NAME_LENGTH = 200;
export const MAX_ROLE_LENGTH = 150;

export const VALID_DAYS = Object.freeze([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);
