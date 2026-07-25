import { ForbiddenError } from '../errors/ForbiddenError.js';
import { UnauthorizedError } from '../errors/UnauthorizedError.js';
import { UserRole } from '../constants/enums.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { matchRoute } from '../permissions/permission.registry.js';

/**
 * Restrict route to one or more roles (legacy helper; prefer checkPermission).
 * @param {...string} allowedRoles
 */
export function createAuthorize(...allowedRoles) {
  return asyncHandler(async (req, _res, next) => {
    if (!req.user?.id) {
      throw new UnauthorizedError('Authentication required');
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
    next();
  });
}

/**
 * Allow admin/super_admin or the user matching route param id.
 * Prefer registry `allowSelf` via checkPermission for new routes.
 * @param {string} [paramKey='id']
 */
export function createAuthorizeSelfOrAdmin(paramKey = 'id') {
  return asyncHandler(async (req, _res, next) => {
    if (!req.user?.id) {
      throw new UnauthorizedError('Authentication required');
    }
    if (
      req.user.role === UserRole.ADMIN ||
      req.user.role === UserRole.SUPER_ADMIN
    ) {
      return next();
    }
    if (req.params[paramKey] === req.user.id) {
      return next();
    }
    throw new ForbiddenError('Insufficient permissions');
  });
}

/**
 * Centralized permission guard — resolves required permission from the registry
 * based on HTTP method + path. Super Admin bypasses all checks.
 *
 * @param {{ roleService: { getAuthorizationForSlug: Function } }} deps
 */
export function createCheckPermission({ roleService }) {
  return asyncHandler(async (req, _res, next) => {
    if (!req.user?.id) {
      throw new UnauthorizedError('Authentication required');
    }

    const binding = matchRoute(req.method, req.originalUrl || req.path);
    // No registry entry, or auth-only entry (permission: null) → allow
    if (!binding || !binding.permission) {
      return next();
    }

    if (binding.allowSelf) {
      const paramKey = binding.selfParam || 'id';
      const selfId = req.params?.[paramKey] || binding.params?.[paramKey];
      if (selfId && selfId === req.user.id) {
        return next();
      }
    }

    const authz = await roleService.getAuthorizationForSlug(req.user.role);
    if (!authz || !authz.isActive) {
      throw new ForbiddenError('Role is inactive or not found');
    }

    if (authz.isSuperAdmin) {
      return next();
    }

    if (!authz.permissions.includes(binding.permission)) {
      throw new ForbiddenError('Insufficient permissions');
    }

    return next();
  });
}
