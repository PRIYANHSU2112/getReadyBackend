import { EventType } from '../../common/constants/enums.js';
import { NotificationModel } from './notification.model.js';
import { NotificationRepository } from './notification.repository.js';
import { NotificationService } from './notification.service.js';
import { NotificationController } from './notification.controller.js';
import { createNotificationRoutes } from './notification.routes.js';
import { notificationDocs } from './notification.docs.js';

/**
 * Notification module factory — wires Repository → Service → Controller → Routes.
 * @param {{ eventBus?: object, authenticate: Function }} deps
 */
export function createNotificationModule({ eventBus = null, authenticate }) {
  const repository = new NotificationRepository(NotificationModel);
  const service = new NotificationService(repository, eventBus);
  const controller = new NotificationController(service);

  return {
    service,
    routes: createNotificationRoutes(controller, { authenticate }),
    docs: notificationDocs,

    /** Register this module's EventBus listeners */
    registerEvents(bus) {
      bus.on(EventType.USER_CREATED, (payload) => service.onUserCreated(payload));
    },
  };
}

export { notificationDocs } from './notification.docs.js';
export { notificationValidator } from './notification.validation.js';
