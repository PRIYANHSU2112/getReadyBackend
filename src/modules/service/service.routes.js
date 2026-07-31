import { Router } from 'express';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { optionalServiceMediaUpload } from '../../core/storage/multer.config.js';
import { serviceValidator } from './service.validation.js';

function validateUpdate() {
  return (req, res, next) => {
    if (
      (req.files?.length || req.file) &&
      (!req.body || Object.keys(req.body).length === 0)
    ) {
      return next();
    }
    return validate(serviceValidator, 'updateService')(req, res, next);
  };
}

/**
 * @param {import('./service.controller.js').ServiceController} serviceController
 * @param {{ authenticate?: Function, checkPermission?: Function }} [guards]
 */
export function createServiceRoutes(serviceController, guards = {}) {
  const router = Router();
  const authenticate = guards.authenticate || ((_req, _res, next) => next());
  const checkPermission =
    guards.checkPermission || ((_req, _res, next) => next());

  router.get(
    '/public',
    validate(serviceValidator, 'publicServicesQuery', 'query'),
    asyncHandler(serviceController.listPublic),
  );

  router.get(
    '/public/category/:categoryId',
    validate(serviceValidator, 'categoryServicesParams', 'params'),
    validate(serviceValidator, 'publicServicesQuery', 'query'),
    asyncHandler(serviceController.listPublicByCategory),
  );

  router.get(
    '/public/:slug',
    validate(serviceValidator, 'publicSlugParams', 'params'),
    asyncHandler(serviceController.getPublicBySlug),
  );

  router.use(authenticate, checkPermission);

  router.patch(
    '/reorder',
    validate(serviceValidator, 'reorderBody'),
    asyncHandler(serviceController.reorder),
  );

  router.patch(
    '/bulk/status',
    validate(serviceValidator, 'bulkStatusBody'),
    asyncHandler(serviceController.bulkSetStatus),
  );

  router.post(
    '/bulk/delete',
    validate(serviceValidator, 'bulkDeleteBody'),
    asyncHandler(serviceController.bulkDelete),
  );

  router.get(
    '/',
    validate(serviceValidator, 'listServicesQuery', 'query'),
    asyncHandler(serviceController.list),
  );

  router.post(
    '/',
    optionalServiceMediaUpload(),
    validate(serviceValidator, 'createService'),
    asyncHandler(serviceController.create),
  );

  router.get(
    '/:id',
    validate(serviceValidator, 'serviceIdParams', 'params'),
    asyncHandler(serviceController.getById),
  );

  router.patch(
    '/:id',
    validate(serviceValidator, 'serviceIdParams', 'params'),
    optionalServiceMediaUpload(),
    validateUpdate(),
    asyncHandler(serviceController.update),
  );

  router.delete(
    '/:id',
    validate(serviceValidator, 'serviceIdParams', 'params'),
    asyncHandler(serviceController.remove),
  );

  router.post(
    '/:id/restore',
    validate(serviceValidator, 'serviceIdParams', 'params'),
    asyncHandler(serviceController.restore),
  );

  router.patch(
    '/:id/status',
    validate(serviceValidator, 'serviceIdParams', 'params'),
    validate(serviceValidator, 'statusBody'),
    asyncHandler(serviceController.setStatus),
  );

  router.post(
    '/:id/approve',
    validate(serviceValidator, 'serviceIdParams', 'params'),
    validate(serviceValidator, 'approveCreateBody'),
    asyncHandler(serviceController.approveCreate),
  );

  router.post(
    '/:id/reject',
    validate(serviceValidator, 'serviceIdParams', 'params'),
    validate(serviceValidator, 'rejectBody'),
    asyncHandler(serviceController.rejectCreate),
  );

  return router;
}

/**
 * Change-request review routes for admin panel.
 * @param {import('./service.controller.js').ServiceController} serviceController
 * @param {{ authenticate?: Function, checkPermission?: Function }} [guards]
 */
export function createServiceChangeRequestRoutes(
  serviceController,
  guards = {},
) {
  const router = Router();
  const authenticate = guards.authenticate || ((_req, _res, next) => next());
  const checkPermission =
    guards.checkPermission || ((_req, _res, next) => next());

  router.use(authenticate, checkPermission);

  router.get(
    '/',
    validate(serviceValidator, 'listChangeRequestsQuery', 'query'),
    asyncHandler(serviceController.listChangeRequests),
  );

  router.get(
    '/:id',
    validate(serviceValidator, 'changeRequestIdParams', 'params'),
    asyncHandler(serviceController.getChangeRequestById),
  );

  router.post(
    '/:id/approve',
    validate(serviceValidator, 'changeRequestIdParams', 'params'),
    validate(serviceValidator, 'approveChangeRequestBody'),
    asyncHandler(serviceController.approveChangeRequest),
  );

  router.post(
    '/:id/reject',
    validate(serviceValidator, 'changeRequestIdParams', 'params'),
    validate(serviceValidator, 'rejectChangeRequestBody'),
    asyncHandler(serviceController.rejectChangeRequest),
  );

  return router;
}
