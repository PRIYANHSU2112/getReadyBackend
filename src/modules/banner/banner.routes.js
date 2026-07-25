import { Router } from 'express';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { optionalSingleUpload } from '../../core/storage/multer.config.js';
import { bannerValidator } from './banner.validation.js';

/**
 * Allow empty body when only a new image file is uploaded.
 */
function validateUpdate(schemaName) {
  return (req, res, next) => {
    if (req.file && (!req.body || Object.keys(req.body).length === 0)) {
      return next();
    }
    return validate(bannerValidator, schemaName)(req, res, next);
  };
}

/**
 * Public `/active` first; admin CRUD behind authenticate + checkPermission.
 * Create/update accept multipart `file` for banner image upload.
 *
 * @param {import('./banner.controller.js').BannerController} bannerController
 * @param {{ authenticate?: Function, checkPermission?: Function }} [guards]
 */
export function createBannerRoutes(bannerController, guards = {}) {
  const router = Router();
  const authenticate = guards.authenticate || ((_req, _res, next) => next());
  const checkPermission =
    guards.checkPermission || ((_req, _res, next) => next());

  router.get(
    '/active',
    validate(bannerValidator, 'activeBannersQuery', 'query'),
    asyncHandler(bannerController.listActive),
  );

  router.use(authenticate, checkPermission);

  router.get(
    '/',
    validate(bannerValidator, 'listBannersQuery', 'query'),
    asyncHandler(bannerController.list),
  );

  router.post(
    '/',
    optionalSingleUpload('file'),
    validate(bannerValidator, 'createBanner'),
    asyncHandler(bannerController.create),
  );

  router.get(
    '/:id',
    validate(bannerValidator, 'bannerIdParams', 'params'),
    asyncHandler(bannerController.getById),
  );

  router.patch(
    '/:id',
    validate(bannerValidator, 'bannerIdParams', 'params'),
    optionalSingleUpload('file'),
    validateUpdate('updateBanner'),
    asyncHandler(bannerController.update),
  );

  router.delete(
    '/:id',
    validate(bannerValidator, 'bannerIdParams', 'params'),
    asyncHandler(bannerController.remove),
  );

  return router;
}
