import { Router } from 'express';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { notificationValidator } from './notification.validation.js';

/**
 * @param {import('./notification.controller.js').NotificationController} notificationController
 * @param {{ authenticate: Function }} guards
 */
export function createNotificationRoutes(notificationController, guards) {
  const router = Router();

  router.get(
    '/',
    guards.authenticate,
    validate(notificationValidator, 'listQuery', 'query'),
    asyncHandler(notificationController.listMine),
  );

  return router;
}
