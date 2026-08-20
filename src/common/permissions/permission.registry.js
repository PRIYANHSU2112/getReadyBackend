/**
 * Central permission registry — source of truth for available permission keys
 * and route → permission bindings. Seed/sync into DB; do not free-form create keys.
 */

/** @typedef {{ key: string, module: string, action: string, description: string }} PermissionDef */
/** @typedef {{ method: string, pathPattern: string, permission: string, allowSelf?: boolean, selfParam?: string }} RouteBinding */

/** @type {PermissionDef[]} */
export const PERMISSION_CATALOG = Object.freeze([
  {
    key: 'users.read',
    module: 'users',
    action: 'read',
    description: 'List and view users',
  },
  {
    key: 'users.create',
    module: 'users',
    action: 'create',
    description: 'Create users',
  },
  {
    key: 'users.update',
    module: 'users',
    action: 'update',
    description: 'Update users',
  },
  {
    key: 'users.delete',
    module: 'users',
    action: 'delete',
    description: 'Delete users',
  },
  {
    key: 'roles.read',
    module: 'roles',
    action: 'read',
    description: 'List and view roles',
  },
  {
    key: 'roles.manage',
    module: 'roles',
    action: 'manage',
    description: 'Create, update, delete roles and assign permissions',
  },
  {
    key: 'permissions.read',
    module: 'permissions',
    action: 'read',
    description: 'List permissions',
  },
  {
    key: 'permissions.sync',
    module: 'permissions',
    action: 'sync',
    description: 'Sync permission catalog from registry into the database',
  },
  {
    key: 'banners.read',
    module: 'banners',
    action: 'read',
    description: 'List and view banners (admin)',
  },
  {
    key: 'banners.create',
    module: 'banners',
    action: 'create',
    description: 'Create banners',
  },
  {
    key: 'banners.update',
    module: 'banners',
    action: 'update',
    description: 'Update banners',
  },
  {
    key: 'banners.delete',
    module: 'banners',
    action: 'delete',
    description: 'Soft-delete banners',
  },
  {
    key: 'filters.read',
    module: 'filters',
    action: 'read',
    description: 'List and view filter groups and values (admin)',
  },
  {
    key: 'filters.create',
    module: 'filters',
    action: 'create',
    description: 'Create filter groups and values',
  },
  {
    key: 'filters.update',
    module: 'filters',
    action: 'update',
    description: 'Update, restore, reorder, and toggle filters',
  },
  {
    key: 'filters.delete',
    module: 'filters',
    action: 'delete',
    description: 'Soft-delete filter groups and values',
  },
  {
    key: 'categories.read',
    module: 'categories',
    action: 'read',
    description: 'List and view categories (admin / beautician)',
  },
  {
    key: 'categories.create',
    module: 'categories',
    action: 'create',
    description: 'Create categories',
  },
  {
    key: 'categories.update',
    module: 'categories',
    action: 'update',
    description: 'Update, restore, reorder, and toggle categories',
  },
  {
    key: 'categories.delete',
    module: 'categories',
    action: 'delete',
    description: 'Soft-delete categories',
  },
  {
    key: 'services.read',
    module: 'services',
    action: 'read',
    description: 'List and view services and change requests',
  },
  {
    key: 'services.create',
    module: 'services',
    action: 'create',
    description: 'Create services',
  },
  {
    key: 'services.update',
    module: 'services',
    action: 'update',
    description: 'Update services, approve/reject create and change requests',
  },
  {
    key: 'services.delete',
    module: 'services',
    action: 'delete',
    description: 'Soft-delete services',
  },
  {
    key: 'packages.read',
    module: 'packages',
    action: 'read',
    description: 'List and view packages and change requests',
  },
  {
    key: 'packages.create',
    module: 'packages',
    action: 'create',
    description: 'Create packages',
  },
  {
    key: 'packages.update',
    module: 'packages',
    action: 'update',
    description: 'Update packages, approve/reject create and change requests',
  },
  {
    key: 'packages.delete',
    module: 'packages',
    action: 'delete',
    description: 'Soft-delete packages',
  },
  {
    key: 'slots.read',
    module: 'slots',
    action: 'read',
    description: 'List and view slots (admin)',
  },
  {
    key: 'slots.create',
    module: 'slots',
    action: 'create',
    description: 'Create slots',
  },
  {
    key: 'slots.update',
    module: 'slots',
    action: 'update',
    description: 'Update slots',
  },
  {
    key: 'slots.delete',
    module: 'slots',
    action: 'delete',
    description: 'Cancel slots',
  },
  {
    key: 'blogs.read',
    module: 'blogs',
    action: 'read',
    description: 'List and view blogs (admin)',
  },
  {
    key: 'blogs.create',
    module: 'blogs',
    action: 'create',
    description: 'Create blogs',
  },
  {
    key: 'blogs.update',
    module: 'blogs',
    action: 'update',
    description: 'Update blogs',
  },
  {
    key: 'blogs.delete',
    module: 'blogs',
    action: 'delete',
    description: 'Soft-delete blogs',
  },
  {
    key: 'hygiene_kits.read',
    module: 'hygiene_kits',
    action: 'read',
    description: 'List and view hygiene kits (admin)',
  },
  {
    key: 'hygiene_kits.create',
    module: 'hygiene_kits',
    action: 'create',
    description: 'Create hygiene kits',
  },
  {
    key: 'hygiene_kits.update',
    module: 'hygiene_kits',
    action: 'update',
    description: 'Update hygiene kits and set default',
  },
  {
    key: 'hygiene_kits.delete',
    module: 'hygiene_kits',
    action: 'delete',
    description: 'Soft-delete hygiene kits',
  },
  {
    key: 'wallets.read',
    module: 'wallets',
    action: 'read',
    description: 'List and view wallet balances and loyalty rules (admin)',
  },
  {
    key: 'wallets.update',
    module: 'wallets',
    action: 'update',
    description: 'Update platform loyalty rules and points conversion (admin)',
  },
]);



/**
 * Paths are relative to `/api/v1` (no trailing slash).
 * More specific patterns should appear before parameterized ones when specificity ties.
 * @type {RouteBinding[]}
 */
export const ROUTE_PERMISSIONS = Object.freeze([
  // Auth-only (permission: null) — must outrank /users/:id so "me" is not treated as an id
  { method: 'GET', pathPattern: '/users/me', permission: null },
  { method: 'PATCH', pathPattern: '/users/me', permission: null },

  { method: 'GET', pathPattern: '/users', permission: 'users.read' },
  { method: 'POST', pathPattern: '/users', permission: 'users.create' },
  {
    method: 'GET',
    pathPattern: '/users/:id',
    permission: 'users.read',
    allowSelf: true,
    selfParam: 'id',
  },
  {
    method: 'PATCH',
    pathPattern: '/users/:id',
    permission: 'users.update',
    allowSelf: true,
    selfParam: 'id',
  },
  { method: 'DELETE', pathPattern: '/users/:id', permission: 'users.delete' },

  { method: 'GET', pathPattern: '/roles', permission: 'roles.read' },
  { method: 'GET', pathPattern: '/roles/:id', permission: 'roles.read' },
  { method: 'POST', pathPattern: '/roles', permission: 'roles.manage' },
  { method: 'PATCH', pathPattern: '/roles/:id', permission: 'roles.manage' },
  { method: 'DELETE', pathPattern: '/roles/:id', permission: 'roles.manage' },
  {
    method: 'PUT',
    pathPattern: '/roles/:id/permissions',
    permission: 'roles.manage',
  },

  { method: 'GET', pathPattern: '/permissions', permission: 'permissions.read' },
  {
    method: 'POST',
    pathPattern: '/permissions/sync',
    permission: 'permissions.sync',
  },

  // Banners — public active list before parameterized routes
  { method: 'GET', pathPattern: '/banners/active', permission: null },
  { method: 'GET', pathPattern: '/banners', permission: 'banners.read' },
  { method: 'POST', pathPattern: '/banners', permission: 'banners.create' },
  { method: 'GET', pathPattern: '/banners/:id', permission: 'banners.read' },
  { method: 'PATCH', pathPattern: '/banners/:id', permission: 'banners.update' },
  { method: 'DELETE', pathPattern: '/banners/:id', permission: 'banners.delete' },

  // Filters — public + static paths before parameterized
  { method: 'GET', pathPattern: '/filters/public', permission: null },
  { method: 'PATCH', pathPattern: '/filters/reorder', permission: 'filters.update' },
  { method: 'PATCH', pathPattern: '/filters/bulk/status', permission: 'filters.update' },
  { method: 'POST', pathPattern: '/filters/bulk/delete', permission: 'filters.delete' },
  { method: 'GET', pathPattern: '/filters', permission: 'filters.read' },
  { method: 'POST', pathPattern: '/filters', permission: 'filters.create' },
  { method: 'GET', pathPattern: '/filters/:id', permission: 'filters.read' },
  { method: 'PATCH', pathPattern: '/filters/:id', permission: 'filters.update' },
  { method: 'DELETE', pathPattern: '/filters/:id', permission: 'filters.delete' },
  { method: 'POST', pathPattern: '/filters/:id/restore', permission: 'filters.update' },
  { method: 'PATCH', pathPattern: '/filters/:id/status', permission: 'filters.update' },
  {
    method: 'GET',
    pathPattern: '/filters/:filterId/values',
    permission: 'filters.read',
  },
  {
    method: 'POST',
    pathPattern: '/filters/:filterId/values',
    permission: 'filters.create',
  },
  {
    method: 'PATCH',
    pathPattern: '/filters/:filterId/values/reorder',
    permission: 'filters.update',
  },
  {
    method: 'PATCH',
    pathPattern: '/filters/:filterId/values/:valueId',
    permission: 'filters.update',
  },
  {
    method: 'DELETE',
    pathPattern: '/filters/:filterId/values/:valueId',
    permission: 'filters.delete',
  },
  {
    method: 'POST',
    pathPattern: '/filters/:filterId/values/:valueId/restore',
    permission: 'filters.update',
  },

  // Categories — public + static paths before parameterized
  { method: 'GET', pathPattern: '/categories/public', permission: null },
  { method: 'GET', pathPattern: '/categories/public/:slug', permission: null },
  { method: 'PATCH', pathPattern: '/categories/reorder', permission: 'categories.update' },
  { method: 'PATCH', pathPattern: '/categories/bulk/status', permission: 'categories.update' },
  { method: 'POST', pathPattern: '/categories/bulk/delete', permission: 'categories.delete' },
  { method: 'GET', pathPattern: '/categories', permission: 'categories.read' },
  { method: 'POST', pathPattern: '/categories', permission: 'categories.create' },
  { method: 'GET', pathPattern: '/categories/:id', permission: 'categories.read' },
  { method: 'PATCH', pathPattern: '/categories/:id', permission: 'categories.update' },
  { method: 'DELETE', pathPattern: '/categories/:id', permission: 'categories.delete' },
  { method: 'POST', pathPattern: '/categories/:id/restore', permission: 'categories.update' },
  { method: 'PATCH', pathPattern: '/categories/:id/status', permission: 'categories.update' },

  // Services — public + static before parameterized
  { method: 'GET', pathPattern: '/services/public', permission: null },
  { method: 'GET', pathPattern: '/services/public/:slug', permission: null },
  { method: 'PATCH', pathPattern: '/services/reorder', permission: 'services.update' },
  { method: 'PATCH', pathPattern: '/services/bulk/status', permission: 'services.update' },
  { method: 'POST', pathPattern: '/services/bulk/delete', permission: 'services.delete' },
  { method: 'GET', pathPattern: '/services', permission: 'services.read' },
  { method: 'POST', pathPattern: '/services', permission: 'services.create' },
  { method: 'GET', pathPattern: '/services/:id', permission: 'services.read' },
  { method: 'PATCH', pathPattern: '/services/:id', permission: 'services.update' },
  { method: 'DELETE', pathPattern: '/services/:id', permission: 'services.delete' },
  { method: 'POST', pathPattern: '/services/:id/restore', permission: 'services.update' },
  { method: 'PATCH', pathPattern: '/services/:id/status', permission: 'services.update' },
  { method: 'POST', pathPattern: '/services/:id/approve', permission: 'services.update' },
  { method: 'POST', pathPattern: '/services/:id/reject', permission: 'services.update' },

  // Service change requests (admin panel)
  { method: 'GET', pathPattern: '/service-change-requests', permission: 'services.read' },
  { method: 'GET', pathPattern: '/service-change-requests/:id', permission: 'services.read' },
  {
    method: 'POST',
    pathPattern: '/service-change-requests/:id/approve',
    permission: 'services.update',
  },
  {
    method: 'POST',
    pathPattern: '/service-change-requests/:id/reject',
    permission: 'services.update',
  },

  // Slots — public available before admin CRUD (hold/book via future Booking API)
  { method: 'GET', pathPattern: '/slots/available', permission: null },
  { method: 'GET', pathPattern: '/slots', permission: 'slots.read' },
  { method: 'POST', pathPattern: '/slots/bulk', permission: 'slots.create' },
  { method: 'POST', pathPattern: '/slots', permission: 'slots.create' },
  { method: 'GET', pathPattern: '/slots/:id', permission: 'slots.read' },
  { method: 'PATCH', pathPattern: '/slots/:id', permission: 'slots.update' },
  { method: 'DELETE', pathPattern: '/slots/:id', permission: 'slots.delete' },

  // Blogs — public home/list/detail + auth like; admin manage CRUD
  { method: 'GET', pathPattern: '/blogs/home', permission: null },
  { method: 'GET', pathPattern: '/blogs/manage', permission: 'blogs.read' },
  { method: 'GET', pathPattern: '/blogs/manage/:id', permission: 'blogs.read' },
  { method: 'GET', pathPattern: '/blogs', permission: null },
  { method: 'POST', pathPattern: '/blogs/:id/like', permission: null },
  { method: 'GET', pathPattern: '/blogs/:id', permission: null },
  { method: 'POST', pathPattern: '/blogs', permission: 'blogs.create' },
  { method: 'PATCH', pathPattern: '/blogs/:id', permission: 'blogs.update' },
  { method: 'DELETE', pathPattern: '/blogs/:id', permission: 'blogs.delete' },

  // Hygiene Kits — public default/active/detail; admin manage CRUD
  { method: 'GET', pathPattern: '/hygiene-kits/default', permission: null },
  { method: 'GET', pathPattern: '/hygiene-kits/active', permission: null },
  { method: 'GET', pathPattern: '/hygiene-kits/:id', permission: null },
  { method: 'GET', pathPattern: '/hygiene-kits', permission: 'hygiene_kits.read' },
  { method: 'POST', pathPattern: '/hygiene-kits', permission: 'hygiene_kits.create' },
  { method: 'PATCH', pathPattern: '/hygiene-kits/:id/default', permission: 'hygiene_kits.update' },
  { method: 'PATCH', pathPattern: '/hygiene-kits/:id/status', permission: 'hygiene_kits.update' },
  { method: 'POST', pathPattern: '/hygiene-kits/:id/restore', permission: 'hygiene_kits.update' },
  { method: 'PATCH', pathPattern: '/hygiene-kits/:id', permission: 'hygiene_kits.update' },
  { method: 'PUT', pathPattern: '/hygiene-kits/:id', permission: 'hygiene_kits.update' },
  { method: 'DELETE', pathPattern: '/hygiene-kits/:id', permission: 'hygiene_kits.delete' },

  // Cart — auth-only (user owned)
  { method: 'GET', pathPattern: '/cart', permission: null },
  { method: 'DELETE', pathPattern: '/cart', permission: null },
  { method: 'POST', pathPattern: '/cart/sync', permission: null },
  { method: 'PATCH', pathPattern: '/cart/hygiene-kit', permission: null },
  { method: 'POST', pathPattern: '/cart/items', permission: null },
  { method: 'PATCH', pathPattern: '/cart/items/:lineId', permission: null },
  { method: 'DELETE', pathPattern: '/cart/items/:lineId', permission: null },
  { method: 'PATCH', pathPattern: '/cart/items/:lineId/selections', permission: null },
  { method: 'PATCH', pathPattern: '/cart/items/:lineId/recipient', permission: null },
  { method: 'POST', pathPattern: '/cart/book-for-others', permission: null },
  { method: 'PATCH', pathPattern: '/cart/instructions', permission: null },
  { method: 'PATCH', pathPattern: '/cart/benefits', permission: null },

  // Wallets & Loyalty
  { method: 'GET', pathPattern: '/wallets/loyalty-rules', permission: null },
  { method: 'PUT', pathPattern: '/wallets/loyalty-rules', permission: 'wallets.update' },
  { method: 'GET', pathPattern: '/wallets/me', permission: null },
  { method: 'POST', pathPattern: '/wallets/topup/create-order', permission: null },
  { method: 'POST', pathPattern: '/wallets/topup/verify', permission: null },
  { method: 'GET', pathPattern: '/wallets/transactions', permission: null },
  { method: 'POST', pathPattern: '/wallets/points/add', permission: 'wallets.update' },
  { method: 'POST', pathPattern: '/wallets/points/deduct', permission: 'wallets.update' },
]);




const API_PREFIX = '/api/v1';

/**
 * @param {string} pathPattern
 */
function pathPatternToRegex(pathPattern) {
  const source = pathPattern
    .split('/')
    .map((segment) => {
      if (!segment) return '';
      if (segment.startsWith(':')) return '[^/]+';
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return new RegExp(`^${source}$`, 'i');
}

/**
 * Higher score = more specific (prefer static segments and longer paths).
 * @param {string} pathPattern
 */
function specificityScore(pathPattern) {
  const segments = pathPattern.split('/').filter(Boolean);
  let score = segments.length * 10;
  for (const segment of segments) {
    if (!segment.startsWith(':')) score += 5;
  }
  return score;
}

const COMPILED_ROUTES = [...ROUTE_PERMISSIONS]
  .map((binding) => ({
    ...binding,
    method: binding.method.toUpperCase(),
    regex: pathPatternToRegex(binding.pathPattern),
    score: specificityScore(binding.pathPattern),
  }))
  .sort((a, b) => b.score - a.score);

/**
 * @returns {PermissionDef[]}
 */
export function listPermissions() {
  return [...PERMISSION_CATALOG];
}

/**
 * @returns {string[]}
 */
export function getPermissionKeys() {
  return PERMISSION_CATALOG.map((p) => p.key);
}

/**
 * Normalize an Express request path to `/api/v1`-relative form.
 * @param {string} originalUrlOrPath
 */
export function normalizeApiPath(originalUrlOrPath) {
  const pathOnly = originalUrlOrPath.split('?')[0];
  let normalized = pathOnly.startsWith(API_PREFIX)
    ? pathOnly.slice(API_PREFIX.length)
    : pathOnly;
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized || '/';
}

/**
 * Extract named params from a path using a route pattern (e.g. /users/:id).
 * @param {string} pathPattern
 * @param {string} actualPath
 * @returns {Record<string, string>}
 */
export function extractPathParams(pathPattern, actualPath) {
  const patternParts = pathPattern.split('/').filter(Boolean);
  const pathParts = normalizeApiPath(actualPath).split('/').filter(Boolean);
  /** @type {Record<string, string>} */
  const params = {};
  if (patternParts.length !== pathParts.length) return params;

  for (let i = 0; i < patternParts.length; i += 1) {
    const segment = patternParts[i];
    if (segment.startsWith(':')) {
      params[segment.slice(1)] = pathParts[i];
    }
  }
  return params;
}

/**
 * @param {string} method
 * @param {string} path - full or `/api/v1`-relative
 * @returns {(RouteBinding & { params?: Record<string, string> })|null}
 */
export function matchRoute(method, path) {
  const normalizedPath = normalizeApiPath(path);
  const upperMethod = method.toUpperCase();

  for (const binding of COMPILED_ROUTES) {
    if (binding.method !== upperMethod) continue;
    if (binding.regex.test(normalizedPath)) {
      return {
        method: binding.method,
        pathPattern: binding.pathPattern,
        permission: binding.permission,
        allowSelf: binding.allowSelf,
        selfParam: binding.selfParam,
        params: extractPathParams(binding.pathPattern, normalizedPath),
      };
    }
  }

  return null;
}

/**
 * Default permission keys assigned to the seeded admin role.
 * @returns {string[]}
 */
export function getAdminDefaultPermissions() {
  return getPermissionKeys();
}

/**
 * Default permission keys for beautician (operational subset; expand as modules land).
 * @returns {string[]}
 */
export function getBeauticianDefaultPermissions() {
  return [
    'users.read',
    'categories.read',
    'services.read',
    'services.create',
    'services.update',
  ];
}
