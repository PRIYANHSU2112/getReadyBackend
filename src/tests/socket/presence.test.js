import { describe, it, expect, jest } from '@jest/globals';
import { PresenceManager } from '../../core/socket/presence/presence.manager.js';

describe('PresenceManager', () => {
  it('tracks online and offline users', async () => {
    const store = new Map();
    const redis = {
      hset: jest.fn(async (key, field, value) => {
        store.set(`${key}:${field}`, value);
      }),
      hget: jest.fn(async (key, field) => store.get(`${key}:${field}`) || null),
      hdel: jest.fn(async (key, field) => {
        store.delete(`${key}:${field}`);
      }),
      hexists: jest.fn(async (key, field) => (store.has(`${key}:${field}`) ? 1 : 0)),
      hgetall: jest.fn(async (key) => {
        const out = {};
        for (const [k, v] of store.entries()) {
          if (k.startsWith(`${key}:`)) out[k.slice(key.length + 1)] = v;
        }
        return out;
      }),
    };

    const presence = new PresenceManager(redis);
    await presence.setOnline('u1', 's1');
    expect(await presence.isOnline('u1')).toBe(true);
    await presence.setOffline('u1', 's1');
    expect(await presence.isOnline('u1')).toBe(false);
  });
});
