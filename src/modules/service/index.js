import { ServiceModel } from './service.model.js';
import { ServiceChangeRequestModel } from './service-change-request.model.js';
import { ServiceRepository } from './service.repository.js';
import { ServiceChangeRequestRepository } from './service-change-request.repository.js';
import { ServiceService } from './service.service.js';
import { ServiceController } from './service.controller.js';
import {
  createServiceRoutes,
  createServiceChangeRequestRoutes,
} from './service.routes.js';
import { serviceDocs } from './service.docs.js';

/**
 * @param {{
 *   authenticate: Function,
 *   checkPermission: Function,
 *   cacheService?: object|null,
 *   storageService?: object|null,
 *   categoryRepository?: object|null,
 * }} deps
 */
export function createServiceModule({
  authenticate,
  checkPermission,
  cacheService = null,
  storageService = null,
  categoryRepository = null,
}) {
  const serviceRepository = new ServiceRepository(ServiceModel);
  const changeRequestRepository = new ServiceChangeRequestRepository(
    ServiceChangeRequestModel,
  );
  const service = new ServiceService(
    serviceRepository,
    changeRequestRepository,
    categoryRepository,
    cacheService,
    storageService,
  );
  const controller = new ServiceController(service);
  const guards = { authenticate, checkPermission };

  return {
    repository: serviceRepository,
    service,
    routes: createServiceRoutes(controller, guards),
    changeRequestRoutes: createServiceChangeRequestRoutes(controller, guards),
    docs: serviceDocs,
  };
}

export { serviceDocs } from './service.docs.js';
export { serviceValidator } from './service.validation.js';
export { ServiceModel } from './service.model.js';
export { ServiceChangeRequestModel } from './service-change-request.model.js';
