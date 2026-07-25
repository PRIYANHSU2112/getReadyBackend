/**
 * Seed Super Admin user (created in code — not via API).
 * Also ensures RBAC system roles/permissions exist.
 *
 * Usage:
 *   node scripts/seed-super-admin.js
 *   npm run seed:super-admin
 *
 * Optional env overrides:
 *   SUPER_ADMIN_EMAIL=superadmin@salon.com
 *   SUPER_ADMIN_PASSWORD=SuperAdmin@123
 *   SUPER_ADMIN_NAME=Super Admin
 */
import crypto from 'crypto';
import mongoose from 'mongoose';
import config from '../src/core/config/index.js';
import { UserRole } from '../src/common/constants/enums.js';
import { UserModel } from '../src/modules/user/user.model.js';
import { PermissionModel } from '../src/modules/rbac/permission.model.js';
import { RoleModel } from '../src/modules/rbac/role.model.js';
import { PermissionRepository } from '../src/modules/rbac/permission.repository.js';
import { RoleRepository } from '../src/modules/rbac/role.repository.js';
import { RbacService } from '../src/modules/rbac/rbac.service.js';
import { getPermissionKeys } from '../src/common/permissions/permission.registry.js';

const SUPER_ADMIN = {
  name: process.env.SUPER_ADMIN_NAME || 'Super Admin',
  email: (process.env.SUPER_ADMIN_EMAIL || 'superadmin@salon.com').toLowerCase().trim(),
  password: process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123',
  role: UserRole.SUPER_ADMIN,
};

async function ensureRbac() {
  const service = new RbacService(
    new RoleRepository(RoleModel),
    new PermissionRepository(PermissionModel),
    null,
  );
  const result = await service.seedDefaults();
  console.log(
    `RBAC ready: ${result.permissions} permission(s), roles: ${result.roles.map((r) => r.slug).join(', ')}`,
  );
  return service;
}

/**
 * Assign every registry permission key to the super_admin role (forced DB write).
 */
async function grantAllPermissionsToSuperAdminRole(rbacService) {
  const allKeys = getPermissionKeys();

  const updated = await RoleModel.findOneAndUpdate(
    { slug: UserRole.SUPER_ADMIN },
    {
      $set: {
        name: 'Super Admin',
        description: 'Full system access — all permissions + Super Admin bypass',
        permissions: allKeys,
        isSuperAdmin: true,
        isSystem: true,
        isActive: true,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

  if (!updated) {
    throw new Error('Failed to update super_admin role permissions');
  }

  // Keep admin role fully permissioned as well
  await RoleModel.findOneAndUpdate(
    { slug: UserRole.ADMIN },
    {
      $set: {
        permissions: allKeys,
        isActive: true,
        isSystem: true,
        isSuperAdmin: false,
      },
    },
    { new: true },
  );

  if (rbacService?.invalidateCache) {
    await rbacService.invalidateCache(`rbac:role-auth:${UserRole.SUPER_ADMIN}`);
    await rbacService.invalidateCache(`rbac:role-auth:${UserRole.ADMIN}`);
  }

  console.log(`DB: ${mongoose.connection.name}`);
  console.log(
    `Super Admin role permissions saved (${updated.permissions?.length ?? 0}):`,
    updated.permissions,
  );
  return allKeys;
}

async function generateUniqueReferralCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `SA${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const existing = await UserModel.findOne({ referralCode: code }).lean();
    if (!existing) return code;
  }
  return `SA${Date.now().toString(36).toUpperCase()}`;
}

async function seedSuperAdmin() {
  await mongoose.connect(config.mongodbUri);
  console.log('Connected to MongoDB');

  const rbacService = await ensureRbac();
  await grantAllPermissionsToSuperAdminRole(rbacService);

  // Prefer exact email; otherwise reuse any existing super_admin (avoids phone:null unique clash)
  let existing = await UserModel.findOne({
    email: SUPER_ADMIN.email,
    deletedAt: null,
  }).select('+password');

  if (!existing) {
    existing = await UserModel.findOne({
      role: UserRole.SUPER_ADMIN,
      deletedAt: null,
    }).select('+password');
  }

  if (existing) {
    existing.name = SUPER_ADMIN.name;
    existing.email = SUPER_ADMIN.email;
    existing.role = UserRole.SUPER_ADMIN;
    existing.isActive = true;
    existing.password = SUPER_ADMIN.password;
    if (!existing.emailVerifiedAt) existing.emailVerifiedAt = new Date();
    await existing.save();
    console.log(`Upserted Super Admin: ${existing.email} (id=${existing._id})`);
  } else {
    const user = new UserModel({
      name: SUPER_ADMIN.name,
      email: SUPER_ADMIN.email,
      password: SUPER_ADMIN.password,
      role: SUPER_ADMIN.role,
      referralCode: await generateUniqueReferralCode(),
      emailVerifiedAt: new Date(),
      isActive: true,
    });
    // Avoid sparse unique index clash on phone: null
    user.set('phone', undefined);
    await user.save();

    console.log(`Created Super Admin: ${user.email} (id=${user._id})`);
  }

  console.log('---');
  console.log(`Login (admin): POST /api/v1/auth/admin/login`);
  console.log(`  email:    ${SUPER_ADMIN.email}`);
  console.log(
    `  password: ${process.env.SUPER_ADMIN_PASSWORD ? '(from SUPER_ADMIN_PASSWORD)' : SUPER_ADMIN.password}`,
  );
  console.log('---');

  await mongoose.disconnect();
}

seedSuperAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
