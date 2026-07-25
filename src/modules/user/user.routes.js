import { Router } from 'express';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { optionalSingleUpload } from '../../core/storage/multer.config.js';
import { userValidator } from './user.validation.js';

/**
 * Allow empty body when a file is uploaded (profile image update only).
 */
function validateUpdate(schemaName) {
  return (req, res, next) => {
    if (req.file && (!req.body || Object.keys(req.body).length === 0)) {
      return next();
    }
    return validate(userValidator, schemaName)(req, res, next);
  };
}

/**
 * @param {import('./user.controller.js').UserController} userController
 * @param {{ authenticate?: Function, checkPermission?: Function }} [guards]
 */
export function createUserRoutes(userController, guards = {}) {
  const router = Router();
  const authenticate = guards.authenticate || ((_req, _res, next) => next());
  const checkPermission =
    guards.checkPermission || ((_req, _res, next) => next());

  router.use(authenticate, checkPermission);

  router.get('/me', asyncHandler(userController.getMe));
  router.patch(
    '/me',
    optionalSingleUpload('file'),
    validateUpdate('updateMe'),
    asyncHandler(userController.updateMe),
  );

  router.get(
    '/',
    validate(userValidator, 'listUsersQuery', 'query'),
    asyncHandler(userController.list),
  );

  router.post(
    '/',
    validate(userValidator, 'createUser'),
    asyncHandler(userController.create),
  );

  router.get(
    '/:id',
    validate(userValidator, 'getUserParams', 'params'),
    asyncHandler(userController.getById),
  );

  router.patch(
    '/:id',
    validate(userValidator, 'getUserParams', 'params'),
    optionalSingleUpload('file'),
    validateUpdate('updateUser'),
    asyncHandler(userController.update),
  );

  router.delete(
    '/:id',
    validate(userValidator, 'getUserParams', 'params'),
    asyncHandler(userController.remove),
  );

  return router;
}
