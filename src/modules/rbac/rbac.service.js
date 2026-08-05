import { BaseService } from '../../common/base/BaseService.js';
import { AppError } from '../../common/errors/AppError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import { UserRole } from '../../common/constants/enums.js';
import { buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import {
  parseListQuery,
  buildAppliedFilters,
} from '../../common/helpers/list-query.helper.js';
import {
  listPermissions as listRegistryPermissions,
  getAdminDefaultPermissions,
  getBeauticianDefaultPermissions,
} from '../../common/permissions/permission.registry.js';

const ROLE_SORT_FIELDS = ['createdAt', 'name', 'slug'];
const ROLE_AUTH_CACHE_TTL = 60;

export class RbacService extends BaseService {
  /**
   * @param {import('./role.repository.js').RoleRepository} roleRepository
   * @param {import('./permission.repository.js').PermissionRepository} permissionRepository
   * @param {import('../../core/redis/cache.service.js').CacheService|null} cacheService
   */
  constructor(roleRepository, permissionRepository, cacheService = null) {
    super(null, cacheService);
    this.roleRepository = roleRepository;
    this.permissionRepository = permissionRepository;
    /** @type {((slug: string) => Promise<number>)|null} */
    this.countUsersByRole = null;
  }

  /**
   * Late-bind user counter to avoid circular module imports.
   * @param {(slug: string) => Promise<number>} fn
   */
  bindCountUsersByRole(fn) {
    this.countUsersByRole = fn;
  }

  #sanitizeRole(role) {
    if (!role) return role;
    const obj = typeof role.toJSON === 'function' ? role.toJSON() : { ...role };
    if (obj._id) obj.id = obj._id.toString();
    return obj;
  }

  #sanitizePermission(permission) {
    if (!permission) return permission;
    const obj =
      typeof permission.toJSON === 'function' ? permission.toJSON() : { ...permission };
    if (obj._id) obj.id = obj._id.toString();
    return obj;
  }

  #roleAuthCacheKey(slug) {
    return this.cacheKey('rbac', 'role-auth', slug);
  }

  async #invalidateRoleAuthCache(slug) {
    if (slug) await this.invalidateCache(this.#roleAuthCacheKey(slug));
  }

  /**
   * Authorization payload used by checkPermission middleware.
   * @param {string} slug
   * @returns {Promise<{ slug: string, isSuperAdmin: boolean, permissions: string[], isActive: boolean }|null>}
   */
  async getAuthorizationForSlug(slug) {
    if (!slug) return null;

    const cacheKey = this.#roleAuthCacheKey(slug);
    const cached = await this.getCached(cacheKey);
    if (cached) return cached;

    const role = await this.roleRepository.findBySlug(slug);
    if (!role) return null;

    const payload = {
      slug: role.slug,
      isSuperAdmin: Boolean(role.isSuperAdmin),
      permissions: Array.isArray(role.permissions) ? role.permissions : [],
      isActive: role.isActive !== false,
    };

    await this.setCached(cacheKey, payload, ROLE_AUTH_CACHE_TTL);
    return payload;
  }

  async assertActiveRoleSlug(slug) {
    const role = await this.roleRepository.findActiveBySlug(slug);
    if (!role) {
      throw new AppError(
        `Role "${slug}" does not exist or is inactive`,
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }
    return this.#sanitizeRole(role);
  }

  /**
   * Sync registry permissions into DB catalog table (insert new, mark inactive missing).
   */
  async syncPermissionsFromRegistry() {
    const registryList = listRegistryPermissions();

    const ops = registryList.map((p) => ({
      updateOne: {
        filter: { key: p.key },
        update: {
          $set: {
            key: p.key,
            module: p.module,
            action: p.action,
            description: p.description,
            isActive: true,
          },
        },
        upsert: true,
      },
    }));

    if (ops.length) {
      await this.permissionRepository.bulkWrite(ops);
    }

    const regKeys = registryList.map((p) => p.key);
    await this.permissionRepository.deactivateUnlistedKeys(regKeys);

    const allInDb = await this.permissionRepository.findActive();
    return {
      items: allInDb.map((p) => this.#sanitizePermission(p)),
      count: allInDb.length,
      total: allInDb.length,
    };
  }

  /**
   * Upsert system roles + sync permissions. Safe to run multiple times.
   * System roles always sync permissions from registry default keys.
   */
  async seedDefaults() {
    const { items: permissions } = await this.syncPermissionsFromRegistry();
    const allKeys = getAdminDefaultPermissions();
    const beauticianKeys = getBeauticianDefaultPermissions();

    const defaults = [
      {
        name: 'Super Admin',
        slug: UserRole.SUPER_ADMIN,
        description: 'Full system access — all permissions + Super Admin bypass',
        permissions: allKeys,
        isSystem: true,
        isSuperAdmin: true,
        isActive: true,
      },
      {
        name: 'Admin',
        slug: UserRole.ADMIN,
        description: 'Salon admin with full management permissions',
        permissions: allKeys,
        isSystem: true,
        isSuperAdmin: false,
        isActive: true,
      },
      {
        name: 'Beautician',
        slug: UserRole.BEAUTICIAN,
        description: 'Beautician with operational permissions',
        permissions: beauticianKeys,
        isSystem: true,
        isSuperAdmin: false,
        isActive: true,
      },
      {
        name: 'Customer',
        slug: UserRole.CUSTOMER,
        description: 'Customer — no staff permissions',
        permissions: [],
        isSystem: true,
        isSuperAdmin: false,
        isActive: true,
      },
    ];

    const roles = [];
    for (const def of defaults) {
      const { alwaysSyncPermissions: _sync, ...createData } = def;
      const role = await this.roleRepository.upsertBySlug(createData);
      roles.push(role);
      await this.#invalidateRoleAuthCache(def.slug);
    }

    return {
      roles: roles.map((r) => this.#sanitizeRole(r)),
      permissionCount: permissions.length,
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  PERMISSIONS (Read-only catalog)
  // ═══════════════════════════════════════════════════════════

  async listPermissions(query = {}) {
    const list = await this.permissionRepository.findActive();
    let items = list.map((p) => this.#sanitizePermission(p));

    if (query.module) {
      const modLower = String(query.module).trim().toLowerCase();
      items = items.filter((p) => p.module?.toLowerCase() === modLower);
    }

    if (query.search) {
      const q = String(query.search).trim().toLowerCase();
      items = items.filter(
        (p) =>
          p.key.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.module?.toLowerCase().includes(q),
      );
    }

    return { items, total: items.length };
  }

  async getPermissionByKey(key) {
    const perm = await this.permissionRepository.findByKey(key);
    return this.#sanitizePermission(this.ensureFound(perm, `Permission key "${key}" not found`));
  }

  // ═══════════════════════════════════════════════════════════
  //  ROLES (CRUD + permission assignment)
  // ═══════════════════════════════════════════════════════════

  async listRoles(query = {}) {
    const pagination = parseListQuery(query, {
      allowedSortFields: ROLE_SORT_FIELDS,
      defaultSort: 'name',
    });

    const filter = {};
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    const { items, total } = await this.roleRepository.findAndCount(filter, {
      skip: pagination.skip,
      limit: pagination.limit,
      sort: pagination.sort,
    });

    let sanitized = items.map((r) => this.#sanitizeRole(r));

    if (this.countUsersByRole) {
      sanitized = await Promise.all(
        sanitized.map(async (role) => ({
          ...role,
          userCount: await this.countUsersByRole(role.slug),
        })),
      );
    }

    const appliedFilters = buildAppliedFilters(query, ['isActive']);

    return {
      items: sanitized,
      meta: buildPaginationMeta(total, pagination, appliedFilters),
    };
  }

  async getRoleById(id) {
    const role = await this.roleRepository.findById(id);
    const sanitized = this.#sanitizeRole(this.ensureFound(role, 'Role not found'));
    if (this.countUsersByRole && sanitized?.slug) {
      sanitized.userCount = await this.countUsersByRole(sanitized.slug);
    }
    return sanitized;
  }

  async #assertPermissionKeysExist(keys = []) {
    if (!Array.isArray(keys)) {
      throw new AppError('permissions must be an array', HttpStatus.UNPROCESSABLE, ErrorCodes.VALIDATION_ERROR);
    }
    const unique = [...new Set(keys.map((k) => String(k).trim()))];
    if (!unique.length) return [];

    const activeInDb = await this.permissionRepository.findByKeys(unique);
    const foundSet = new Set(activeInDb.map((p) => p.key));
    const missing = unique.filter((k) => !foundSet.has(k));

    if (missing.length) {
      throw new AppError(
        `Unknown or inactive permission key(s): ${missing.join(', ')}`,
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    return unique;
  }

  async createRole(data) {
    const slug = String(data.slug || '').trim().toLowerCase();
    const existing = await this.roleRepository.findBySlug(slug);
    if (existing) {
      throw new AppError(
        `Role slug "${slug}" already exists`,
        HttpStatus.CONFLICT,
        ErrorCodes.ROLE_SLUG_EXISTS,
      );
    }

    const permissions = await this.#assertPermissionKeysExist(data.permissions || []);

    const created = await this.roleRepository.create({
      name: data.name,
      slug,
      description: data.description || null,
      permissions,
      isSystem: false,
      isSuperAdmin: false,
      isActive: data.isActive !== undefined ? data.isActive : true,
    });

    return this.#sanitizeRole(created);
  }

  async updateRole(id, data) {
    const existing = await this.roleRepository.findById(id);
    this.ensureFound(existing, 'Role not found');

    const payload = {};

    if (data.name !== undefined) payload.name = data.name;
    if (data.description !== undefined) payload.description = data.description;
    if (data.isActive !== undefined) {
      if (existing.isSuperAdmin && !data.isActive) {
        throw new AppError('Super admin role cannot be deactivated', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
      }
      payload.isActive = data.isActive;
    }

    if (data.slug !== undefined) {
      const slug = String(data.slug).trim().toLowerCase();
      if (existing.isSystem && slug !== existing.slug) {
        throw new AppError('System role slug cannot be changed', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
      }
      if (slug !== existing.slug) {
        const other = await this.roleRepository.findBySlug(slug);
        if (other) {
          throw new AppError(`Role slug "${slug}" already exists`, HttpStatus.CONFLICT, ErrorCodes.ROLE_SLUG_EXISTS);
        }
        payload.slug = slug;
      }
    }

    if (data.permissions !== undefined) {
      payload.permissions = await this.#assertPermissionKeysExist(data.permissions);
    }

    if (!Object.keys(payload).length) {
      throw new AppError('No fields to update', HttpStatus.UNPROCESSABLE, ErrorCodes.VALIDATION_ERROR);
    }

    const updated = await this.roleRepository.updateById(id, payload);
    const found = this.ensureFound(updated, 'Role not found');
    await this.#invalidateRoleAuthCache(existing.slug);
    if (payload.slug) await this.#invalidateRoleAuthCache(payload.slug);
    return this.#sanitizeRole(found);
  }

  async setRolePermissions(id, permissions) {
    return this.updateRole(id, { permissions });
  }

  async deleteRole(id) {
    const existing = await this.roleRepository.findById(id);
    this.ensureFound(existing, 'Role not found');

    if (existing.isSystem) {
      throw new AppError(
        'Cannot delete a system role',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    if (existing.isSuperAdmin) {
      throw new AppError(
        'Cannot delete the super admin role',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    if (this.countUsersByRole) {
      const count = await this.countUsersByRole(existing.slug);
      if (count > 0) {
        throw new AppError(
          'Role is assigned to one or more users',
          HttpStatus.CONFLICT,
          ErrorCodes.ROLE_IN_USE,
          true,
          { count },
        );
      }
    }

    await this.roleRepository.deleteById(id);
    await this.#invalidateRoleAuthCache(existing.slug);
    return true;
  }
}
