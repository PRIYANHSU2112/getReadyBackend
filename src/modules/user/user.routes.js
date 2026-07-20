import { Router } from 'express';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { userValidator } from './user.validation.js';

/**
 * @param {import('./user.controller.js').UserController} userController
 * @param {{ authenticate?: Function }} [guards]
 */
export function createUserRoutes(userController, guards = {}) {
  const router = Router();

  router.post(
    '/login',
    validate(userValidator, 'loginUser'),
    asyncHandler(userController.login),
  );

  router.post('/', validate(userValidator, 'createUser'), asyncHandler(userController.create));

  router.get(
    '/',
    guards.authenticate || ((req, res, next) => next()),
    validate(userValidator, 'listUsersQuery', 'query'),
    asyncHandler(userController.list),
  );

  router.get(
    '/:id',
    guards.authenticate || ((req, res, next) => next()),
    validate(userValidator, 'getUserParams', 'params'),
    asyncHandler(userController.getById),
  );

  router.patch(
    '/:id',
    guards.authenticate || ((req, res, next) => next()),
    validate(userValidator, 'getUserParams', 'params'),
    validate(userValidator, 'updateUser'),
    asyncHandler(userController.update),
  );

  router.delete(
    '/:id',
    guards.authenticate || ((req, res, next) => next()),
    validate(userValidator, 'getUserParams', 'params'),
    asyncHandler(userController.remove),
  );

  return router;
}
