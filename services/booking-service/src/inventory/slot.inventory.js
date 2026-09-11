import crypto from 'crypto';
import { Redis } from 'ioredis';
import { logger } from '@getready/logger';

const RESERVE_LUA = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
if redis.call('EXISTS', KEYS[3]) == 1 then
  return {0, 'DUPLICATE'}
end
local members = redis.call('ZRANGE', KEYS[1], 0, -1)
local held = 0
for _, m in ipairs(members) do
  local psize = tonumber(string.match(m, '^[^:]+:(%d+):'))
  held = held + (psize or 0)
end
local party = tonumber(ARGV[4])
local maxB = tonumber(ARGV[5])
local booked = tonumber(ARGV[6])
if booked + held + party > maxB then
  return {0, 'FULL', tostring(held)}
end
local member = ARGV[3] .. ':' .. ARGV[4] .. ':' .. ARGV[7]
redis.call('ZADD', KEYS[1], ARGV[2], member)
redis.call('SET', KEYS[2], ARGV[9], 'EX', tonumber(ARGV[8]))
redis.call('SET', KEYS[3], ARGV[3], 'EX', tonumber(ARGV[8]))
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[8]) + 120)
return {1, 'OK', tostring(held + party)}
`;

const RELEASE_LUA = `
local payload = redis.call('GET', KEYS[2])
if not payload then
  return {0, 'NOT_FOUND'}
end
local member = ARGV[1] .. ':' .. ARGV[2] .. ':' .. ARGV[3]
redis.call('ZREM', KEYS[1], member)
redis.call('DEL', KEYS[2])
redis.call('DEL', KEYS[3])
return {1, 'OK'}
`;

export class SlotInventory {
  /**
   * @param {object} [config]
   */
  constructor(config = {}) {
    this.ttlSeconds = config.holdTtlSeconds || 300;
    this.redisClient = null;
    this.memoryHolds = new Map();
    this.memoryUserHolds = new Map();

    if (config.redis?.enabled) {
      try {
        this.redisClient = new Redis({
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password,
          lazyConnect: true,
        });
      } catch (err) {
        logger.warn({ err }, 'Redis connection failed in SlotInventory; using in-memory inventory fallback');
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

  async reserve({ slotId, userId, partySize = 1, maxBookings = 1, bookedCount = 0, ttlSeconds = this.ttlSeconds }) {
    const client = await this.#getClient();
    const token = crypto.randomUUID().replace(/-/g, '');
    const nowMs = Date.now();
    const expiresAtMs = nowMs + ttlSeconds * 1000;

    if (client) {
      const payload = JSON.stringify({
        slotId,
        userId,
        partySize,
        createdAt: new Date(nowMs).toISOString(),
        expiresAt: new Date(expiresAtMs).toISOString(),
      });

      const result = await client.eval(
        RESERVE_LUA,
        3,
        `slot:holdz:${slotId}`,
        `slot:hold:${token}`,
        `slot:userhold:${userId}:${slotId}`,
        String(nowMs),
        String(expiresAtMs),
        token,
        String(partySize),
        String(maxBookings),
        String(bookedCount),
        userId,
        String(ttlSeconds),
        payload,
      );

      const code = Number(result?.[0]);
      if (code !== 1) {
        return { ok: false, reason: String(result?.[1] || 'FULL') };
      }
      return {
        ok: true,
        holdToken: token,
        expiresAt: new Date(expiresAtMs).toISOString(),
        heldCount: Number(result[2] || partySize),
        slotId,
        userId,
        partySize,
      };
    }

    // In-memory fallback
    const userKey = `${userId}:${slotId}`;
    if (this.memoryUserHolds.has(userKey)) {
      return { ok: false, reason: 'DUPLICATE' };
    }

    let currentHeld = 0;
    for (const hold of this.memoryHolds.values()) {
      if (hold.slotId === slotId && hold.expiresAtMs > nowMs) {
        currentHeld += hold.partySize;
      }
    }

    if (bookedCount + currentHeld + partySize > maxBookings) {
      return { ok: false, reason: 'FULL' };
    }

    this.memoryHolds.set(token, { slotId, userId, partySize, expiresAtMs });
    this.memoryUserHolds.set(userKey, token);
    return {
      ok: true,
      holdToken: token,
      expiresAt: new Date(expiresAtMs).toISOString(),
      heldCount: currentHeld + partySize,
      slotId,
      userId,
      partySize,
    };
  }

  async release({ holdToken, userId, slotId, partySize = 1 }) {
    const client = await this.#getClient();
    if (client) {
      const result = await client.eval(
        RELEASE_LUA,
        3,
        `slot:holdz:${slotId}`,
        `slot:hold:${holdToken}`,
        `slot:userhold:${userId}:${slotId}`,
        holdToken,
        String(partySize),
        userId,
      );
      return { ok: Number(result?.[0]) === 1 };
    }

    this.memoryHolds.delete(holdToken);
    this.memoryUserHolds.delete(`${userId}:${slotId}`);
    return { ok: true };
  }

  async getHold(holdToken) {
    const client = await this.#getClient();
    if (client) {
      const raw = await client.get(`slot:hold:${holdToken}`);
      if (!raw) return { ok: false, reason: 'NOT_FOUND' };
      return { ok: true, hold: JSON.parse(raw) };
    }

    const item = this.memoryHolds.get(holdToken);
    if (!item || item.expiresAtMs < Date.now()) return { ok: false, reason: 'NOT_FOUND' };
    return { ok: true, hold: item };
  }
}
