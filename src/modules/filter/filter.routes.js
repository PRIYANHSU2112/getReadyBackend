import { Router } from 'express';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { optionalSingleUpload } from '../../core/storage/multer.config.js';
import { filterValidator } from './filter.validation.js';

/**
 * Allow empty body when only a new image file is uploaded.
 */
function validateUpdate(schemaName) {
  return (req, res, next) => {
    if (req.file && (!req.body || Object.keys(req.body).length === 0)) {
      return next();
    }
    return validate(filterValidator, schemaName)(req, res, next);
  };
}

/**
 * Public + static paths first; then admin CRUD; then nested values.
 * Create/update accept multipart `file` for image upload (S3).
 *
 * @param {import('./filter.controller.js').FilterController} filterController
 * @param {{ authenticate?: Function, checkPermission?: Function }} [guards]
 */
export function createFilterRoutes(filterController, guards = {}) {
  const router = Router();
  const authenticate = guards.authenticate || ((_req, _res, next) => next());
  const checkPermission =
    guards.checkPermission || ((_req, _res, next) => next());

  router.get(
    '/public',
    validate(filterValidator, 'publicFiltersQuery', 'query'),
    asyncHandler(filterController.listPublic),
  );

  router.use(authenticate, checkPermission);

  router.patch(
    '/reorder',
    validate(filterValidator, 'reorderBody'),
    asyncHandler(filterController.reorder),
  );

  router.patch(
    '/bulk/status',
    validate(filterValidator, 'bulkStatusBody'),
    asyncHandler(filterController.bulkSetStatus),
  );

  router.post(
    '/bulk/delete',
    validate(filterValidator, 'bulkDeleteBody'),
    asyncHandler(filterController.bulkDelete),
  );

  router.get(
    '/',
    validate(filterValidator, 'listFiltersQuery', 'query'),
    asyncHandler(filterController.list),
  );

  router.post(
    '/',
    optionalSingleUpload('file'),
    validate(filterValidator, 'createFilter'),
    asyncHandler(filterController.create),
  );

  router.get(
    '/:id',
    validate(filterValidator, 'filterIdParams', 'params'),
    asyncHandler(filterController.getById),
  );

  router.patch(
    '/:id',
    validate(filterValidator, 'filterIdParams', 'params'),
    optionalSingleUpload('file'),
    validateUpdate('updateFilter'),
    asyncHandler(filterController.update),
  );

  router.delete(
    '/:id',
    validate(filterValidator, 'filterIdParams', 'params'),
    asyncHandler(filterController.remove),
  );

  router.post(
    '/:id/restore',
    validate(filterValidator, 'filterIdParams', 'params'),
    asyncHandler(filterController.restore),
  );

  router.patch(
    '/:id/status',
    validate(filterValidator, 'filterIdParams', 'params'),
    validate(filterValidator, 'statusBody'),
    asyncHandler(filterController.setStatus),
  );

  router.get(
    '/:filterId/values',
    validate(filterValidator, 'filterIdOnlyParams', 'params'),
    validate(filterValidator, 'listFilterValuesQuery', 'query'),
    asyncHandler(filterController.listValues),
  );

  router.post(
    '/:filterId/values',
    validate(filterValidator, 'filterIdOnlyParams', 'params'),
    optionalSingleUpload('file'),
    validate(filterValidator, 'createFilterValue'),
    asyncHandler(filterController.createValue),
  );

  router.patch(
    '/:filterId/values/reorder',
    validate(filterValidator, 'filterIdOnlyParams', 'params'),
    validate(filterValidator, 'reorderBody'),
    asyncHandler(filterController.reorderValues),
  );

  router.patch(
    '/:filterId/values/:valueId',
    validate(filterValidator, 'valueIdParams', 'params'),
    optionalSingleUpload('file'),
    validateUpdate('updateFilterValue'),
    asyncHandler(filterController.updateValue),
  );

  router.delete(
    '/:filterId/values/:valueId',
    validate(filterValidator, 'valueIdParams', 'params'),
    asyncHandler(filterController.removeValue),
  );

  router.post(
    '/:filterId/values/:valueId/restore',
    validate(filterValidator, 'valueIdParams', 'params'),
    asyncHandler(filterController.restoreValue),
  );

  return router;
}
