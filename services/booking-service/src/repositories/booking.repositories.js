import {
  SlotModel,
  BookingModel,
  BookingOutboxModel,
} from '../models/booking.models.js';

export class SlotRepository {
  async create(data) {
    return SlotModel.create(data);
  }

  async findById(id) {
    return SlotModel.findById(id);
  }

  async findAvailable({ date, serviceId, beauticianId }) {
    const filter = {
      status: 'ACTIVE',
      isBookable: true,
      $expr: { $lt: ['$bookedCount', '$maxBookings'] },
    };
    if (date) filter.date = date;
    if (serviceId) filter.serviceIds = serviceId;
    if (beauticianId) filter.beauticianId = beauticianId;

    return SlotModel.find(filter).sort({ startAt: 1 }).lean();
  }

  async findAndCount(filter = {}, { skip = 0, limit = 10 } = {}) {
    const [items, total] = await Promise.all([
      SlotModel.find(filter).sort({ date: 1, startAt: 1 }).skip(skip).limit(limit).lean().exec(),
      SlotModel.countDocuments(filter),
    ]);
    return { items, total };
  }

  async updateById(id, data) {
    return SlotModel.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  /**
   * Atomic seat reservation directly in MongoDB.
   * Prevents overbooking across distributed instances.
   */
  async atomicReserveSeat(slotId, partySize = 1, session = null) {
    const options = { new: true };
    if (session) options.session = session;

    return SlotModel.findOneAndUpdate(
      {
        _id: slotId,
        status: 'ACTIVE',
        isBookable: true,
        $expr: { $lte: [{ $add: ['$bookedCount', partySize] }, '$maxBookings'] },
      },
      {
        $inc: { bookedCount: partySize },
      },
      options,
    );
  }

  /**
   * Atomic seat release upon booking cancellation or timeout.
   */
  async atomicReleaseSeat(slotId, partySize = 1, session = null) {
    const options = { new: true };
    if (session) options.session = session;

    return SlotModel.findOneAndUpdate(
      { _id: slotId },
      {
        $inc: { bookedCount: -Math.abs(partySize) },
      },
      options,
    );
  }
}

export class BookingRepository {
  async create(data, session = null) {
    if (session) {
      const docs = await BookingModel.create([data], { session });
      return docs[0];
    }
    return BookingModel.create(data);
  }

  async findById(id) {
    return BookingModel.findById(id).populate('slotId');
  }

  async findByBookingNumber(bookingNumber) {
    return BookingModel.findOne({ bookingNumber }).populate('slotId');
  }

  async findByIdempotencyKey(idempotencyKey) {
    if (!idempotencyKey) return null;
    return BookingModel.findOne({ idempotencyKey }).populate('slotId');
  }

  async updateStatus(id, status, extra = {}, session = null) {
    const options = { new: true };
    if (session) options.session = session;

    return BookingModel.findByIdAndUpdate(
      id,
      { $set: { status, ...extra } },
      options,
    );
  }

  async updateItemStatus(bookingId, itemId, status, extra = {}, session = null) {
    const options = { new: true };
    if (session) options.session = session;

    const setFields = {
      'items.$.status': status,
    };
    if (extra.startedAt) setFields['items.$.startedAt'] = extra.startedAt;
    if (extra.completedAt) setFields['items.$.completedAt'] = extra.completedAt;
    if (extra.beauticianNotes) setFields['items.$.beauticianNotes'] = extra.beauticianNotes;

    return BookingModel.findOneAndUpdate(
      { _id: bookingId, 'items._id': itemId },
      { $set: setFields },
      options,
    );
  }

  async updateAssignments(bookingId, assignments, items, extra = {}, session = null) {
    const options = { new: true };
    if (session) options.session = session;

    return BookingModel.findByIdAndUpdate(
      bookingId,
      {
        $set: {
          beauticianAssignments: assignments,
          items,
          ...extra,
        },
      },
      options,
    );
  }

  async findUserBookings(accountOwnerId, { skip = 0, limit = 10 } = {}) {
    const filter = {
      $or: [{ userId: accountOwnerId }, { accountOwnerId }],
    };
    const [items, total] = await Promise.all([
      BookingModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('slotId')
        .lean()
        .exec(),
      BookingModel.countDocuments(filter),
    ]);
    return { items, total };
  }

  async findBeauticianAssignments(beauticianId, { skip = 0, limit = 10 } = {}) {
    const filter = {
      'beauticianAssignments.beauticianId': beauticianId,
    };
    const [items, total] = await Promise.all([
      BookingModel.find(filter)
        .sort({ scheduledDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      BookingModel.countDocuments(filter),
    ]);
    return { items, total };
  }

  async findAndCount(filter = {}, { skip = 0, limit = 10 } = {}) {
    const [items, total] = await Promise.all([
      BookingModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('slotId')
        .lean()
        .exec(),
      BookingModel.countDocuments(filter),
    ]);
    return { items, total };
  }
}

export class BookingOutboxRepository {
  async create(data, session = null) {
    if (session) {
      const docs = await BookingOutboxModel.create([data], { session });
      return docs[0];
    }
    return BookingOutboxModel.create(data);
  }
}
