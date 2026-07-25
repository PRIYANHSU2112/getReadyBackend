import Redis from 'ioredis';
import config from '../config/index.js';
import { logger } from '../logger/pino.logger.js';

/** Fail-fast options for request-path cache (not BullMQ workers). */
function buildRedisOptions() {
  return {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: 1,
    commandTimeout: 100,
    connectTimeout: 2000,
    enableOfflineQueue: false,
    keepAlive: 10000,
    lazyConnect: true,
    showFriendlyErrorStack: config.env === 'development',
    retryStrategy(times) {
      if (times > 2) {
        return null;
      }
      logger.warn(`[Redis] Retrying connection... Attempt: ${times}`);
      return Math.min(times * 200, 500);
    },
  };
}

export class RedisClient {
  static #instance = null;

  /** @type {import('ioredis').Redis|null} */
  #client = null;

  constructor() {
    if (RedisClient.#instance) {
      return RedisClient.#instance;
    }
    RedisClient.#instance = this;
  }

  static getInstance() {
    if (!RedisClient.#instance) {
      RedisClient.#instance = new RedisClient();
    }
    return RedisClient.#instance;
  }

  /**
   * Create client (lazy) and connect. Safe to call multiple times.
   */
  async connect() {
    if (!this.#client) {
      this.#client = new Redis(buildRedisOptions());

      this.#client.on('connect', () => logger.info('[Redis] Connecting'));
      this.#client.on('ready', () => logger.info('[Redis] Ready'));
      this.#client.on('error', (err) => logger.error({ err }, '[Redis] Error'));
      this.#client.on('close', () => logger.warn('[Redis] Connection closed'));
    }

    if (this.#client.status === 'wait' || this.#client.status === 'end') {
      await this.#client.connect();
    }

    return this.#client;
  }

  getClient() {
    if (!this.#client) {
      throw new Error('RedisClient not connected. Call connect() first.');
    }
    return this.#client;
  }

  isReady() {
    return Boolean(this.#client && this.#client.status === 'ready');
  }

  async disconnect() {
    if (!this.#client) return;
    const client = this.#client;
    this.#client = null;
    RedisClient.#instance = null;
    try {
      // Prefer disconnect over quit so offline clients do not hang boot/shutdown
      client.disconnect();
    } catch {
      try {
        await client.quit();
      } catch {
        // ignore
      }
    }
    logger.info('[Redis] Disconnected');
  }

  async ping() {
    if (!this.#client) return false;
    try {
      const result = await this.#client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
