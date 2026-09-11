/**
 * Seed / sync RBAC permissions and system roles from the permission registry.
 *
 * Usage: node scripts/seed-rbac.js
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { PermissionModel } from '../services/user-service/src/models/permission.model.js';
import { RoleModel } from '../services/user-service/src/models/role.model.js';
import { PermissionRepository, RoleRepository } from '../services/user-service/src/repositories/rbac.repository.js';
import { RbacService } from '../services/user-service/src/services/rbac.service.js';

const mongoUri = process.env.DATABASE_URI;
if (!mongoUri) {
  console.error('[ERROR]: DATABASE_URI environment variable is required.');
  process.exit(1);
}

async function seed() {
  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(mongoUri);
  console.log(`Connected to MongoDB (${mongoose.connection.name})`);

  const service = new RbacService(
    new RoleRepository(RoleModel),
    new PermissionRepository(PermissionModel),
  );

  await service.seedDefaults();
  const { items: roles } = await service.listRoles();
  const { items: permissions } = await service.listPermissions();
  console.log(
    `Seeded ${permissions.length} permission(s) and ${roles.length} role(s):`,
    roles.map((r) => r.slug).join(', '),
  );

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error('RBAC Seed Error:', err.message);
  process.exit(1);
});
