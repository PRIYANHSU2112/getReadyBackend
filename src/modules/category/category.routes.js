import { Router } from 'express';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { optionalSingleUpload } from '../../core/storage/multer.config.js';
import { categoryValidator } from './category.validation.js';

/**
 * Allow empty body when only a new image file is uploaded.
 */
function validateUpdate(schemaName) {
  return (req, res, next) => {
    if (req.file && (!req.body || Object.keys(req.body).length === 0)) {
      return next();
    }
    return validate(categoryValidator, schemaName)(req, res, next);
  };
}

/**
 * Public paths first; then admin/staff CRUD.
 * Create/update accept multipart `file` for image upload (S3).
 *
 * @param {import('./category.controller.js').CategoryController} categoryController
 * @param {{ authenticate?: Function, checkPermission?: Function }} [guards]
 */
export function createCategoryRoutes(categoryController, guards = {}) {
  const router = Router();
  const authenticate = guards.authenticate || ((_req, _res, next) => next());
  const checkPermission =
    guards.checkPermission || ((_req, _res, next) => next());

  router.get(
    '/public',
    validate(categoryValidator, 'publicCategoriesQuery', 'query'),
    asyncHandler(categoryController.listPublic),
  );

  router.get(
    '/public/:slug',
    validate(categoryValidator, 'publicSlugParams', 'params'),
    asyncHandler(categoryController.getPublicBySlug),
  );

  router.use(authenticate, checkPermission);

  router.patch(
    '/reorder',
    validate(categoryValidator, 'reorderBody'),
    asyncHandler(categoryController.reorder),
  );

  router.patch(
    '/bulk/status',
    validate(categoryValidator, 'bulkStatusBody'),
    asyncHandler(categoryController.bulkSetStatus),
  );

  router.post(
    '/bulk/delete',
    validate(categoryValidator, 'bulkDeleteBody'),
    asyncHandler(categoryController.bulkDelete),
  );

  router.get(
    '/',
    validate(categoryValidator, 'listCategoriesQuery', 'query'),
    asyncHandler(categoryController.list),
  );

  router.post(
    '/',
    optionalSingleUpload('file'),
    validate(categoryValidator, 'createCategory'),
    asyncHandler(categoryController.create),
  );

  router.get(
    '/:id',
    validate(categoryValidator, 'categoryIdParams', 'params'),
    asyncHandler(categoryController.getById),
  );

  router.patch(
    '/:id',
    validate(categoryValidator, 'categoryIdParams', 'params'),
    optionalSingleUpload('file'),
    validateUpdate('updateCategory'),
    asyncHandler(categoryController.update),
  );

  router.delete(
    '/:id',
    validate(categoryValidator, 'categoryIdParams', 'params'),
    asyncHandler(categoryController.remove),
  );

  router.post(
    '/:id/restore',
    validate(categoryValidator, 'categoryIdParams', 'params'),
    asyncHandler(categoryController.restore),
  );

  router.patch(
    '/:id/status',
    validate(categoryValidator, 'categoryIdParams', 'params'),
    validate(categoryValidator, 'statusBody'),
    asyncHandler(categoryController.setStatus),
  );

  return router;
}
