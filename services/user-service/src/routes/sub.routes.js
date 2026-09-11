import { Router } from 'express';
import { validate } from '@getready/validation';
import { userValidator } from '../validators/user.validation.js';

export function createAddressRoutes(controller) {
  const router = Router();
  router.get('/', controller.list);
  router.post('/', validate(userValidator, 'createAddress'), controller.create);
  router.get('/:id', controller.getById);
  router.patch('/:id', validate(userValidator, 'updateAddress'), controller.update);
  router.delete('/:id', controller.remove);
  router.put('/:id/default', controller.setDefault);
  return router;
}

export function createMemberRoutes(controller) {
  const router = Router();
  router.get('/', controller.list);
  router.get('/user/:userId', controller.listForAccountOwner);
  router.post('/', validate(userValidator, 'createMember'), controller.create);
  router.get('/:id', controller.getById);
  router.patch('/:id', validate(userValidator, 'updateMember'), controller.update);
  router.delete('/:id', controller.remove);
  router.get('/:id/beauty-passport', controller.getBeautyPassport);
  router.post('/:id/beauty-passport/entry', controller.addBeautyPassportEntry);
  return router;
}

export function createRbacRoutes(controller) {
  const rolesRouter = Router();
  rolesRouter.get('/', controller.listRoles);
  rolesRouter.post('/', validate(userValidator, 'createRole'), controller.createRole);
  rolesRouter.get('/:id', controller.getRoleById);
  rolesRouter.patch('/:id', validate(userValidator, 'updateRole'), controller.updateRole);
  rolesRouter.delete('/:id', controller.deleteRole);

  const permissionsRouter = Router();
  permissionsRouter.get('/', controller.listPermissions);
  permissionsRouter.post('/sync', controller.syncPermissions);

  return { rolesRouter, permissionsRouter };
}
