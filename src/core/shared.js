import config from './config/index.js';
import { EventBus } from './events/index.js';
import { RedisClient } from './redis/RedisClient.js';
import { CacheService } from './redis/cache.service.js';
import { StorageService } from './storage/StorageService.js';
import { JwtUtil } from '../common/utils/jwt.util.js';
import { createAuthMiddleware } from '../common/middleware/auth.middleware.js';

/**
 * Shared dependencies used by all modules (not feature wiring).
 * @param {object} [options] - Test overrides
 */
export function createShared(options = {}) {
  const eventBus = options.eventBus || new EventBus();
  const jwtUtil = options.jwtUtil || new JwtUtil(config.jwt.secret, config.jwt.expiresIn);

  let cacheService = options.cacheService;
  if (cacheService === undefined) {
    cacheService = null;
    if (!options.skipRedis) {
      try {
        const client = RedisClient.getInstance().getClient();
        cacheService = new CacheService(client, config.cacheTtlSeconds);
      } catch {
        cacheService = null;
      }
    }
  }

  const storageService =
    options.storageService || new StorageService(config.storage, config.appUrl);

  const authenticate = createAuthMiddleware(jwtUtil);

  return {
    eventBus,
    jwtUtil,
    cacheService,
    storageService,
    authenticate,
  };
}
