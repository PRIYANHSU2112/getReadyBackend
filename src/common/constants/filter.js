/**
 * Filter-domain limits and public projection (shared by model, validation, service, docs).
 */
export const FILTER_PUBLIC_CACHE_TTL_SECONDS = 300;

export const FILTER_SORT_FIELDS = Object.freeze([
  'displayOrder',
  'name',
  'createdAt',
  'updatedAt',
]);

export const DEFAULT_FILTER_SORT = 'displayOrder';

export const FILTER_VALUE_SORT_FIELDS = Object.freeze([
  'displayOrder',
  'label',
  'createdAt',
  'updatedAt',
]);

export const DEFAULT_FILTER_VALUE_SORT = 'displayOrder';

export const MAX_FILTER_SCOPES = 20;
export const MAX_METADATA_KEYS = 50;
export const MAX_FILTER_NAME_LENGTH = 100;
export const MAX_FILTER_SLUG_LENGTH = 120;

/** Slim public group fields (UI filter sheet). */
export const FILTER_PUBLIC_GROUP_FIELDS = Object.freeze([
  'id',
  'name',
  'slug',
  'displayType',
  'selectionType',
  'isRequired',
  'displayOrder',
  'values',
]);

/** Slim public value fields. */
export const FILTER_PUBLIC_VALUE_FIELDS = Object.freeze([
  'id',
  'label',
  'value',
  'displayOrder',
  'isDefault',
  'icon',
]);
