/**
 * Seed Super Admin user (created in code — not via API).
 * Also ensures RBAC system roles/permissions exist.
 *
 * Usage:
 *   node scripts/seed-super-admin.js
 *   npm run seed:super-admin
 */
import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import mongoose from 'mongoose';
import { UserModel } from '../services/user-service/src/models/user.model.js';
import { PermissionModel } from '../services/user-service/src/models/permission.model.js';
import { RoleModel } from '../services/user-service/src/models/role.model.js';
import { PermissionRepository, RoleRepository } from '../services/user-service/src/repositories/rbac.repository.js';
import { RbacService, SYSTEM_PERMISSIONS } from '../services/user-service/src/services/rbac.service.js';

const mongoUri = process.env.DATABASE_URI;
if (!mongoUri) {
  console.error('[ERROR]: DATABASE_URI environment variable is required.');
  process.exit(1);
}

const SUPER_ADMIN = {
  name: process.env.SUPER_ADMIN_NAME || 'GetReady Super Admin',
  email: (process.env.SUPER_ADMIN_EMAIL || 'admin@getready.com').toLowerCase().trim(),
  password: process.env.SUPER_ADMIN_PASSWORD || 'Admin@123',
  role: 'super_admin',
};

async function ensureRbac() {
  const service = new RbacService(
    new RoleRepository(RoleModel),
    new PermissionRepository(PermissionModel),
  );
  await service.seedDefaults();
  const { items: roles } = await service.listRoles();
  const { items: permissions } = await service.listPermissions();
  console.log(
    `RBAC ready: ${permissions.length} permission(s), roles: ${roles.map((r) => r.slug).join(', ')}`,
  );
  return service;
}

async function grantAllPermissionsToSuperAdminRole() {
  const allKeys = SYSTEM_PERMISSIONS.map((p) => p.key);

  const updated = await RoleModel.findOneAndUpdate(
    { slug: 'super_admin' },
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

  await RoleModel.findOneAndUpdate(
    { slug: 'admin' },
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

  console.log(`DB: ${mongoose.connection.name}`);
  console.log(
    `Super Admin role permissions saved (${updated.permissions?.length ?? 0})`,
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
  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  await ensureRbac();
  await grantAllPermissionsToSuperAdminRole();

  let existing = await UserModel.findOne({
    email: SUPER_ADMIN.email,
    deletedAt: null,
  }).select('+password');

  if (!existing) {
    existing = await UserModel.findOne({
      role: 'super_admin',
      deletedAt: null,
    }).select('+password');
  }

  if (existing) {
    existing.name = SUPER_ADMIN.name;
    existing.email = SUPER_ADMIN.email;
    existing.role = 'super_admin';
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
    user.set('phone', undefined);
    await user.save();

    console.log(`Created Super Admin: ${user.email} (id=${user._id})`);
  }

  console.log('--------------------------------------------------');
  console.log(`Super Admin Credentials:`);
  console.log(`  Email:    ${SUPER_ADMIN.email}`);
  console.log(`  Password: ${SUPER_ADMIN.password}`);
  console.log(`  Login:    POST /api/v1/auth/admin/login`);
  console.log('--------------------------------------------------');

  await mongoose.disconnect();
}

seedSuperAdmin().catch((err) => {
  console.error('Super Admin Seed Error:', err.message);
  process.exit(1);
});
