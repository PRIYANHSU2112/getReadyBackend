import { Router } from 'express';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { optionalSingleUpload } from '../../core/storage/multer.config.js';
import { blogValidator } from './blog.validation.js';

function validateUpdate(schemaName) {
  return (req, res, next) => {
    if (req.file && (!req.body || Object.keys(req.body).length === 0)) {
      return next();
    }
    return validate(blogValidator, schemaName)(req, res, next);
  };
}

/**
 * Blog routes — public home/list/detail; auth like; admin manage CRUD + image upload.
 *
 * @param {import('./blog.controller.js').BlogController} blogController
 * @param {{ authenticate?: Function, checkPermission?: Function }} [guards]
 */
export function createBlogRoutes(blogController, guards = {}) {
  const router = Router();
  const authenticate = guards.authenticate || ((_req, _res, next) => next());
  const checkPermission =
    guards.checkPermission || ((_req, _res, next) => next());

  // GET /home — Blogs screen ka main API (one-shot): categories chips + Latest hero + Most Popular list
  router.get(
    '/home',
    validate(blogValidator, 'homeBlogsQuery', 'query'),
    asyncHandler(blogController.home),
  );

  // GET / — View All / paginated published blogs list (sort=popular|latest, categoryId filter)
  router.get(
    '/',
    validate(blogValidator, 'listBlogsQuery', 'query'),
    asyncHandler(blogController.listPublic),
  );

  // POST /:id/like — Heart button: logged-in user blog ko like kare (idempotent, count +1 once)
  router.post(
    '/:id/like',
    authenticate,
    validate(blogValidator, 'blogIdParams', 'params'),
    asyncHandler(blogController.like),
  );

  // GET /manage — Admin panel: saare blogs list (draft/published/archived) with filters
  router.get(
    '/manage',
    authenticate,
    checkPermission,
    validate(blogValidator, 'manageBlogsQuery', 'query'),
    asyncHandler(blogController.listManage),
  );

  // GET /manage/:id — Admin: ek blog ka full detail (draft bhi dikhega)
  router.get(
    '/manage/:id',
    authenticate,
    checkPermission,
    validate(blogValidator, 'blogIdParams', 'params'),
    asyncHandler(blogController.getById),
  );

  // POST / — Admin: naya blog create (optional cover image file upload)
  router.post(
    '/',
    authenticate,
    checkPermission,
    optionalSingleUpload('file'),
    validate(blogValidator, 'createBlog'),
    asyncHandler(blogController.create),
  );

  // GET /:id — App: Read More — published blog detail by id ya slug (full content)
  router.get(
    '/:id',
    validate(blogValidator, 'blogIdParams', 'params'),
    asyncHandler(blogController.getPublic),
  );

  // PATCH /:id — Admin: blog update / publish / archive (+ optional naya cover image)
  router.patch(
    '/:id',
    authenticate,
    checkPermission,
    validate(blogValidator, 'blogIdParams', 'params'),
    optionalSingleUpload('file'),
    validateUpdate('updateBlog'),
    asyncHandler(blogController.update),
  );

  // DELETE /:id — Admin: blog soft-delete (archive)
  router.delete(
    '/:id',
    authenticate,
    checkPermission,
    validate(blogValidator, 'blogIdParams', 'params'),
    asyncHandler(blogController.remove),
  );

  return router;
}
