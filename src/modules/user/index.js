import { UserModel } from './user.model.js';
import { UserRepository } from './user.repository.js';
import { UserService } from './user.service.js';
import { UserController } from './user.controller.js';
import { createUserRoutes } from './user.routes.js';
import { userDocs } from './user.docs.js';

/**
 * User module factory — wires Repository → Service → Controller → Routes.
 * @param {{ eventBus?: object, cacheService?: object|null, jwtUtil: object, authenticate: Function }} deps
 */
export function createUserModule({ eventBus = null, cacheService = null, jwtUtil, authenticate }) {
  const repository = new UserRepository(UserModel);
  const service = new UserService(repository, eventBus, cacheService, jwtUtil);
  const controller = new UserController(service);

  return {
    service,
    routes: createUserRoutes(controller, { authenticate }),
    docs: userDocs,
  };
}

export { userDocs } from './user.docs.js';
export { userValidator } from './user.validation.js';
