import { Router } from 'express';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { optionalSingleUpload } from '../../core/storage/multer.config.js';
import { hygieneKitValidator } from './hygiene-kit.validation.js';

function validateUpdate(schemaName) {
  return (req, res, next) => {
    if (req.file && (!req.body || Object.keys(req.body).length === 0)) {
      return next();
    }
    return validate(hygieneKitValidator, schemaName)(req, res, next);
  };
}

/**
 * @param {import('./hygiene-kit.controller.js').HygieneKitController} hygieneKitController
 * @param {{ authenticate?: Function, checkPermission?: Function }} [guards]
 */
export function createHygieneKitRoutes(hygieneKitController, guards = {}) {
  const router = Router();
  const authenticate = guards.authenticate || ((_req, _res, next) => next());
  const checkPermission = guards.checkPermission || ((_req, _res, next) => next());

  // Public Endpoints (App / Cart / Info modal)
  router.get(
    '/default',
    asyncHandler(hygieneKitController.getDefault),
  );

  router.get(
    '/active',
    validate(hygieneKitValidator, 'activeHygieneKitsQuery', 'query'),
    asyncHandler(hygieneKitController.listActive),
  );

  // Authenticated & RBAC Guarded Endpoints (Admin)
  router.get(
    '/',
    authenticate,
    checkPermission,
    validate(hygieneKitValidator, 'listHygieneKitsQuery', 'query'),
    asyncHandler(hygieneKitController.list),
  );

  router.post(
    '/',
    authenticate,
    checkPermission,
    optionalSingleUpload('file'),
    validate(hygieneKitValidator, 'createHygieneKit'),
    asyncHandler(hygieneKitController.create),
  );

  router.patch(
    '/:id/default',
    authenticate,
    checkPermission,
    validate(hygieneKitValidator, 'kitIdParams', 'params'),
    asyncHandler(hygieneKitController.setDefault),
  );

  router.patch(
    '/:id/status',
    authenticate,
    checkPermission,
    validate(hygieneKitValidator, 'kitIdParams', 'params'),
    validate(hygieneKitValidator, 'statusBody'),
    asyncHandler(hygieneKitController.setStatus),
  );

  router.post(
    '/:id/restore',
    authenticate,
    checkPermission,
    validate(hygieneKitValidator, 'kitIdParams', 'params'),
    asyncHandler(hygieneKitController.restore),
  );

  router.get(
    '/:id',
    validate(hygieneKitValidator, 'kitIdParams', 'params'),
    asyncHandler(hygieneKitController.getById),
  );

  router.patch(
    '/:id',
    authenticate,
    checkPermission,
    validate(hygieneKitValidator, 'kitIdParams', 'params'),
    optionalSingleUpload('file'),
    validateUpdate('updateHygieneKit'),
    asyncHandler(hygieneKitController.update),
  );

  router.put(
    '/:id',
    authenticate,
    checkPermission,
    validate(hygieneKitValidator, 'kitIdParams', 'params'),
    optionalSingleUpload('file'),
    validateUpdate('updateHygieneKit'),
    asyncHandler(hygieneKitController.update),
  );

  router.delete(
    '/:id',
    authenticate,
    checkPermission,
    validate(hygieneKitValidator, 'kitIdParams', 'params'),
    asyncHandler(hygieneKitController.remove),
  );

  return router;
}
