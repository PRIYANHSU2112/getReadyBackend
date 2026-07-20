import config from '../config/index.js';
import { RedisClient } from '../redis/RedisClient.js';

/**
 * Shared BullMQ connection options (ioredis).
 */
export function createBullMQConnection() {
  try {
    const client = RedisClient.getInstance().getClient();
    return client.duplicate();
  } catch {
    return {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
    };
  }
}
