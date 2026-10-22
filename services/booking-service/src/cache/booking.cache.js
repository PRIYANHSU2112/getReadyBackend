import { logger } from '@getready/logger';

class BookingCache {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.localCache = new Map();
    this.init();
  }

  async init() {
    const redisUrl =
      process.env.REDIS_URL ||
      (process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}` : null);

    if (!redisUrl) {
      logger.debug('Redis URL not configured; using local memory cache fallback for Booking Service');
      return;
    }

    try {
      const { Redis } = await import('ioredis');
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        lazyConnect: true,
        connectTimeout: 400,
        retryStrategy: () => null,
      });

      this.client.on('connect', () => {
        this.isReady = true;
        logger.info('Booking Service connected to Redis cache');
      });

      this.client.on('error', (err) => {
        this.isReady = false;
        logger.warn({ err: err.message }, 'Redis cache error in Booking Service; using memory fallback');
      });

      await this.client.connect().catch((err) => {
        this.isReady = false;
        try { this.client.disconnect(); } catch {}
        this.client = null;
        logger.warn({ err: err.message }, 'Redis initial connect failed; memory fallback active');
      });
    } catch (err) {
      this.isReady = false;
      logger.debug({ err: err.message }, 'ioredis not initialized; using memory fallback');
    }
  }

  async get(key) {
    if (this.isReady && this.client) {
      try {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
      } catch (err) {
        logger.warn({ key, err: err.message }, 'Redis get error in Booking Service');
      }
    }

    const entry = this.localCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.localCache.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, ttlSeconds = 60) {
    if (this.isReady && this.client) {
      try {
        await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        return;
      } catch (err) {
        logger.warn({ key, err: err.message }, 'Redis set error in Booking Service');
      }
    }

    if (this.localCache.size > 2000) {
      const firstKey = this.localCache.keys().next().value;
      this.localCache.delete(firstKey);
    }
    this.localCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key) {
    if (this.isReady && this.client) {
      try {
        await this.client.del(key);
      } catch (err) {
        logger.warn({ key, err: err.message }, 'Redis del error in Booking Service');
      }
    }
    this.localCache.delete(key);
  }

  async delByPattern(pattern) {
    if (this.isReady && this.client) {
      try {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } catch (err) {
        logger.warn({ pattern, err: err.message }, 'Redis delByPattern error in Booking Service');
      }
    }

    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*'));
    for (const k of this.localCache.keys()) {
      if (regex.test(k)) {
        this.localCache.delete(k);
      }
    }
  }
}

export const bookingCache = new BookingCache();
export default bookingCache;
