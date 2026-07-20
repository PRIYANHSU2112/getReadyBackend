/**
 * @param {object} query
 * @returns {{ page: number, limit: number, skip: number, sort: string }}
 */
export function parsePagination(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;
  const sort = query.sort || '-createdAt';
  return { page, limit, skip, sort };
}

/**
 * @param {number} total
 * @param {{ page: number, limit: number }} pagination
 */
export function buildPaginationMeta(total, { page, limit }) {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
