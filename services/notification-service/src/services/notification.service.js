import { notificationsSentTotal, notificationsFailedTotal } from '@getready/metrics';
import { logger } from '@getready/logger';

export class NotificationService {
  constructor(notificationRepository) {
    this.notificationRepository = notificationRepository;
  }

  async sendNotification({ userId, title, body, channel = 'IN_APP', data = {} }) {
    try {
      const notification = await this.notificationRepository.create({
        userId,
        title,
        body,
        channel,
        data,
      });

      notificationsSentTotal.inc({ service: 'notification-service', channel });
      logger.info({ userId, title, channel }, 'Notification dispatched successfully');
      return notification;
    } catch (err) {
      notificationsFailedTotal.inc({ service: 'notification-service', channel });
      logger.error({ err, userId, title }, 'Failed to send notification');
      throw err;
    }
  }

  async listForUser(userId, options) {
    return this.notificationRepository.findByUserId(userId, options);
  }

  async markAsRead(id, userId) {
    return this.notificationRepository.markAsRead(id, userId);
  }

  async delete(id, userId) {
    return this.notificationRepository.delete(id, userId);
  }
}
