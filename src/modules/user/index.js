import { UserModel } from './user.model.js';
import { UserRepository } from './user.repository.js';
import { UserService } from './user.service.js';
import { UserController } from './user.controller.js';
import { createUserRoutes } from './user.routes.js';
import { userDocs } from './user.docs.js';

/**
 * User module factory — wires Repository → Service → Controller → Routes.
 * @param {{
 *   eventBus?: object,
 *   cacheService?: object|null,
 *   storageService?: object|null,
 *   authenticate: Function,
 *   checkPermission: Function,
 *   roleService?: object|null,
 * }} deps
 */
export function createUserModule({
  eventBus = null,
  cacheService = null,
  storageService = null,
  authenticate,
  checkPermission,
  roleService = null,
}) {
  const repository = new UserRepository(UserModel);
  const service = new UserService(
    repository,
    eventBus,
    cacheService,
    storageService,
    roleService,
  );
  const controller = new UserController(service);

  return {
    service,
    routes: createUserRoutes(controller, { authenticate, checkPermission }),
    docs: userDocs,
  };
}

export { userDocs } from './user.docs.js';
export { userValidator } from './user.validation.js';
