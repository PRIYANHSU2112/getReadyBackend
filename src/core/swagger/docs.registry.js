import { userDocs } from '../../modules/user/user.docs.js';
import { notificationDocs } from '../../modules/notification/notification.docs.js';

/**
 * Central Swagger docs registry.
 * Add a module's docs here when creating a new feature module.
 */
export const swaggerDocs = [userDocs, notificationDocs];
