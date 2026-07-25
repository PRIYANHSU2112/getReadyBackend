import config from '../../core/config/index.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { createAuthRoutes } from './auth.routes.js';
import { authDocs } from './auth.docs.js';
import { SmsUtil } from '../../common/utils/sms.util.js';

/**
 * @param {{ userService: import('../user/user.service.js').UserService, jwtUtil: object, cacheService: object|null, authenticate: Function }} deps
 */
export function createAuthModule({ userService, jwtUtil, cacheService, authenticate }) {
  const repository = new AuthRepository(cacheService);
  const smsService = new SmsUtil(config.sms);
  const service = new AuthService(repository, userService, jwtUtil, smsService, config);
  const controller = new AuthController(service);

  return {
    service,
    routes: createAuthRoutes(controller, { authenticate }),
    docs: authDocs,
  };
}

export { authDocs } from './auth.docs.js';
export { authValidator } from './auth.validation.js';
