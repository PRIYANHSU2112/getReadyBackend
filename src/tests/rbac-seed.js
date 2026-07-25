import { PermissionModel } from '../modules/rbac/permission.model.js';
import { RoleModel } from '../modules/rbac/role.model.js';
import { PermissionRepository } from '../modules/rbac/permission.repository.js';
import { RoleRepository } from '../modules/rbac/role.repository.js';
import { RbacService } from '../modules/rbac/rbac.service.js';

/**
 * Seed registry permissions + system roles for integration tests.
 */
export async function seedRbacForTests() {
  const service = new RbacService(
    new RoleRepository(RoleModel),
    new PermissionRepository(PermissionModel),
    null,
  );
  return service.seedDefaults();
}
