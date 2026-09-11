import { describe, it, expect } from '@jest/globals';
import { SlotInventory } from '../../services/booking-service/src/inventory/slot.inventory.js';

describe('Booking Concurrency & Double Booking Prevention Test Suite', () => {
  it('should prevent double reservations on the same slot when concurrent requests arrive', async () => {
    const inventory = new SlotInventory();
    const slotId = '65fc8e129182a1048b111555';
    const partySize = 1;
    const maxBookings = 1;
    const bookedCount = 0;

    // User A and User B concurrently request the exact same slot
    const [userAResult, userBResult] = await Promise.all([
      inventory.reserve({ slotId, userId: 'user_A', partySize, maxBookings, bookedCount }),
      inventory.reserve({ slotId, userId: 'user_B', partySize, maxBookings, bookedCount }),
    ]);

    // Exactly one user must succeed (ok=true), and the second user must receive ok=false (0 double bookings)
    const successCount = [userAResult, userBResult].filter((r) => r.ok).length;
    const failCount = [userAResult, userBResult].filter((r) => !r.ok).length;

    expect(successCount).toBe(1);
    expect(failCount).toBe(1);

    // Verify hold token exists for winning user
    const winner = userAResult.ok ? userAResult : userBResult;
    expect(winner.holdToken).toBeDefined();
  });
});
