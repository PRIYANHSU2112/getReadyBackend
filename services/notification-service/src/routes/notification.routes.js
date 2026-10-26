import { Router } from 'express';
import { validate } from '@getready/validation';
import { notificationValidator } from '../validators/notification.validation.js';

export function createNotificationRoutes(notificationController) {
  const router = Router();

  router.get('/admin/stats', notificationController.getAdminStats);
  router.get('/admin', notificationController.listAdmin);
  router.post('/broadcast', notificationController.broadcast);
  router.post('/admin/broadcast', notificationController.broadcast);

  router.get('/', (req, res, next) => {
    const userRole = req.headers['x-user-role'] || req.user?.role;
    if (userRole === 'ADMIN' || !req.user?.id) {
      return notificationController.listAdmin(req, res, next);
    }
    return notificationController.listMine(req, res, next);
  });

  router.patch('/:id/read', notificationController.markAsRead);
  router.delete('/:id', notificationController.delete);
  router.post('/send', validate(notificationValidator.sendNotification), notificationController.send);

  return router;
}
