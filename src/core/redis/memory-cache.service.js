/**
 * In-memory cache when Redis is disabled (local OTP / tests).
 * Same get/set/del API as CacheService.
 */
export class MemoryCacheService {
  /**
   * @param {number} [defaultTtlSeconds=60]
   */
  constructor(defaultTtlSeconds = 60) {
    this.store = new Map();
    this.expiry = new Map();
    this.defaultTtlSeconds = defaultTtlSeconds;
  }

  async get(key) {
    const exp = this.expiry.get(key);
    if (exp && Date.now() > exp) {
      this.store.delete(key);
      this.expiry.delete(key);
      return null;
    }
    const raw = this.store.get(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  async set(key, value, ttlSeconds = this.defaultTtlSeconds) {
    const payload = typeof value === 'string' ? value : JSON.stringify(value);
    this.store.set(key, payload);
    if (ttlSeconds > 0) {
      this.expiry.set(key, Date.now() + ttlSeconds * 1000);
    } else {
      this.expiry.delete(key);
    }
  }

  async del(key) {
    this.store.delete(key);
    this.expiry.delete(key);
  }

  async delByPattern(pattern) {
    // Simple glob: prefix* only
    const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(prefix) || key === pattern) {
        await this.del(key);
      }
    }
  }
}
