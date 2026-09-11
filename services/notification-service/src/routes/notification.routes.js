import { Router } from 'express';
import { validate } from '@getready/validation';
import { notificationValidator } from '../validators/notification.validation.js';

export function createNotificationRoutes(notificationController) {
  const router = Router();

  router.get('/', validate(notificationValidator.listQuery, 'query'), notificationController.listMine);
  router.patch('/:id/read', notificationController.markAsRead);
  router.delete('/:id', notificationController.delete);
  router.post('/send', validate(notificationValidator.sendNotification), notificationController.send);

  return router;
}
