import { logger } from '../logger/pino.logger.js';

/**
 * Redis-backed cache. Soft-fails on errors (miss / no-op) so request path never hangs.
 */
export class CacheService {
  /**
   * @param {import('ioredis').Redis} client
   * @param {number} [defaultTtlSeconds]
   */
  constructor(client, defaultTtlSeconds = 60) {
    this.client = client;
    this.defaultTtlSeconds = defaultTtlSeconds;
  }

  async get(key) {
    try {
      const raw = await this.client.get(key);
      if (raw == null) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    } catch (err) {
      logger.warn({ err, key }, '[Cache] get failed — treating as miss');
      return null;
    }
  }

  async set(key, value, ttlSeconds = this.defaultTtlSeconds) {
    try {
      const payload = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.client.set(key, payload, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, payload);
      }
    } catch (err) {
      logger.warn({ err, key }, '[Cache] set failed — no-op');
    }
  }

  async del(key) {
    try {
      await this.client.del(key);
    } catch (err) {
      logger.warn({ err, key }, '[Cache] del failed — no-op');
    }
  }

  async delByPattern(pattern) {
    try {
      const stream = this.client.scanStream({ match: pattern, count: 100 });
      const pipeline = this.client.pipeline();
      let count = 0;
      for await (const keys of stream) {
        for (const key of keys) {
          pipeline.del(key);
          count += 1;
        }
      }
      if (count > 0) await pipeline.exec();
    } catch (err) {
      logger.warn({ err, pattern }, '[Cache] delByPattern failed — no-op');
    }
  }
}
