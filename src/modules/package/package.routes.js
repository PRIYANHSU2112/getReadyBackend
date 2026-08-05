import { Router } from 'express';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { optionalPackageMediaUpload } from '../../core/storage/multer.config.js';
import { packageValidator } from './package.validation.js';

function validateUpdate() {
  return (req, res, next) => {
    if (
      (req.files?.length || req.file) &&
      (!req.body || Object.keys(req.body).length === 0)
    ) {
      return next();
    }
    return validate(packageValidator, 'updatePackage')(req, res, next);
  };
}

export function createPackageRoutes(packageController, guards = {}) {
  const router = Router();
  const authenticate = guards.authenticate || ((_req, _res, next) => next());

  // Public Endpoints
  router.get(
    '/public',
    validate(packageValidator, 'publicPackagesQuery', 'query'),
    asyncHandler(packageController.listPublic),
  );

  router.get(
    '/public/category/:categoryId',
    (req, _res, next) => {
      req.query.categoryId = req.params.categoryId;
      next();
    },
    validate(packageValidator, 'publicPackagesQuery', 'query'),
    asyncHandler(packageController.listPublic),
  );

  router.get(
    '/public/slug/:slug',
    asyncHandler(packageController.getPublicBySlug),
  );

  router.get(
    '/public/:id',
    asyncHandler(packageController.getPublicById),
  );

  // Authenticated Staff/Admin Package Endpoints
  router.get('/', authenticate, asyncHandler(packageController.listAdmin));

  router.post(
    '/',
    authenticate,
    optionalPackageMediaUpload(),
    validate(packageValidator, 'createPackage'),
    asyncHandler(packageController.create),
  );

  router.patch(
    '/:id',
    authenticate,
    optionalPackageMediaUpload(),
    validateUpdate(),
    asyncHandler(packageController.update),
  );

  router.post(
    '/:id/approve',
    authenticate,
    validate(packageValidator, 'approvePackage'),
    asyncHandler(packageController.approve),
  );

  router.post(
    '/:id/reject',
    authenticate,
    validate(packageValidator, 'rejectPackage'),
    asyncHandler(packageController.reject),
  );

  router.delete('/:id', authenticate, asyncHandler(packageController.delete));

  // Package Change Request Endpoints
  router.get(
    '/change-requests/list',
    authenticate,
    asyncHandler(packageController.listChangeRequests),
  );

  router.post(
    '/change-requests/:id/approve',
    authenticate,
    asyncHandler(packageController.approveChangeRequest),
  );

  router.post(
    '/change-requests/:id/reject',
    authenticate,
    validate(packageValidator, 'rejectPackage'),
    asyncHandler(packageController.rejectChangeRequest),
  );

  return router;
}
