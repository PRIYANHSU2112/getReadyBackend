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
    const raw = await this.client.get(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  async set(key, value, ttlSeconds = this.defaultTtlSeconds) {
    const payload = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds > 0) {
      await this.client.set(key, payload, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, payload);
    }
  }

  async del(key) {
    await this.client.del(key);
  }

  async delByPattern(pattern) {
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
  }
}
