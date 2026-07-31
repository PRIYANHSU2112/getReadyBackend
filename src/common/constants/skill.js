/**
 * Skill-domain limits, cache TTL, and public projection fields.
 */
export const SKILL_CACHE_TTL_SECONDS = 300;

export const SKILL_SORT_FIELDS = Object.freeze([
  'displayOrder',
  'name',
  'createdAt',
  'updatedAt',
]);

export const DEFAULT_SKILL_SORT = 'displayOrder';

export const MAX_SKILL_NAME_LENGTH = 100;

export const SKILL_PUBLIC_FIELDS = Object.freeze([
  'id',
  'name',
  'categoryId',
  'icon',
  'displayOrder',
]);
