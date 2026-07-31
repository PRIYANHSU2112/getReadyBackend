import { Router } from 'express';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { optionalSingleUpload, optionalKycUpload } from '../../core/storage/multer.config.js';
import { beauticianProfileValidator } from './beautician-profile.validation.js';

/**
 * Beautician profile routes — beautician self-service + admin review.
 *
 * @param {import('./beautician-profile.controller.js').BeauticianProfileController} ctrl
 * @param {{ authenticate?: Function, checkPermission?: Function }} [guards]
 */
export function createBeauticianProfileRoutes(ctrl, guards = {}) {
  const router = Router();
  const authenticate = guards.authenticate || ((_req, _res, next) => next());
  const checkPermission =
    guards.checkPermission || ((_req, _res, next) => next());

  // ═══════════════════════════════════════════════════════════
  //  Beautician — own profile routes (auth-only, no RBAC)
  // ═══════════════════════════════════════════════════════════
  router.use(authenticate);

  // Profile
  router.post(
    '/',
    validate(beauticianProfileValidator, 'createProfile'),
    asyncHandler(ctrl.createProfile),
  );

  router.get(
    '/me',
    asyncHandler(ctrl.getMyProfile),
  );

  router.patch(
    '/me',
    validate(beauticianProfileValidator, 'updateProfile'),
    asyncHandler(ctrl.updateProfile),
  );

  // Upload 3 KYC images (profilePhoto, idCardFront, idCardBack) or single selfie
  router.post(
    '/me/selfie',
    optionalKycUpload(),
    asyncHandler(ctrl.uploadSelfie),
  );

  router.post(
    '/me/submit', asyncHandler(ctrl.submitForReview),
  );

  // Work History
  router.get(
    '/me/work-history',
    asyncHandler(ctrl.getWorkHistory),
  );

  router.post(
    '/me/work-history',
    validate(beauticianProfileValidator, 'createWorkHistory'),
    asyncHandler(ctrl.addWorkHistory),
  );

  router.patch(
    '/me/work-history/:id',
    validate(beauticianProfileValidator, 'workHistoryIdParams', 'params'),
    validate(beauticianProfileValidator, 'updateWorkHistory'),
    asyncHandler(ctrl.updateWorkHistory),
  );

  router.delete(
    '/me/work-history/:id',
    validate(beauticianProfileValidator, 'workHistoryIdParams', 'params'),
    asyncHandler(ctrl.deleteWorkHistory),
  );

  // Certificates
  router.get(
    '/me/certificates',
    asyncHandler(ctrl.getCertificates),
  );

  router.post(
    '/me/certificates',
    optionalSingleUpload('file'),
    validate(beauticianProfileValidator, 'createCertificate'),
    asyncHandler(ctrl.addCertificate),
  );

  router.patch(
    '/me/certificates/:id',
    validate(beauticianProfileValidator, 'certificateIdParams', 'params'),
    optionalSingleUpload('file'),
    validate(beauticianProfileValidator, 'updateCertificate'),
    asyncHandler(ctrl.updateCertificate),
  );

  router.delete(
    '/me/certificates/:id',
    validate(beauticianProfileValidator, 'certificateIdParams', 'params'),
    asyncHandler(ctrl.deleteCertificate),
  );

  // ═══════════════════════════════════════════════════════════
  //  Admin routes (RBAC protected)
  // ═══════════════════════════════════════════════════════════
  router.use(checkPermission);

  router.get(
    '/',
    validate(beauticianProfileValidator, 'listProfilesQuery', 'query'),
    asyncHandler(ctrl.listProfiles),
  );

  router.get(
    '/:id',
    validate(beauticianProfileValidator, 'profileIdParams', 'params'),
    asyncHandler(ctrl.getProfileById),
  );

  router.patch(
    '/:id/review',
    validate(beauticianProfileValidator, 'profileIdParams', 'params'),
    validate(beauticianProfileValidator, 'adminReviewProfile'),
    asyncHandler(ctrl.reviewProfile),
  );

  router.patch(
    '/:id/kyc-review',
    validate(beauticianProfileValidator, 'profileIdParams', 'params'),
    validate(beauticianProfileValidator, 'adminReviewKyc'),
    asyncHandler(ctrl.reviewKyc),
  );

  router.patch(
    '/certificates/:id/review',
    validate(beauticianProfileValidator, 'certificateIdParams', 'params'),
    validate(beauticianProfileValidator, 'adminReviewCertificate'),
    asyncHandler(ctrl.reviewCertificate),
  );

  return router;
}
