import { Router } from 'express';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { authValidator } from './auth.validation.js';

/**
 * @param {import('./auth.controller.js').AuthController} authController
 * @param {{ authenticate?: Function }} [guards]
 */
export function createAuthRoutes(authController, guards = {}) {
  const router = Router();
  const authenticate = guards.authenticate || ((_req, _res, next) => next());

  router.post(
    '/admin/login',
    validate(authValidator, 'adminLogin'),
    asyncHandler(authController.adminLogin),
  );

  router.post(
    '/login',
    validate(authValidator, 'adminLogin'),
    asyncHandler(authController.adminLogin),
  );

  router.post(
    '/admin/forgot-password',
    validate(authValidator, 'adminForgotPassword'),
    asyncHandler(authController.adminForgotPassword),
  );

  router.post(
    '/admin/reset-password',
    validate(authValidator, 'adminResetPassword'),
    asyncHandler(authController.adminResetPassword),
  );

  router.post(
    '/mobile/send-otp',
    validate(authValidator, 'mobileSendOtp'),
    asyncHandler(authController.mobileSendOtp),
  );

  router.post(
    '/mobile/resend-otp',
    validate(authValidator, 'mobileResendOtp'),
    asyncHandler(authController.mobileResendOtp),
  );

  router.post(
    '/mobile/verify-otp',
    validate(authValidator, 'mobileVerifyOtp'),
    asyncHandler(authController.mobileVerifyOtp),
  );

  router.get('/me', authenticate, asyncHandler(authController.me));

  return router;
}
