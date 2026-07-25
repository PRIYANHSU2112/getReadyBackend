/**
 * Seed / sync RBAC permissions and system roles from the permission registry.
 *
 * Usage: node scripts/seed-rbac.js
 */
import mongoose from 'mongoose';
import config from '../src/core/config/index.js';
import { PermissionModel } from '../src/modules/rbac/permission.model.js';
import { RoleModel } from '../src/modules/rbac/role.model.js';
import { PermissionRepository } from '../src/modules/rbac/permission.repository.js';
import { RoleRepository } from '../src/modules/rbac/role.repository.js';
import { RbacService } from '../src/modules/rbac/rbac.service.js';

async function seed() {
  await mongoose.connect(config.mongodbUri);

  const service = new RbacService(
    new RoleRepository(RoleModel),
    new PermissionRepository(PermissionModel),
    null,
  );

  const result = await service.seedDefaults();
  console.log(
    `Seeded ${result.permissions} permission(s) and ${result.roles.length} role(s):`,
    result.roles.map((r) => r.slug).join(', '),
  );

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
