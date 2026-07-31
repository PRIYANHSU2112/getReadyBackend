import { Router } from 'express';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { optionalSingleUpload } from '../../core/storage/multer.config.js';
import { bankDetailValidator } from './bank-detail.validation.js';

/**
 * Bank detail routes — beautician self-service + admin review.
 *
 * @param {import('./bank-detail.controller.js').BankDetailController} ctrl
 * @param {{ authenticate?: Function, checkPermission?: Function }} [guards]
 */
export function createBankDetailRoutes(ctrl, guards = {}) {
  const router = Router();
  const authenticate = guards.authenticate || ((_req, _res, next) => next());
  const checkPermission =
    guards.checkPermission || ((_req, _res, next) => next());

  // ═══════════════════════════════════════════════════════════
  //  Beautician — own bank details (auth-only)
  // ═══════════════════════════════════════════════════════════
  router.use(authenticate);

  router.get(
    '/me',
    asyncHandler(ctrl.getMyBankDetail),
  );

  router.put(
    '/me',
    optionalSingleUpload('file'),
    validate(bankDetailValidator, 'createBankDetail'),
    asyncHandler(ctrl.upsertBankDetail),
  );

  router.delete(
    '/me',
    asyncHandler(ctrl.deleteBankDetail),
  );

  // ═══════════════════════════════════════════════════════════
  //  Admin routes (RBAC protected)
  // ═══════════════════════════════════════════════════════════
  router.use(checkPermission);

  router.get(
    '/',
    validate(bankDetailValidator, 'listBankDetailsQuery', 'query'),
    asyncHandler(ctrl.listBankDetails),
  );

  router.get(
    '/:id',
    validate(bankDetailValidator, 'bankDetailIdParams', 'params'),
    asyncHandler(ctrl.getBankDetailById),
  );

  router.patch(
    '/:id/review',
    validate(bankDetailValidator, 'bankDetailIdParams', 'params'),
    validate(bankDetailValidator, 'adminReviewBankDetail'),
    asyncHandler(ctrl.reviewBankDetail),
  );

  return router;
}
