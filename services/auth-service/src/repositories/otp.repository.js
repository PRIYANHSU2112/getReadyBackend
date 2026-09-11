import { Redis } from 'ioredis';
import { logger } from '@getready/logger';

export class OtpRepository {
  /**
   * @param {import('../config/index.js').config} config
   */
  constructor(config) {
    this.config = config;
    this.memoryStore = new Map();
    this.redisClient = null;

    if (config.redis?.enabled) {
      try {
        this.redisClient = new Redis({
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password,
          lazyConnect: true,
        });
      } catch (err) {
        logger.warn({ err }, 'Redis client failed in OtpRepository, using memory fallback');
      }
    }
  }

  async #getClient() {
    if (this.redisClient && this.redisClient.status !== 'ready') {
      try {
        await this.redisClient.connect();
      } catch {
        // fallback
      }
    }
    return this.redisClient?.status === 'ready' ? this.redisClient : null;
  }

  otpKey(purpose, identifier) {
    return `auth:otp:${purpose}:${identifier.toLowerCase()}`;
  }

  cooldownKey(purpose, identifier) {
    return `auth:cooldown:${purpose}:${identifier.toLowerCase()}`;
  }

  resendKey(purpose, identifier) {
    return `auth:resend:${purpose}:${identifier.toLowerCase()}`;
  }

  async setOtpRecord(key, record, ttlSeconds) {
    const client = await this.#getClient();
    if (client) {
      await client.set(key, JSON.stringify(record), 'EX', ttlSeconds);
    } else {
      this.memoryStore.set(key, { record, expiresAt: Date.now() + ttlSeconds * 1000 });
    }
  }

  async getOtpRecord(key) {
    const client = await this.#getClient();
    if (client) {
      const raw = await client.get(key);
      return raw ? JSON.parse(raw) : null;
    }
    const item = this.memoryStore.get(key);
    if (!item) return null;
    if (item.expiresAt < Date.now()) {
      this.memoryStore.delete(key);
      return null;
    }
    return item.record;
  }

  async deleteOtpRecord(key) {
    const client = await this.#getClient();
    if (client) {
      await client.del(key);
    } else {
      this.memoryStore.delete(key);
    }
  }

  async setCooldown(key, ttlSeconds) {
    const client = await this.#getClient();
    if (client) {
      await client.set(key, '1', 'EX', ttlSeconds);
    } else {
      this.memoryStore.set(key, { record: '1', expiresAt: Date.now() + ttlSeconds * 1000 });
    }
  }

  async getCooldown(key) {
    const client = await this.#getClient();
    if (client) {
      return client.get(key);
    }
    const item = this.memoryStore.get(key);
    if (!item || item.expiresAt < Date.now()) return null;
    return item.record;
  }

  async incrementResendCount(key, windowSeconds = 3600) {
    const client = await this.#getClient();
    if (client) {
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, windowSeconds);
      }
      return count;
    }
    const item = this.memoryStore.get(key);
    const now = Date.now();
    if (!item || item.expiresAt < now) {
      this.memoryStore.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
      return 1;
    }
    item.count += 1;
    return item.count;
  }
}
