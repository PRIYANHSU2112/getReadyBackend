import { HygieneKitModel } from './hygiene-kit.model.js';
import { HygieneKitRepository } from './hygiene-kit.repository.js';
import { HygieneKitService } from './hygiene-kit.service.js';
import { HygieneKitController } from './hygiene-kit.controller.js';
import { createHygieneKitRoutes } from './hygiene-kit.routes.js';
import { hygieneKitDocs } from './hygiene-kit.docs.js';

/**
 * Hygiene Kit module factory — Public active/default endpoints + RBAC Admin CRUD.
 * @param {{
 *   authenticate?: Function,
 *   checkPermission?: Function,
 *   cacheService?: object|null,
 *   storageService?: object|null,
 * }} deps
 */
export function createHygieneKitModule({
  authenticate,
  checkPermission,
  cacheService = null,
  storageService = null,
}) {
  const repository = new HygieneKitRepository(HygieneKitModel);
  const service = new HygieneKitService(repository, cacheService, storageService);
  const controller = new HygieneKitController(service);

  return {
    repository,
    service,
    controller,
    routes: createHygieneKitRoutes(controller, { authenticate, checkPermission }),
    docs: hygieneKitDocs,
  };
}

export { hygieneKitDocs } from './hygiene-kit.docs.js';
export { hygieneKitValidator } from './hygiene-kit.validation.js';
export { HygieneKitModel } from './hygiene-kit.model.js';
export { HygieneKitRepository } from './hygiene-kit.repository.js';
export { HygieneKitService } from './hygiene-kit.service.js';
export { HygieneKitController } from './hygiene-kit.controller.js';
