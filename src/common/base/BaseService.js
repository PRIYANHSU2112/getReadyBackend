import { NotFoundError } from '../errors/NotFoundError.js';

export class BaseService {
  /**
   * @param {import('../../core/events/EventBus.js').EventBus|null} eventBus
   * @param {import('../../core/redis/cache.service.js').CacheService|null} cacheService
   */
  constructor(eventBus = null, cacheService = null) {
    this.eventBus = eventBus;
    this.cacheService = cacheService;
  }

  ensureFound(entity, message = 'Resource not found') {
    if (!entity) {
      throw new NotFoundError(message);
    }
    return entity;
  }

  emit(eventName, payload) {
    if (this.eventBus) {
      this.eventBus.emit(eventName, payload);
    }
  }

  cacheKey(...parts) {
    return parts.filter(Boolean).join(':');
  }

  async getCached(key) {
    if (!this.cacheService) return null;
    return this.cacheService.get(key);
  }

  async setCached(key, value, ttlSeconds) {
    if (!this.cacheService) return;
    await this.cacheService.set(key, value, ttlSeconds);
  }

  async invalidateCache(key) {
    if (!this.cacheService) return;
    await this.cacheService.del(key);
  }
}
