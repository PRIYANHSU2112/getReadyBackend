import { Router } from 'express';
import { validate } from '@getready/validation';
import { authValidator } from '../validators/auth.validation.js';

export function createAuthRoutes(controller) {
  const router = Router();

  // Admin Auth
  router.post('/admin/login', validate(authValidator, 'adminLogin'), controller.adminLogin);
  router.post('/login', validate(authValidator, 'adminLogin'), controller.adminLogin);
  router.post('/admin/forgot-password', validate(authValidator, 'adminForgotPassword'), controller.adminForgotPassword);
  router.post('/admin/reset-password', validate(authValidator, 'adminResetPassword'), controller.adminResetPassword);

  // Mobile Customer & Beautician Auth
  router.post('/mobile/send-otp', validate(authValidator, 'mobileSendOtp'), controller.mobileSendOtp);
  router.post('/mobile/resend-otp', validate(authValidator, 'mobileResendOtp'), controller.mobileResendOtp);
  router.post('/mobile/verify-otp', validate(authValidator, 'mobileVerifyOtp'), controller.mobileVerifyOtp);

  // Token management
  router.post('/refresh-token', validate(authValidator, 'refreshToken'), controller.refreshToken);
  router.post('/logout', validate(authValidator, 'logout'), controller.logout);
  router.get('/me', controller.getMe);

  return router;
}
