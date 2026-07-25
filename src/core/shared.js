import config from './config/index.js';
import { EventBus } from './events/index.js';
import { RedisClient } from './redis/RedisClient.js';
import { CacheService } from './redis/cache.service.js';
import { MemoryCacheService } from './redis/memory-cache.service.js';
import { StorageService } from './storage/StorageService.js';
import { JwtUtil } from '../common/utils/jwt.util.js';
import { createAuthMiddleware } from '../common/middleware/auth.middleware.js';
import { createAuthorize, createAuthorizeSelfOrAdmin } from '../common/middleware/authorize.middleware.js';
import { logger } from './logger/pino.logger.js';

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
        const redis = RedisClient.getInstance();
        if (redis.isReady()) {
          const client = redis.getClient();
          cacheService = new CacheService(client, config.cacheTtlSeconds);
        }
      } catch {
        cacheService = null;
      }
    }
    // Always provide a cache (OTP + authz) — Redis when healthy, else in-memory
    if (!cacheService) {
      cacheService = new MemoryCacheService(config.cacheTtlSeconds);
      if (!options.skipRedis) {
        logger.info('[Cache] Using in-memory cache (Redis unavailable or disabled)');
      }
    }
  }

  const storageService =
    options.storageService || new StorageService(config.storage, config.appUrl);

  const authenticate = createAuthMiddleware(jwtUtil);
  const authorize = createAuthorize;
  const authorizeSelfOrAdmin = createAuthorizeSelfOrAdmin;

  return {
    eventBus,
    jwtUtil,
    cacheService,
    storageService,
    authenticate,
    authorize,
    authorizeSelfOrAdmin,
  };
}
