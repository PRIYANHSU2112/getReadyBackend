import { BaseService } from '../../common/base/BaseService.js';
import { AppError } from '../../common/errors/AppError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import { SlotAvailability, SlotStatus } from '../../common/constants/enums.js';
import {
  SLOT_AVAILABLE_CACHE_TTL_SECONDS,
  DEFAULT_SLOT_SORT,
  SLOT_SORT_FIELDS,
} from '../../common/constants/slot.js';
import { buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { parseListQuery } from '../../common/helpers/list-query.helper.js';

export class SlotService extends BaseService {
  /**
   * @param {import('./slot.repository.js').SlotRepository} slotRepository
   * @param {import('./slot.inventory.js').RedisSlotInventory|import('./slot.inventory.js').MemorySlotInventory} inventory
   * @param {import('../../core/redis/cache.service.js').CacheService|null} cacheService
   */
  constructor(slotRepository, inventory, cacheService = null) {
    super(null, cacheService);
    this.slotRepository = slotRepository;
    this.inventory = inventory;
  }

  #sanitize(doc) {
    if (!doc) return doc;
    const obj = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
    if (obj._id) obj.id = obj._id.toString();
    delete obj.__v;
    if (obj.beauticianId) obj.beauticianId = obj.beauticianId.toString();
    if (obj.createdBy) obj.createdBy = obj.createdBy.toString();
    if (obj.updatedBy) obj.updatedBy = obj.updatedBy.toString();
    if (Array.isArray(obj.serviceIds)) {
      obj.serviceIds = obj.serviceIds.map((id) => id.toString());
    }
    return obj;
  }

  #availCacheKey(date) {
    return this.cacheKey('slot', 'avail', date);
  }

  async #invalidateAvailCache(date) {
    if (!date) return;
    await this.invalidateCache(this.#availCacheKey(date));
  }

  #assertCapacity(minBookings, maxBookings) {
    if (minBookings > maxBookings) {
      throw new AppError(
        'minBookings must be <= maxBookings',
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.VALIDATION_ERROR,
      );
    }
  }

  #assertTimes(startAt, endAt) {
    if (new Date(endAt) <= new Date(startAt)) {
      throw new AppError(
        'endAt must be after startAt',
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.VALIDATION_ERROR,
      );
    }
  }

  #toAvailabilityDto(slot, heldCount) {
    const maxBookings = slot.maxBookings;
    const bookedCount = slot.bookedCount || 0;
    const remaining = Math.max(0, maxBookings - bookedCount - heldCount);
    const now = Date.now();
    const startMs = new Date(slot.startAt).getTime();
    const bookable =
      slot.status === SlotStatus.ACTIVE &&
      slot.isBookable !== false &&
      startMs > now &&
      remaining > 0;

    return {
      ...this.#sanitize(slot),
      heldCount,
      remaining,
      availability: bookable ? SlotAvailability.AVAILABLE : SlotAvailability.FULL,
    };
  }

  #normalizeCreatePayload(data, actorId) {
    const payload = {
      beauticianId: data.beauticianId ?? null,
      serviceIds: data.serviceIds || [],
      date: data.date,
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      minBookings: data.minBookings,
      maxBookings: data.maxBookings,
      bookedCount: 0,
      status: data.status || SlotStatus.ACTIVE,
      isBookable: data.isBookable !== false,
      notes: data.notes === '' ? null : data.notes ?? null,
    };
    this.#assertCapacity(payload.minBookings, payload.maxBookings);
    this.#assertTimes(payload.startAt, payload.endAt);
    if (actorId) {
      payload.createdBy = actorId;
      payload.updatedBy = actorId;
    }
    return payload;
  }

  async create(data, actorId = null) {
    const payload = this.#normalizeCreatePayload(data, actorId);
    const created = await this.slotRepository.create(payload);
    await this.#invalidateAvailCache(payload.date);
    return this.#sanitize(created);
  }

  async createBulk(slots, actorId = null) {
    const payloads = slots.map((s) => this.#normalizeCreatePayload(s, actorId));
    const created = await this.slotRepository.createMany(payloads);
    const dates = [...new Set(payloads.map((p) => p.date))];
    await Promise.all(dates.map((d) => this.#invalidateAvailCache(d)));
    return created.map((doc) => this.#sanitize(doc));
  }

  async update(id, data, actorId = null) {
    const existing = await this.slotRepository.findByIdLean(id);
    this.ensureFound(existing, 'Slot not found');

    const nextMin = data.minBookings ?? existing.minBookings;
    const nextMax = data.maxBookings ?? existing.maxBookings;
    this.#assertCapacity(nextMin, nextMax);

    if (nextMax < (existing.bookedCount || 0)) {
      throw new AppError(
        'maxBookings cannot be less than bookedCount',
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const nextStart = data.startAt ? new Date(data.startAt) : existing.startAt;
    const nextEnd = data.endAt ? new Date(data.endAt) : existing.endAt;
    this.#assertTimes(nextStart, nextEnd);

    const payload = { ...data };
    if (payload.notes === '') payload.notes = null;
    if (payload.startAt) payload.startAt = nextStart;
    if (payload.endAt) payload.endAt = nextEnd;
    if (actorId) payload.updatedBy = actorId;

    const updated = await this.slotRepository.updateById(id, payload);
    this.ensureFound(updated, 'Slot not found');
    await this.#invalidateAvailCache(existing.date);
    if (payload.date && payload.date !== existing.date) {
      await this.#invalidateAvailCache(payload.date);
    }
    return this.#sanitize(updated);
  }

  async remove(id, actorId = null) {
    const existing = await this.slotRepository.findByIdLean(id);
    this.ensureFound(existing, 'Slot not found');
    const cancelled = await this.slotRepository.softCancel(id, actorId);
    this.ensureFound(cancelled, 'Slot not found');
    await this.#invalidateAvailCache(existing.date);
    return this.#sanitize(cancelled);
  }

  async getById(id) {
    const slot = await this.slotRepository.findByIdLean(id);
    this.ensureFound(slot, 'Slot not found');
    const heldMap = await this.#safeHeldCounts([id]);
    return this.#toAvailabilityDto(slot, heldMap[id] || 0);
  }

  async list(query = {}) {
    const { page, limit, skip, sort } = parseListQuery(query, {
      defaultSort: DEFAULT_SLOT_SORT,
      allowedSortFields: SLOT_SORT_FIELDS,
    });
    const filter = this.slotRepository.buildAdminFilter(query);
    const { items, total } = await this.slotRepository.listAdmin(filter, {
      skip,
      limit,
      sort,
    });
    const ids = items.map((s) => s._id.toString());
    const heldMap = await this.#safeHeldCounts(ids);
    return {
      items: items.map((s) => this.#toAvailabilityDto(s, heldMap[s._id.toString()] || 0)),
      meta: buildPaginationMeta(total, { page, limit }),
    };
  }

  /**
   * Public — all slots for a date with AVAILABLE | FULL.
   */
  async listAvailableByDate(date) {
    const cacheKey = this.#availCacheKey(date);
    const cached = await this.getCached(cacheKey);
    if (cached) return cached;

    const slots = await this.slotRepository.listByDate(date);
    const ids = slots.map((s) => s._id.toString());
    const heldMap = await this.#safeHeldCounts(ids);
    const data = slots.map((s) => this.#toAvailabilityDto(s, heldMap[s._id.toString()] || 0));

    await this.setCached(cacheKey, data, SLOT_AVAILABLE_CACHE_TTL_SECONDS);
    return data;
  }

  async hold(slotId, userId, partySize = 1) {
    const slot = await this.slotRepository.findByIdLean(slotId);
    this.ensureFound(slot, 'Slot not found');

    if (slot.status !== SlotStatus.ACTIVE || slot.isBookable === false) {
      throw new AppError(
        'Slot is not bookable',
        HttpStatus.CONFLICT,
        ErrorCodes.SLOT_NOT_BOOKABLE,
      );
    }
    if (new Date(slot.startAt).getTime() <= Date.now()) {
      throw new AppError(
        'Slot start time has passed',
        HttpStatus.CONFLICT,
        ErrorCodes.SLOT_NOT_BOOKABLE,
      );
    }
    if (partySize < slot.minBookings) {
      throw new AppError(
        `partySize must be >= minBookings (${slot.minBookings})`,
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    if (!this.inventory?.isReady?.()) {
      throw new AppError(
        'Slot inventory temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCodes.SLOT_INVENTORY_UNAVAILABLE,
      );
    }

    const result = await this.inventory.reserve({
      slotId: slot._id.toString(),
      userId: String(userId),
      partySize,
      maxBookings: slot.maxBookings,
      bookedCount: slot.bookedCount || 0,
    });

    if (!result.ok) {
      if (result.reason === 'UNAVAILABLE') {
        throw new AppError(
          'Slot inventory temporarily unavailable',
          HttpStatus.SERVICE_UNAVAILABLE,
          ErrorCodes.SLOT_INVENTORY_UNAVAILABLE,
        );
      }
      if (result.reason === 'DUPLICATE') {
        throw new AppError(
          'You already hold this slot',
          HttpStatus.CONFLICT,
          ErrorCodes.SLOT_HOLD_EXISTS,
        );
      }
      if (result.reason === 'FULL') {
        throw new AppError('Slot is full', HttpStatus.CONFLICT, ErrorCodes.SLOT_FULL);
      }
      throw new AppError('Unable to hold slot', HttpStatus.CONFLICT, ErrorCodes.SLOT_FULL);
    }

    await this.#invalidateAvailCache(slot.date);
    const heldMap = await this.#safeHeldCounts([slot._id.toString()]);
    return {
      holdToken: result.holdToken,
      expiresAt: result.expiresAt,
      partySize: result.partySize,
      slot: this.#toAvailabilityDto(slot, heldMap[slot._id.toString()] || 0),
    };
  }

  async releaseHold(holdToken, userId) {
    if (!this.inventory?.isReady?.()) {
      throw new AppError(
        'Slot inventory temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCodes.SLOT_INVENTORY_UNAVAILABLE,
      );
    }

    const found = await this.inventory.getHold(holdToken);
    if (!found.ok) {
      if (found.reason === 'UNAVAILABLE') {
        throw new AppError(
          'Slot inventory temporarily unavailable',
          HttpStatus.SERVICE_UNAVAILABLE,
          ErrorCodes.SLOT_INVENTORY_UNAVAILABLE,
        );
      }
      throw new AppError(
        'Hold not found or expired',
        HttpStatus.NOT_FOUND,
        ErrorCodes.SLOT_HOLD_NOT_FOUND,
      );
    }

    const hold = found.hold;
    if (String(hold.userId) !== String(userId)) {
      throw new AppError('Hold not found or expired', HttpStatus.NOT_FOUND, ErrorCodes.SLOT_HOLD_NOT_FOUND);
    }

    const released = await this.inventory.release({
      holdToken,
      userId: hold.userId,
      slotId: hold.slotId,
      partySize: hold.partySize,
    });
    if (!released.ok) {
      throw new AppError(
        'Hold not found or expired',
        HttpStatus.NOT_FOUND,
        ErrorCodes.SLOT_HOLD_NOT_FOUND,
      );
    }

    const slot = await this.slotRepository.findByIdLean(hold.slotId);
    if (slot) await this.#invalidateAvailCache(slot.date);
    return { released: true, slotId: hold.slotId };
  }

  async #safeHeldCounts(slotIds) {
    if (!slotIds.length) return {};
    try {
      if (!this.inventory?.getHeldCounts) {
        return Object.fromEntries(slotIds.map((id) => [id, 0]));
      }
      return await this.inventory.getHeldCounts(slotIds);
    } catch {
      return Object.fromEntries(slotIds.map((id) => [id, 0]));
    }
  }
}
