/**
 * Member (family/friends) domain limits and defaults.
 */

export const MAX_MEMBERS_PER_USER = 10;

export const MAX_MEMBER_NAME_LENGTH = 100;

export const MAX_MEDICAL_NOTES_LENGTH = 500;

export const MEMBER_LIST_CACHE_TTL_SECONDS = 30;

export const MEMBER_SORT_FIELDS = Object.freeze(['createdAt', 'updatedAt', 'name']);

export const DEFAULT_MEMBER_SORT = '-createdAt';
