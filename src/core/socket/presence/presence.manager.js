const PRESENCE_KEY = 'presence:online';

export class PresenceManager {
  /**
   * @param {import('ioredis').Redis} redis
   */
  constructor(redis) {
    this.redis = redis;
  }

  async setOnline(userId, socketId) {
    await this.redis.hset(PRESENCE_KEY, userId, JSON.stringify({ socketId, at: Date.now() }));
  }

  async setOffline(userId, socketId) {
    const raw = await this.redis.hget(PRESENCE_KEY, userId);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data.socketId === socketId) {
        await this.redis.hdel(PRESENCE_KEY, userId);
      }
    } catch {
      await this.redis.hdel(PRESENCE_KEY, userId);
    }
  }

  async isOnline(userId) {
    return Boolean(await this.redis.hexists(PRESENCE_KEY, userId));
  }

  async listOnline() {
    const all = await this.redis.hgetall(PRESENCE_KEY);
    return Object.keys(all);
  }
}
