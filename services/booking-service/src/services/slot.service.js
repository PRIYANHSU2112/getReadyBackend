import { AppError, HttpStatus, ErrorCodes } from '@getready/errors';
import { EVENT_TYPES } from '@getready/rabbitmq';

export class SlotService {
  constructor(slotRepo, slotInventory, eventPublisher = null) {
    this.slotRepo = slotRepo;
    this.slotInventory = slotInventory;
    this.eventPublisher = eventPublisher;
  }

  async listAvailable(query = {}) {
    return this.slotRepo.findAvailable({
      date: query.date,
      serviceId: query.serviceId,
      beauticianId: query.beauticianId,
    });
  }

  async listAdmin(query = {}) {
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '10', 10), 100);
    const skip = (page - 1) * limit;
    const filter = {};
    if (query.date) filter.date = query.date;
    if (query.status) filter.status = query.status;
    if (query.beauticianId) filter.beauticianId = query.beauticianId;

    const { items, total } = await this.slotRepo.findAndCount(filter, { skip, limit });
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const slot = await this.slotRepo.findById(id);
    if (!slot) throw new AppError('Slot not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return slot;
  }

  async create(data, createdBy = null) {
    const slot = await this.slotRepo.create({ ...data, createdBy });
    if (this.eventPublisher) {
      this.eventPublisher.publish('slot.created', EVENT_TYPES.SLOT_CREATED, {
        slotId: slot._id.toString(),
        date: slot.date,
        startAt: slot.startAt,
        maxBookings: slot.maxBookings,
      }).catch(() => {});
    }
    return slot;
  }

  async bulkCreate({ date, startHour = 9, endHour = 19, slotDurationMinutes = 60, maxBookings = 1, beauticianId = null, serviceIds = [] }, createdBy = null) {
    const slots = [];
    const baseDate = new Date(`${date}T00:00:00Z`);

    for (let h = startHour; h < endHour; h += slotDurationMinutes / 60) {
      const startAt = new Date(baseDate.getTime() + h * 3600 * 1000);
      const endAt = new Date(startAt.getTime() + slotDurationMinutes * 60 * 1000);

      const slot = await this.slotRepo.create({
        date,
        startAt,
        endAt,
        maxBookings,
        minBookings: 1,
        beauticianId,
        serviceIds,
        createdBy,
      });
      slots.push(slot);
    }

    return { createdCount: slots.length, slots };
  }

  async update(id, data, updatedBy = null) {
    const updated = await this.slotRepo.updateById(id, { ...data, updatedBy });
    if (!updated) throw new AppError('Slot not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return updated;
  }

  async remove(id) {
    return this.slotRepo.updateById(id, { status: 'CANCELLED', isBookable: false });
  }

  /**
   * Soft-hold a slot for 5 minutes during checkout.
   */
  async holdSlot(userId, { slotId, partySize = 1, ttlSeconds = 300 }) {
    const slot = await this.getById(slotId);
    if (slot.status !== 'ACTIVE' || !slot.isBookable) {
      throw new AppError('Slot is not available', HttpStatus.UNPROCESSABLE_ENTITY, ErrorCodes.BOOKING_SLOT_UNAVAILABLE);
    }

    const holdResult = await this.slotInventory.reserve({
      slotId,
      userId,
      partySize,
      maxBookings: slot.maxBookings,
      bookedCount: slot.bookedCount,
      ttlSeconds,
    });

    if (!holdResult.ok) {
      if (holdResult.reason === 'DUPLICATE') {
        throw new AppError('You already have an active hold on this slot', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
      }
      throw new AppError('Slot is fully booked', HttpStatus.UNPROCESSABLE_ENTITY, ErrorCodes.BOOKING_SLOT_UNAVAILABLE);
    }

    if (this.eventPublisher) {
      this.eventPublisher.publish('slot.reserved', EVENT_TYPES.SLOT_RESERVED, {
        slotId,
        userId,
        partySize,
        holdToken: holdResult.holdToken,
      }).catch(() => {});
    }

    return holdResult;
  }

  async releaseSlot(userId, { slotId, holdToken, partySize = 1 }) {
    await this.slotInventory.release({ holdToken, userId, slotId, partySize });
    if (this.eventPublisher) {
      this.eventPublisher.publish('slot.released', EVENT_TYPES.SLOT_RELEASED, {
        slotId,
        userId,
        holdToken,
      }).catch(() => {});
    }
    return { released: true };
  }
}
