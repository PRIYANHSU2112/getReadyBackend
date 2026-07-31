/**
 * Banner-domain limits and defaults (shared by model, validation, service, docs).
 */
export const MIN_BANNER_POSITION = 1;
export const MAX_BANNER_POSITION = 100;
export const MAX_BANNERS_PER_POSITION = 20;
export const BANNER_LIST_CACHE_TTL_SECONDS = 30;
export const MAX_SERVICE_CATEGORY_LENGTH = 100;
export const MAX_BANNER_SERVICE_IDS = 20;

export const BANNER_SORT_FIELDS = Object.freeze([
  'sortOrder',
  'createdAt',
  'updatedAt',
  'position',
  'title',
]);

export const DEFAULT_BANNER_SORT = 'sortOrder';

/** Slim fields for public active list responses. */
export const BANNER_PUBLIC_SELECT =
  'title image linkUrl position categoryId serviceCategory serviceIds type status sortOrder startAt endAt platform createdAt updatedAt';
