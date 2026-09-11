import { AppError, HttpStatus, ErrorCodes } from '@getready/errors';

export const SYSTEM_PERMISSIONS = [
  { key: 'users.read', module: 'users', action: 'read', description: 'List and view users' },
  { key: 'users.create', module: 'users', action: 'create', description: 'Create users' },
  { key: 'users.update', module: 'users', action: 'update', description: 'Update users' },
  { key: 'users.delete', module: 'users', action: 'delete', description: 'Delete users' },
  { key: 'roles.read', module: 'roles', action: 'read', description: 'List and view roles' },
  { key: 'roles.manage', module: 'roles', action: 'manage', description: 'Create, update, delete roles' },
  { key: 'permissions.read', module: 'permissions', action: 'read', description: 'List permissions' },
  { key: 'permissions.sync', module: 'permissions', action: 'sync', description: 'Sync permissions' },
  { key: 'banners.read', module: 'banners', action: 'read', description: 'List banners' },
  { key: 'banners.create', module: 'banners', action: 'create', description: 'Create banners' },
  { key: 'banners.update', module: 'banners', action: 'update', description: 'Update banners' },
  { key: 'banners.delete', module: 'banners', action: 'delete', description: 'Delete banners' },
  { key: 'filters.read', module: 'filters', action: 'read', description: 'List filters' },
  { key: 'filters.create', module: 'filters', action: 'create', description: 'Create filters' },
  { key: 'filters.update', module: 'filters', action: 'update', description: 'Update filters' },
  { key: 'filters.delete', module: 'filters', action: 'delete', description: 'Delete filters' },
  { key: 'categories.read', module: 'categories', action: 'read', description: 'List categories' },
  { key: 'categories.create', module: 'categories', action: 'create', description: 'Create categories' },
  { key: 'categories.update', module: 'categories', action: 'update', description: 'Update categories' },
  { key: 'categories.delete', module: 'categories', action: 'delete', description: 'Delete categories' },
  { key: 'services.read', module: 'services', action: 'read', description: 'List services' },
  { key: 'services.create', module: 'services', action: 'create', description: 'Create services' },
  { key: 'services.update', module: 'services', action: 'update', description: 'Update services' },
  { key: 'services.delete', module: 'services', action: 'delete', description: 'Delete services' },
  { key: 'packages.read', module: 'packages', action: 'read', description: 'List packages' },
  { key: 'packages.create', module: 'packages', action: 'create', description: 'Create packages' },
  { key: 'packages.update', module: 'packages', action: 'update', description: 'Update packages' },
  { key: 'packages.delete', module: 'packages', action: 'delete', description: 'Delete packages' },
  { key: 'slots.read', module: 'slots', action: 'read', description: 'List slots' },
  { key: 'slots.create', module: 'slots', action: 'create', description: 'Create slots' },
  { key: 'slots.update', module: 'slots', action: 'update', description: 'Update slots' },
  { key: 'slots.delete', module: 'slots', action: 'delete', description: 'Cancel slots' },
  { key: 'blogs.read', module: 'blogs', action: 'read', description: 'List blogs' },
  { key: 'blogs.create', module: 'blogs', action: 'create', description: 'Create blogs' },
  { key: 'blogs.update', module: 'blogs', action: 'update', description: 'Update blogs' },
  { key: 'blogs.delete', module: 'blogs', action: 'delete', description: 'Delete blogs' },
  { key: 'hygiene_kits.read', module: 'hygiene_kits', action: 'read', description: 'List hygiene kits' },
  { key: 'hygiene_kits.create', module: 'hygiene_kits', action: 'create', description: 'Create hygiene kits' },
  { key: 'hygiene_kits.update', module: 'hygiene_kits', action: 'update', description: 'Update hygiene kits' },
  { key: 'hygiene_kits.delete', module: 'hygiene_kits', action: 'delete', description: 'Delete hygiene kits' },
  { key: 'wallets.read', module: 'wallets', action: 'read', description: 'List wallets' },
  { key: 'wallets.update', module: 'wallets', action: 'update', description: 'Update wallets' },
];

export class RbacService {
  constructor(roleRepository, permissionRepository) {
    this.roleRepository = roleRepository;
    this.permissionRepository = permissionRepository;
    this.countUsersByRole = null;
  }

  bindCountUsersByRole(fn) {
    this.countUsersByRole = fn;
  }

  async seedDefaults() {
    // 1. Sync permissions
    const ops = SYSTEM_PERMISSIONS.map((p) => ({
      updateOne: {
        filter: { key: p.key },
        update: { $set: { ...p, isActive: true } },
        upsert: true,
      },
    }));
    await this.permissionRepository.bulkWrite(ops);

    const allKeys = SYSTEM_PERMISSIONS.map((p) => p.key);
    const beauticianKeys = ['users.read', 'categories.read', 'services.read', 'services.create', 'services.update'];

    // 2. Default system roles
    const roles = [
      {
        name: 'Super Admin',
        slug: 'super_admin',
        description: 'Full system access',
        permissions: allKeys,
        isSystem: true,
        isSuperAdmin: true,
        isActive: true,
      },
      {
        name: 'Admin',
        slug: 'admin',
        description: 'Salon admin with management access',
        permissions: allKeys,
        isSystem: true,
        isSuperAdmin: false,
        isActive: true,
      },
      {
        name: 'Beautician',
        slug: 'beautician',
        description: 'Beautician operational access',
        permissions: beauticianKeys,
        isSystem: true,
        isSuperAdmin: false,
        isActive: true,
      },
      {
        name: 'Customer',
        slug: 'customer',
        description: 'Customer role',
        permissions: [],
        isSystem: true,
        isSuperAdmin: false,
        isActive: true,
      },
    ];

    for (const r of roles) {
      await this.roleRepository.upsertBySlug(r);
    }
  }

  async listPermissions(query = {}) {
    const list = await this.permissionRepository.findActive();
    let items = list;
    if (query.module) {
      items = items.filter((p) => p.module?.toLowerCase() === query.module.toLowerCase());
    }
    if (query.search) {
      const q = query.search.toLowerCase();
      items = items.filter((p) => p.key.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    return { items, total: items.length };
  }

  async listRoles(query = {}) {
    const filter = {};
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive === 'true' || query.isActive === true;
    }
    const { items, total } = await this.roleRepository.findAndCount(filter);
    let result = items;
    if (this.countUsersByRole) {
      result = await Promise.all(
        items.map(async (role) => ({
          ...role,
          userCount: await this.countUsersByRole(role.slug),
        })),
      );
    }
    return { items: result, total };
  }

  async getRoleById(id) {
    const role = await this.roleRepository.findById(id);
    if (!role) throw new AppError('Role not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return role;
  }

  async getAuthorizationForSlug(slug) {
    if (!slug) return null;
    const role = await this.roleRepository.findBySlug(slug);
    if (!role) return null;
    return {
      slug: role.slug,
      isSuperAdmin: Boolean(role.isSuperAdmin),
      permissions: role.permissions || [],
      isActive: role.isActive !== false,
    };
  }

  async createRole(data) {
    const slug = String(data.slug || '').trim().toLowerCase();
    const existing = await this.roleRepository.findBySlug(slug);
    if (existing) throw new AppError(`Role slug "${slug}" already exists`, HttpStatus.CONFLICT, ErrorCodes.ROLE_SLUG_EXISTS);
    return this.roleRepository.create({ ...data, slug, isSystem: false, isSuperAdmin: false });
  }

  async updateRole(id, data) {
    const role = await this.getRoleById(id);
    if (role.isSuperAdmin && data.isActive === false) {
      throw new AppError('Super Admin cannot be deactivated', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
    return this.roleRepository.updateById(id, data);
  }

  async deleteRole(id) {
    const role = await this.getRoleById(id);
    if (role.isSystem) throw new AppError('Cannot delete system role', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    if (this.countUsersByRole) {
      const count = await this.countUsersByRole(role.slug);
      if (count > 0) throw new AppError('Role is assigned to users', HttpStatus.CONFLICT, ErrorCodes.ROLE_IN_USE);
    }
    return this.roleRepository.deleteById(id);
  }
}
