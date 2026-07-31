/**
 * Category-domain limits, cache TTL, and public projection fields.
 */
export const CATEGORY_PUBLIC_CACHE_TTL_SECONDS = 300;

export const CATEGORY_SORT_FIELDS = Object.freeze([
  'displayOrder',
  'name',
  'createdAt',
  'updatedAt',
]);

export const DEFAULT_CATEGORY_SORT = 'displayOrder';

export const MAX_CATEGORY_NAME_LENGTH = 100;
export const MAX_CATEGORY_SLUG_LENGTH = 120;
export const MAX_CATEGORY_DESCRIPTION_LENGTH = 500;

/** Slim public fields for home / booking tiles. */
export const CATEGORY_PUBLIC_FIELDS = Object.freeze([
  'id',
  'name',
  'slug',
  'description',
  'image',
  'icon',
  'color',
  'displayOrder',
  'isFeatured',
  'defaultPriceRange',
]);
