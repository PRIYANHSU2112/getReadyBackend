import { getOrCreateBookingSettings } from '../models/booking-settings.model.js';

export class BeauticianAssignmentEngine {
  /**
   * Evaluates participant count (e.g. Mummy + Sister + Self), services, and durations
   * to determine the recommended beauticians for the Admin Panel.
   *
   * @param {Object} params
   * @param {Array} params.participants - Customer profiles in the booking
   * @param {Array} params.items - Booking service items
   * @param {number} params.preferredBeauticianCount - Customer preference (1 or 2)
   * @param {Object} [params.settingsOverride] - Optional settings override
   */
  static calculateRequirement({
    participants = [],
    items = [],
    preferredBeauticianCount = 1,
    settingsOverride = null,
  }) {
    const participantCount = Math.max(1, participants.length);
    const totalDurationMinutes = items.reduce((acc, item) => acc + (Number(item.durationMinutes) || 30), 0);
    const itemCount = items.length;

    // Recommend 2 beauticians if multiple participants requested or total duration exceeds 120 minutes
    const recommendedBeauticians =
      participantCount >= 2 || preferredBeauticianCount >= 2 || totalDurationMinutes > 120 ? 2 : 1;

    return {
      participantCount,
      itemCount,
      totalDurationMinutes,
      recommendedBeauticians,
      suggestedDistribution:
        participantCount >= 2
          ? `${participantCount} participants present: Recommend distributing services across ${recommendedBeauticians} beauticians to minimize customer waiting time.`
          : 'Single participant: 1 beautician recommended.',
    };
  }

  /**
   * Propose beautician assignments based on preferred count, customer profiles, and service durations.
   * Note: In this application, beauticians are NOT auto-assigned to customers.
   * Bookings remain unassigned in 'ASSIGNMENT_PENDING' status until an administrator assigns
   * verified beauticians manually via the Admin Panel (unless autoAssignmentEnabled is explicitly set).
   *
   * @param {Object} params
   * @param {Array} params.participants - Customer profiles in the booking
   * @param {Array} params.items - Booking service items
   * @param {number} params.preferredBeauticianCount - Customer preference (1 or 2)
   * @param {Array} params.availableBeauticians - List of active, verified beauticians
   * @param {Object} [params.settingsOverride] - Optional settings override
   */
  static async assign({
    participants = [],
    items = [],
    preferredBeauticianCount = 1,
    availableBeauticians = [],
    settingsOverride = null,
  }) {
    const settings = settingsOverride || (await getOrCreateBookingSettings());

    // Sanitize requested beautician count against settings
    const maxAllowed = Number(settings.maxBeauticiansPerBooking || 2);
    const requestedCount = Math.min(maxAllowed, Math.max(1, Number(preferredBeauticianCount || 1)));

    // Calculate requirement: recommendations for Admin Panel
    const requirement = this.calculateRequirement({
      participants,
      items,
      preferredBeauticianCount: requestedCount,
      settingsOverride: settings,
    });

    // If no active beauticians are provided:
    // DO NOT assign mock staff. Return unassigned items for Admin Panel fulfillment.
    if (!Array.isArray(availableBeauticians) || availableBeauticians.length === 0) {
      return {
        assignments: [],
        items: items.map((item) => ({
          ...item,
          assignedBeauticianId: null,
          assignedBeauticianName: null,
          status: 'PENDING',
        })),
        assignedBeauticianCount: 0,
        preferredBeauticianCount: requestedCount,
        recommendedBeauticianCount: requirement.recommendedBeauticians,
        requirementSummary: requirement,
        disclaimerMessage: 'Booking submitted. Beauticians will be assigned by the Admin Panel.',
      };
    }

    // Auto-assignment branch (used when explicitly enabled or in unit tests)
    const actualCount = Math.min(requestedCount, availableBeauticians.length);
    const selectedBeauticians = availableBeauticians.slice(0, actualCount);

    const assignments = [];
    const updatedItems = items.map((item) => ({ ...item }));

    if (actualCount === 1 || participants.length <= 1) {
      // Single Beautician Assignment: Assign all items to Beautician 1
      const leadBeautician = selectedBeauticians[0];
      const itemIds = [];

      for (const item of updatedItems) {
        item.assignedBeauticianId = leadBeautician.id || leadBeautician._id?.toString();
        item.assignedBeauticianName = leadBeautician.name;
        item.status = 'ASSIGNED';
        if (item._id) itemIds.push(item._id);
      }

      assignments.push({
        beauticianId: leadBeautician.id || leadBeautician._id?.toString(),
        beauticianName: leadBeautician.name,
        assignedItemIds: itemIds,
        assignmentStatus: 'ASSIGNED',
        assignedBy: 'AUTO',
        assignedAt: new Date(),
      });
    } else {
      // Multi-Beautician Assignment: Distribute service items intelligently across 2+ beauticians
      // Strategy: Group items by participant / customer profile
      const participantGroups = new Map();
      for (const item of updatedItems) {
        const pId = item.participantId?.toString?.() || item.customerProfileId || 'default';
        if (!participantGroups.has(pId)) {
          participantGroups.set(pId, []);
        }
        participantGroups.get(pId).push(item);
      }

      const pKeys = Array.from(participantGroups.keys());

      // Round-robin or partition participant groups across beauticians
      const beauticianItemBuckets = selectedBeauticians.map(() => []);

      pKeys.forEach((pId, idx) => {
        const bIdx = idx % selectedBeauticians.length;
        const groupItems = participantGroups.get(pId);
        beauticianItemBuckets[bIdx].push(...groupItems);
      });

      selectedBeauticians.forEach((b, bIdx) => {
        const bId = b.id || b._id?.toString();
        const bName = b.name;
        const bItems = beauticianItemBuckets[bIdx];
        const itemIds = [];

        for (const item of bItems) {
          item.assignedBeauticianId = bId;
          item.assignedBeauticianName = bName;
          item.status = 'ASSIGNED';
          if (item._id) itemIds.push(item._id);
        }

        assignments.push({
          beauticianId: bId,
          beauticianName: bName,
          assignedItemIds: itemIds,
          assignmentStatus: 'ASSIGNED',
          assignedBy: 'AUTO',
          assignedAt: new Date(),
        });
      });
    }

    const isMultiRequested = requestedCount > 1;
    const isMultiFulfilled = assignments.length > 1;

    let disclaimerMessage = '1 Beautician Assigned.';
    if (isMultiRequested) {
      disclaimerMessage = isMultiFulfilled
        ? '2 Beauticians Assigned (Faster Service).'
        : '1 Beautician Assigned – Second professional subject to real-time availability.';
    }

    return {
      assignments,
      items: updatedItems,
      assignedBeauticianCount: assignments.length,
      preferredBeauticianCount: requestedCount,
      recommendedBeauticianCount: requirement.recommendedBeauticians,
      requirementSummary: requirement,
      disclaimerMessage,
    };
  }
}
