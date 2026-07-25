import { PermissionModel } from './permission.model.js';
import { RoleModel } from './role.model.js';
import { PermissionRepository } from './permission.repository.js';
import { RoleRepository } from './role.repository.js';
import { RbacService } from './rbac.service.js';
import { RbacController } from './rbac.controller.js';
import { createRoleRoutes, createPermissionRoutes } from './rbac.routes.js';
import { createCheckPermission } from '../../common/middleware/authorize.middleware.js';
import { rbacDocs } from './rbac.docs.js';

/**
 * RBAC module factory — wires Repository → Service → Controller → Routes.
 * @param {{
 *   authenticate: Function,
 *   cacheService?: object|null,
 * }} deps
 */
export function createRbacModule({ authenticate, cacheService = null }) {
  const permissionRepository = new PermissionRepository(PermissionModel);
  const roleRepository = new RoleRepository(RoleModel);
  const service = new RbacService(roleRepository, permissionRepository, cacheService);
  const checkPermission = createCheckPermission({ roleService: service });
  const controller = new RbacController(service);

  const guards = { authenticate, checkPermission };

  return {
    service,
    checkPermission,
    roleRoutes: createRoleRoutes(controller, guards),
    permissionRoutes: createPermissionRoutes(controller, guards),
    docs: rbacDocs,
  };
}

export { rbacDocs } from './rbac.docs.js';
export { rbacValidator } from './rbac.validation.js';
export { RoleModel } from './role.model.js';
export { PermissionModel } from './permission.model.js';
