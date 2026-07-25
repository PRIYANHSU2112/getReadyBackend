/**
 * Address-domain limits and defaults (shared by model, validation, service, docs).
 */
export const MAX_ADDRESSES_PER_USER = 10;

export const DEFAULT_COUNTRY = 'IN';

export const ADDRESS_LIST_CACHE_TTL_SECONDS = 30;

export const ADDRESS_SORT_FIELDS = Object.freeze([
  'createdAt',
  'updatedAt',
  'fullName',
  'city',
]);

export const DEFAULT_ADDRESS_SORT = '-createdAt';

export const GeoJsonType = Object.freeze({
  POINT: 'Point',
});
