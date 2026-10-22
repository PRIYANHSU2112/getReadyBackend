import { logger } from '@getready/logger';
import { config } from '../config/index.js';

class WalletCache {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.localCache = new Map();
    this.init();
  }

  async init() {
    const redisUrl = config.redisUrl;
    if (!redisUrl) {
      logger.debug('Redis URL not configured; using local memory cache fallback for Wallet Service');
      return;
    }

    try {
      const { Redis } = await import('ioredis');
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        enableReadyCheck: true,
        lazyConnect: true,
        connectTimeout: 400,
      });

      this.client.on('connect', () => {
        this.isReady = true;
        logger.info('Wallet Service connected to Redis cache');
      });

      this.client.on('error', (err) => {
        this.isReady = false;
        logger.warn({ err: err.message }, 'Redis cache error in Wallet Service; falling back to memory');
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
        logger.warn({ key, err: err.message }, 'Redis get error; falling back to memory');
      }
    }

    const entry = this.localCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.localCache.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, ttlSeconds = 60) {
    this.localCache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });

    if (this.isReady && this.client) {
      try {
        await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      } catch (err) {
        logger.warn({ key, err: err.message }, 'Redis set error');
      }
    }
  }

  async del(key) {
    this.localCache.delete(key);
    if (this.isReady && this.client) {
      try {
        await this.client.del(key);
      } catch (err) {
        logger.warn({ key, err: err.message }, 'Redis del error');
      }
    }
  }

  async invalidateBeautician(userId) {
    const keys = [
      `wallet:beautician:${userId}:dashboard`,
      `wallet:beautician:${userId}:summary`,
    ];
    for (const k of keys) {
      await this.del(k);
    }
    // Also clear from localCache any matching prefix
    for (const key of this.localCache.keys()) {
      if (key.startsWith(`wallet:beautician:${userId}`)) {
        this.localCache.delete(key);
      }
    }
  }
}

export const walletCache = new WalletCache();
export default walletCache;
