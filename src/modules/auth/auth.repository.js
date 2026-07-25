import { BaseRepository } from '../../common/base/BaseRepository.js';

/**
 * Redis-backed OTP storage (no Mongo model — OTP lives in cache).
 */
export class AuthRepository {
  /**
   * @param {import('../../core/redis/cache.service.js').CacheService|null} cacheService
   */
  constructor(cacheService) {
    this.cacheService = cacheService;
  }

  #ensureCache() {
    if (!this.cacheService) {
      throw new Error('Redis cache is required for OTP operations');
    }
  }

  otpKey(purpose, identifier) {
    return `otp:${purpose}:${identifier}`;
  }

  cooldownKey(purpose, identifier) {
    return `otp:cooldown:${purpose}:${identifier}`;
  }

  resendKey(purpose, identifier) {
    return `otp:resend:${purpose}:${identifier}`;
  }

  async getOtpRecord(key) {
    this.#ensureCache();
    return this.cacheService.get(key);
  }

  async setOtpRecord(key, record, ttlSeconds) {
    this.#ensureCache();
    await this.cacheService.set(key, record, ttlSeconds);
  }

  async deleteOtpRecord(key) {
    this.#ensureCache();
    await this.cacheService.del(key);
  }

  async getCooldown(key) {
    this.#ensureCache();
    return this.cacheService.get(key);
  }

  async setCooldown(key, ttlSeconds) {
    this.#ensureCache();
    await this.cacheService.set(key, '1', ttlSeconds);
  }

  async incrementResendCount(key, ttlSeconds) {
    this.#ensureCache();
    const current = (await this.cacheService.get(key)) || 0;
    const next = Number(current) + 1;
    await this.cacheService.set(key, next, ttlSeconds);
    return next;
  }
}
