/**
 * Process-local TTL cache (sync + async API).
 * Used for hot-path authz and as Redis fallback via MemoryCacheService.
 */
export class TtlMemoryCache {
  constructor() {
    /** @type {Map<string, { value: unknown, expiresAt: number|null }>} */
    this.store = new Map();
  }

  /**
   * @param {string} key
   * @returns {unknown|null}
   */
  getSync(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt != null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * @param {string} key
   * @param {unknown} value
   * @param {number} [ttlSeconds=0] 0 = no expiry
   */
  setSync(key, value, ttlSeconds = 0) {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  /**
   * @param {string} key
   */
  delSync(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  async get(key) {
    return this.getSync(key);
  }

  async set(key, value, ttlSeconds = 0) {
    this.setSync(key, value, ttlSeconds);
  }

  async del(key) {
    this.delSync(key);
  }
}
