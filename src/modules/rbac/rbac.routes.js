import { Router } from 'express';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { rbacValidator } from './rbac.validation.js';

/**
 * @param {import('./rbac.controller.js').RbacController} rbacController
 * @param {{ authenticate: Function, checkPermission: Function }} guards
 */
export function createRoleRoutes(rbacController, guards) {
  const router = Router();
  const { authenticate, checkPermission } = guards;

  router.use(authenticate, checkPermission);

  router.get(
    '/',
    validate(rbacValidator, 'listRolesQuery', 'query'),
    asyncHandler(rbacController.listRoles),
  );

  router.post(
    '/',
    validate(rbacValidator, 'createRole'),
    asyncHandler(rbacController.createRole),
  );

  router.get(
    '/:id',
    validate(rbacValidator, 'roleIdParams', 'params'),
    asyncHandler(rbacController.getRoleById),
  );

  router.patch(
    '/:id',
    validate(rbacValidator, 'roleIdParams', 'params'),
    validate(rbacValidator, 'updateRole'),
    asyncHandler(rbacController.updateRole),
  );

  router.delete(
    '/:id',
    validate(rbacValidator, 'roleIdParams', 'params'),
    asyncHandler(rbacController.deleteRole),
  );

  router.put(
    '/:id/permissions',
    validate(rbacValidator, 'roleIdParams', 'params'),
    validate(rbacValidator, 'setRolePermissions'),
    asyncHandler(rbacController.setRolePermissions),
  );

  return router;
}

/**
 * @param {import('./rbac.controller.js').RbacController} rbacController
 * @param {{ authenticate: Function, checkPermission: Function }} guards
 */
export function createPermissionRoutes(rbacController, guards) {
  const router = Router();
  const { authenticate, checkPermission } = guards;

  router.use(authenticate, checkPermission);

  router.get(
    '/',
    validate(rbacValidator, 'listPermissionsQuery', 'query'),
    asyncHandler(rbacController.listPermissions),
  );

  router.post('/sync', asyncHandler(rbacController.syncPermissions));

  return router;
}
