import { BaseService } from '../../common/base/BaseService.js';
import { logger } from '../../core/logger/pino.logger.js';

/**
 * Notification module stub — listens to domain events via EventBus.
 */
export class NotificationService extends BaseService {
  /**
   * @param {import('./notification.repository.js').NotificationRepository} notificationRepository
   * @param {import('../../core/events/EventBus.js').EventBus|null} eventBus
   */
  constructor(notificationRepository, eventBus = null) {
    super(eventBus, null);
    this.notificationRepository = notificationRepository;
  }

  /**
   * Event handler for user.created
   * @param {{ user: object }} payload
   */
  async onUserCreated(payload) {
    const user = payload?.user;
    if (!user?._id) {
      logger.debug('notification.onUserCreated skipped — missing user');
      return;
    }

    await this.notificationRepository.create({
      userId: user._id,
      title: 'Welcome',
      body: `Welcome, ${user.name}!`,
    });
    logger.info({ userId: user._id }, 'Welcome notification created');
  }

  async listForUser(userId, options = {}) {
    return this.notificationRepository.findByUserId(userId, options);
  }
}
