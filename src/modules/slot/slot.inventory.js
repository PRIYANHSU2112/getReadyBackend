import crypto from 'crypto';
import { RedisClient } from '../../core/redis/RedisClient.js';
import { SLOT_HOLD_TTL_SECONDS } from '../../common/constants/slot.js';

/**
 * Redis Lua: purge expired members, reject duplicate/full, reserve seats.
 * KEYS[1]=holdz KEYS[2]=holdKey KEYS[3]=userHoldKey
 * ARGV: nowMs, expiresAtMs, token, partySize, maxBookings, bookedCount, userId, ttlSec, payloadJson
 */
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

/**
 * KEYS[1]=holdz KEYS[2]=holdKey KEYS[3]=userHoldKey
 * ARGV: token, partySize, userId
 */
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

function holdzKey(slotId) {
  return `slot:holdz:${slotId}`;
}

function holdKey(token) {
  return `slot:hold:${token}`;
}

function userHoldKey(userId, slotId) {
  return `slot:userhold:${userId}:${slotId}`;
}

/**
 * Redis-backed soft-hold inventory. Uses ZSET + TTL keys so expired holds
 * free seats on next read/reserve without keyspace notifications.
 */
export class RedisSlotInventory {
  /**
   * @param {() => import('ioredis').Redis|null} getClient
   * @param {number} [defaultTtlSeconds]
   */
  constructor(getClient, defaultTtlSeconds = SLOT_HOLD_TTL_SECONDS) {
    this.getClient = getClient;
    this.defaultTtlSeconds = defaultTtlSeconds;
  }

  #clientOrNull() {
    try {
      return this.getClient();
    } catch {
      return null;
    }
  }

  isReady() {
    const client = this.#clientOrNull();
    return Boolean(client && client.status === 'ready');
  }

  /**
   * @param {{ slotId: string, userId: string, partySize: number, maxBookings: number, bookedCount: number, ttlSeconds?: number }} input
   */
  async reserve(input) {
    const client = this.#clientOrNull();
    if (!client || client.status !== 'ready') {
      return { ok: false, reason: 'UNAVAILABLE' };
    }

    const ttl = input.ttlSeconds ?? this.defaultTtlSeconds;
    const token = crypto.randomUUID().replace(/-/g, '');
    const nowMs = Date.now();
    const expiresAtMs = nowMs + ttl * 1000;
    const payload = JSON.stringify({
      slotId: input.slotId,
      userId: input.userId,
      partySize: input.partySize,
      createdAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
    });

    const result = await client.eval(
      RESERVE_LUA,
      3,
      holdzKey(input.slotId),
      holdKey(token),
      userHoldKey(input.userId, input.slotId),
      String(nowMs),
      String(expiresAtMs),
      token,
      String(input.partySize),
      String(input.maxBookings),
      String(input.bookedCount),
      input.userId,
      String(ttl),
      payload,
    );

    const code = Number(result?.[0]);
    const reason = String(result?.[1] || '');
    if (code !== 1) {
      return { ok: false, reason };
    }

    return {
      ok: true,
      holdToken: token,
      expiresAt: new Date(expiresAtMs).toISOString(),
      heldCount: Number(result[2] || input.partySize),
      partySize: input.partySize,
      slotId: input.slotId,
      userId: input.userId,
    };
  }

  async getHold(holdToken) {
    const client = this.#clientOrNull();
    if (!client || client.status !== 'ready') {
      return { ok: false, reason: 'UNAVAILABLE' };
    }
    const raw = await client.get(holdKey(holdToken));
    if (!raw) return { ok: false, reason: 'NOT_FOUND' };
    try {
      const data = JSON.parse(raw);
      return { ok: true, hold: { ...data, holdToken } };
    } catch {
      return { ok: false, reason: 'NOT_FOUND' };
    }
  }

  /**
   * @param {{ holdToken: string, userId: string, slotId: string, partySize: number }} input
   */
  async release(input) {
    const client = this.#clientOrNull();
    if (!client || client.status !== 'ready') {
      return { ok: false, reason: 'UNAVAILABLE' };
    }

    const result = await client.eval(
      RELEASE_LUA,
      3,
      holdzKey(input.slotId),
      holdKey(input.holdToken),
      userHoldKey(input.userId, input.slotId),
      input.holdToken,
      String(input.partySize),
      input.userId,
    );

    const code = Number(result?.[0]);
    if (code !== 1) {
      return { ok: false, reason: String(result?.[1] || 'NOT_FOUND') };
    }
    return { ok: true };
  }

  /**
   * @param {string[]} slotIds
   * @returns {Promise<Record<string, number>>}
   */
  async getHeldCounts(slotIds) {
    const out = {};
    for (const id of slotIds) out[id] = 0;

    const client = this.#clientOrNull();
    if (!client || client.status !== 'ready' || !slotIds.length) {
      return out;
    }

    const nowMs = Date.now();
    const pipeline = client.pipeline();
    for (const id of slotIds) {
      pipeline.zremrangebyscore(holdzKey(id), '-inf', nowMs);
      pipeline.zrange(holdzKey(id), 0, -1);
    }
    const rows = await pipeline.exec();

    let i = 0;
    for (const id of slotIds) {
      i += 1; // skip zrem result
      const zrange = rows[i];
      i += 1;
      const members = zrange?.[1] || [];
      let held = 0;
      for (const m of members) {
        const match = String(m).match(/^[^:]+:(\d+):/);
        held += match ? Number(match[1]) : 0;
      }
      out[id] = held;
    }
    return out;
  }
}

/**
 * In-memory inventory for tests / when Redis is unavailable in test harness.
 * Mirrors Redis semantics including TTL expiry.
 */
export class MemorySlotInventory {
  /**
   * @param {number} [defaultTtlSeconds]
   */
  constructor(defaultTtlSeconds = SLOT_HOLD_TTL_SECONDS) {
    this.defaultTtlSeconds = defaultTtlSeconds;
    /** @type {Map<string, { expiresAtMs: number, token: string, partySize: number, userId: string }[]>} */
    this.bySlot = new Map();
    /** @type {Map<string, object>} */
    this.holds = new Map();
    /** @type {Map<string, string>} */
    this.userHolds = new Map();
  }

  isReady() {
    return true;
  }

  #purge(slotId, nowMs = Date.now()) {
    const list = this.bySlot.get(slotId) || [];
    const alive = [];
    for (const entry of list) {
      if (entry.expiresAtMs <= nowMs) {
        this.holds.delete(entry.token);
        this.userHolds.delete(`${entry.userId}:${slotId}`);
      } else {
        alive.push(entry);
      }
    }
    this.bySlot.set(slotId, alive);
    return alive;
  }

  async reserve(input) {
    const ttl = input.ttlSeconds ?? this.defaultTtlSeconds;
    const nowMs = Date.now();
    const alive = this.#purge(input.slotId, nowMs);
    const userKey = `${input.userId}:${input.slotId}`;
    if (this.userHolds.has(userKey)) {
      return { ok: false, reason: 'DUPLICATE' };
    }
    const held = alive.reduce((s, e) => s + e.partySize, 0);
    if (input.bookedCount + held + input.partySize > input.maxBookings) {
      return { ok: false, reason: 'FULL' };
    }
    const token = crypto.randomUUID().replace(/-/g, '');
    const expiresAtMs = nowMs + ttl * 1000;
    const hold = {
      slotId: input.slotId,
      userId: input.userId,
      partySize: input.partySize,
      createdAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      holdToken: token,
    };
    alive.push({
      expiresAtMs,
      token,
      partySize: input.partySize,
      userId: input.userId,
    });
    this.bySlot.set(input.slotId, alive);
    this.holds.set(token, hold);
    this.userHolds.set(userKey, token);
    return {
      ok: true,
      holdToken: token,
      expiresAt: hold.expiresAt,
      heldCount: held + input.partySize,
      partySize: input.partySize,
      slotId: input.slotId,
      userId: input.userId,
    };
  }

  async getHold(holdToken) {
    const hold = this.holds.get(holdToken);
    if (!hold) return { ok: false, reason: 'NOT_FOUND' };
    if (new Date(hold.expiresAt).getTime() <= Date.now()) {
      await this.release({
        holdToken,
        userId: hold.userId,
        slotId: hold.slotId,
        partySize: hold.partySize,
      });
      return { ok: false, reason: 'NOT_FOUND' };
    }
    return { ok: true, hold };
  }

  async release(input) {
    const hold = this.holds.get(input.holdToken);
    if (!hold) return { ok: false, reason: 'NOT_FOUND' };
    this.holds.delete(input.holdToken);
    this.userHolds.delete(`${input.userId}:${input.slotId}`);
    const list = (this.bySlot.get(input.slotId) || []).filter((e) => e.token !== input.holdToken);
    this.bySlot.set(input.slotId, list);
    return { ok: true };
  }

  async getHeldCounts(slotIds) {
    const nowMs = Date.now();
    const out = {};
    for (const id of slotIds) {
      const alive = this.#purge(id, nowMs);
      out[id] = alive.reduce((s, e) => s + e.partySize, 0);
    }
    return out;
  }
}

/**
 * Default factory: Redis when ready, else null (service returns 503 on hold).
 * Tests can inject MemorySlotInventory via createSlotModule.
 */
export function createDefaultSlotInventory() {
  return new RedisSlotInventory(() => {
    const redis = RedisClient.getInstance();
    if (!redis.isReady()) return null;
    return redis.getClient();
  });
}
