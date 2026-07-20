import Redis from 'ioredis';
import config from '../config/index.js';
import { logger } from '../logger/pino.logger.js';

function buildRedisOptions() {
  return {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: null,
    keepAlive: 10000,
    lazyConnect: true,
    showFriendlyErrorStack: config.env === 'development',
    retryStrategy(times) {
      if (times > 3) {
        return null;
      }
      logger.warn(`[Redis] Retrying connection... Attempt: ${times}`);
      return Math.min(times * 500, 2000);
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

  async disconnect() {
    if (this.#client) {
      await this.#client.quit().catch(() => {});
      this.#client = null;
      RedisClient.#instance = null;
      logger.info('[Redis] Disconnected');
    }
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
