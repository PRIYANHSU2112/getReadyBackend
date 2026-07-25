import { parsePagination } from './pagination.helper.js';

export const USER_SORT_FIELDS = ['createdAt', 'name', 'lastLoginAt'];

/**
 * Escape special regex characters in user search input.
 */
export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string|undefined} sort
 * @param {string[]} allowedFields
 * @param {string} defaultSort
 */
export function sanitizeSort(sort, allowedFields, defaultSort = '-createdAt') {
  if (!sort) return defaultSort;
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  if (!allowedFields.includes(field)) return defaultSort;
  return desc ? `-${field}` : field;
}

/**
 * @param {string|undefined} search
 * @param {string[]} fields
 * Prefix regex (^term) when term is a single token without wildcards — can use indexes.
 * Otherwise falls back to contains (/term/i) for multi-word / fuzzy search.
 */
export function buildSearchFilter(search, fields) {
  const term = search?.trim();
  if (!term) return null;

  const escaped = escapeRegex(term);
  // Single token, no spaces → prefix match (index-friendly on leading edge)
  const usePrefix = !/\s/.test(term);
  const regex = usePrefix
    ? new RegExp(`^${escaped}`, 'i')
    : new RegExp(escaped, 'i');

  return { $or: fields.map((field) => ({ [field]: regex })) };
}

/**
 * @param {Date|string|undefined} from
 * @param {Date|string|undefined} to
 */
export function buildDateRangeFilter(from, to) {
  if (!from && !to) return null;
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return range;
}

/**
 * @param {object} query
 * @param {{ allowedSortFields: string[], defaultSort?: string }} options
 */
export function parseListQuery(query, { allowedSortFields, defaultSort = '-createdAt' }) {
  const pagination = parsePagination(query);
  const sort = sanitizeSort(query.sort, allowedSortFields, defaultSort);
  return { ...pagination, sort };
}

/**
 * @param {object} query
 * @param {string[]} keys
 */
export function buildAppliedFilters(query, keys) {
  const filters = {};
  for (const key of keys) {
    const value = query[key];
    if (value !== undefined && value !== null && value !== '') {
      filters[key] = value;
    }
  }
  return filters;
}
