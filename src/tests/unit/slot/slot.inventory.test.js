import { describe, it, expect, beforeEach } from '@jest/globals';
import { MemorySlotInventory } from '../../../modules/slot/slot.inventory.js';

describe('MemorySlotInventory', () => {
  let inventory;

  beforeEach(() => {
    inventory = new MemorySlotInventory(1);
  });

  it('reserves seats and reports held counts', async () => {
    const res = await inventory.reserve({
      slotId: 'slot1',
      userId: 'user1',
      partySize: 1,
      maxBookings: 2,
      bookedCount: 0,
    });
    expect(res.ok).toBe(true);
    expect(res.holdToken).toBeTruthy();

    const counts = await inventory.getHeldCounts(['slot1', 'slot2']);
    expect(counts.slot1).toBe(1);
    expect(counts.slot2).toBe(0);
  });

  it('rejects when full', async () => {
    await inventory.reserve({
      slotId: 'slot1',
      userId: 'user1',
      partySize: 1,
      maxBookings: 1,
      bookedCount: 0,
    });
    const second = await inventory.reserve({
      slotId: 'slot1',
      userId: 'user2',
      partySize: 1,
      maxBookings: 1,
      bookedCount: 0,
    });
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('FULL');
  });

  it('rejects duplicate hold for same user+slot', async () => {
    await inventory.reserve({
      slotId: 'slot1',
      userId: 'user1',
      partySize: 1,
      maxBookings: 2,
      bookedCount: 0,
    });
    const dup = await inventory.reserve({
      slotId: 'slot1',
      userId: 'user1',
      partySize: 1,
      maxBookings: 2,
      bookedCount: 0,
    });
    expect(dup.ok).toBe(false);
    expect(dup.reason).toBe('DUPLICATE');
  });

  it('releases seats', async () => {
    const res = await inventory.reserve({
      slotId: 'slot1',
      userId: 'user1',
      partySize: 1,
      maxBookings: 1,
      bookedCount: 0,
    });
    const released = await inventory.release({
      holdToken: res.holdToken,
      userId: 'user1',
      slotId: 'slot1',
      partySize: 1,
    });
    expect(released.ok).toBe(true);
    const counts = await inventory.getHeldCounts(['slot1']);
    expect(counts.slot1).toBe(0);
  });

  it('expires holds after TTL', async () => {
    const short = new MemorySlotInventory(1);
    await short.reserve({
      slotId: 'slot1',
      userId: 'user1',
      partySize: 1,
      maxBookings: 1,
      bookedCount: 0,
      ttlSeconds: 0,
    });
    // ttlSeconds 0 => expiresAtMs = now; purge on next read
    await new Promise((r) => setTimeout(r, 5));
    const counts = await short.getHeldCounts(['slot1']);
    expect(counts.slot1).toBe(0);
  });
});
