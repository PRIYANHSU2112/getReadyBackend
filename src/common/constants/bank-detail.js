/**
 * Bank detail domain limits, cache TTL, and sort fields.
 */
export const BANK_DETAIL_CACHE_TTL_SECONDS = 120;

export const BANK_SORT_FIELDS = Object.freeze(['createdAt', 'status']);
export const DEFAULT_BANK_SORT = '-createdAt';

export const MAX_ACCOUNT_HOLDER_NAME_LENGTH = 200;
export const MAX_ACCOUNT_NUMBER_LENGTH = 20;
export const MAX_BANK_NAME_LENGTH = 200;
export const MAX_BRANCH_NAME_LENGTH = 200;
export const MAX_UPI_ID_LENGTH = 100;

export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
