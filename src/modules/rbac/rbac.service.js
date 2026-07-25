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

  async syncPermissionsFromRegistry() {
    const catalog = listRegistryPermissions();
    const synced = [];
    for (const item of catalog) {
      const doc = await this.permissionRepository.upsertByKey({
        key: item.key,
        module: item.module,
        action: item.action,
        description: item.description,
        isActive: true,
      });
      synced.push(this.#sanitizePermission(doc));
    }
    return { count: synced.length, items: synced };
  }

  /**
   * Upsert system roles + sync permissions. Safe to run multiple times.
   * Existing custom role permission assignments are preserved on re-seed.
   * Super Admin always receives every registry permission key.
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
        alwaysSyncPermissions: true,
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
      const existing = await this.roleRepository.findBySlug(def.slug);
      if (existing) {
        const payload = {
          name: def.name,
          description: def.description,
          isSystem: true,
          isSuperAdmin: def.isSuperAdmin,
          isActive: true,
        };
        // Keep Super Admin (and any alwaysSync role) permissions in sync with registry
        if (def.alwaysSyncPermissions) {
          payload.permissions = def.permissions;
        }
        const updated = await this.roleRepository.model
          .findByIdAndUpdate(existing._id.toString(), { $set: payload }, { new: true })
          .lean()
          .exec();
        roles.push(updated);
      } else {
        const { alwaysSyncPermissions: _sync, ...createData } = def;
        roles.push(await this.roleRepository.create(createData));
      }
      await this.#invalidateRoleAuthCache(def.slug);
    }

    return {
      permissions: permissions.length,
      roles: roles.map((r) => this.#sanitizeRole(r)),
    };
  }

  async listPermissions(query = {}) {
    const pagination = parseListQuery(query, {
      allowedSortFields: ['createdAt', 'key', 'module'],
      defaultSort: 'module',
    });
    const filter = {};
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.module) filter.module = query.module;

    const [items, total] = await Promise.all([
      this.permissionRepository.findAll(filter, {
        skip: pagination.skip,
        limit: pagination.limit,
        sort: pagination.sort,
      }),
      this.permissionRepository.count(filter),
    ]);

    return {
      items: items.map((p) => this.#sanitizePermission(p)),
      meta: {
        ...buildPaginationMeta(total, pagination),
        sort: pagination.sort,
        filters: buildAppliedFilters(query, ['module', 'isActive']),
      },
    };
  }

  async listRoles(query = {}) {
    const pagination = parseListQuery(query, {
      allowedSortFields: ROLE_SORT_FIELDS,
      defaultSort: 'name',
    });
    const filter = this.roleRepository.buildListFilter(query);

    const [items, total] = await Promise.all([
      this.roleRepository.search(filter, {
        skip: pagination.skip,
        limit: pagination.limit,
        sort: pagination.sort,
      }),
      this.roleRepository.count(filter),
    ]);

    return {
      items: items.map((r) => this.#sanitizeRole(r)),
      meta: {
        ...buildPaginationMeta(total, pagination),
        sort: pagination.sort,
        filters: buildAppliedFilters(query, ['search', 'isActive', 'isSystem']),
      },
    };
  }

  async getRoleById(id) {
    const role = await this.roleRepository.findById(id);
    return this.#sanitizeRole(this.ensureFound(role, 'Role not found'));
  }

  async #assertPermissionKeysExist(keys) {
    const unique = [...new Set(keys)];
    const found = await this.permissionRepository.findKeys(unique);
    const foundKeys = new Set(found.map((p) => p.key));
    const missing = unique.filter((k) => !foundKeys.has(k));
    if (missing.length) {
      throw new AppError(
        `Unknown or inactive permission keys: ${missing.join(', ')}`,
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
        true,
        { missing },
      );
    }
    return unique;
  }

  async createRole(data) {
    const slug = data.slug.toLowerCase().trim();
    const existing = await this.roleRepository.findBySlug(slug);
    if (existing) {
      throw new AppError('Role slug already exists', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
    }

    const permissions = data.permissions?.length
      ? await this.#assertPermissionKeysExist(data.permissions)
      : [];

    if (data.isSuperAdmin) {
      throw new AppError(
        'Cannot create another super admin role',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const role = await this.roleRepository.create({
      name: data.name,
      slug,
      description: data.description || '',
      permissions,
      isSystem: false,
      isSuperAdmin: false,
      isActive: data.isActive !== false,
    });

    return this.#sanitizeRole(role);
  }

  async updateRole(id, data = {}) {
    const existing = await this.roleRepository.findById(id);
    this.ensureFound(existing, 'Role not found');

    const payload = {};

    if (data.name !== undefined) payload.name = data.name;
    if (data.description !== undefined) payload.description = data.description;
    if (data.isActive !== undefined) payload.isActive = data.isActive;

    if (data.slug !== undefined && data.slug.toLowerCase().trim() !== existing.slug) {
      if (existing.isSystem) {
        throw new AppError(
          'Cannot change slug of a system role',
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
        );
      }
      const slug = data.slug.toLowerCase().trim();
      const conflict = await this.roleRepository.findBySlug(slug);
      if (conflict && conflict._id.toString() !== id) {
        throw new AppError('Role slug already exists', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
      }
      payload.slug = slug;
    }

    if (data.isSuperAdmin !== undefined) {
      if (existing.isSuperAdmin && data.isSuperAdmin === false) {
        throw new AppError(
          'Cannot remove super admin flag from the system super admin role',
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
        );
      }
      if (!existing.isSuperAdmin && data.isSuperAdmin === true) {
        throw new AppError(
          'Cannot promote a role to super admin',
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_ERROR,
        );
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
