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

  async findCalendarAppointments({
    startDate,
    endDate,
    date,
    beauticianId,
    serviceId,
    status,
    locationId,
    search,
    skip = 0,
    limit = 500,
  } = {}) {
    const filter = {};

    if (date) {
      filter.scheduledDate = date;
    } else if (startDate || endDate) {
      filter.scheduledDate = {};
      if (startDate) filter.scheduledDate.$gte = startDate;
      if (endDate) filter.scheduledDate.$lte = endDate;
    }

    if (beauticianId) {
      filter['beauticianAssignments.beauticianId'] = beauticianId;
    }

    if (serviceId) {
      filter['items.serviceId'] = serviceId;
    }

    if (status) {
      if (Array.isArray(status)) {
        filter.status = { $in: status };
      } else if (typeof status === 'string' && status.includes(',')) {
        filter.status = { $in: status.split(',').map((s) => s.trim().toUpperCase()) };
      } else {
        filter.status = status.toUpperCase();
      }
    }

    if (locationId) {
      filter.$or = [
        { addressId: locationId },
        { 'addressSnapshot.city': new RegExp(`^${locationId}$`, 'i') },
        { 'addressSnapshot.pincode': locationId },
      ];
    }

    if (search && search.trim()) {
      const s = search.trim();
      const searchRegex = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const searchOr = [
        { bookingNumber: searchRegex },
        { 'participants.name': searchRegex },
        { 'participants.mobileNumber': searchRegex },
        { 'beauticianAssignments.beauticianName': searchRegex },
        { 'items.serviceName': searchRegex },
        { specialInstructions: searchRegex },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }

    const [items, total] = await Promise.all([
      BookingModel.find(filter)
        .sort({ scheduledDate: 1, scheduledStartTime: 1, createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      BookingModel.countDocuments(filter),
    ]);

    return { items, total };
  }

  async getDayLevelCounts({
    startDate,
    endDate,
    date,
    beauticianId,
    serviceId,
    status,
    locationId,
  } = {}) {
    const match = {};
    if (date) {
      match.scheduledDate = date;
    } else if (startDate || endDate) {
      match.scheduledDate = {};
      if (startDate) match.scheduledDate.$gte = startDate;
      if (endDate) match.scheduledDate.$lte = endDate;
    }
    if (beauticianId) match['beauticianAssignments.beauticianId'] = beauticianId;
    if (serviceId) match['items.serviceId'] = serviceId;
    if (status) {
      if (Array.isArray(status)) match.status = { $in: status };
      else if (typeof status === 'string' && status.includes(',')) {
        match.status = { $in: status.split(',').map((s) => s.trim().toUpperCase()) };
      } else {
        match.status = status.toUpperCase();
      }
    }
    if (locationId) {
      match.$or = [
        { addressId: locationId },
        { 'addressSnapshot.city': new RegExp(`^${locationId}$`, 'i') },
        { 'addressSnapshot.pincode': locationId },
      ];
    }

    const agg = await BookingModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            date: '$scheduledDate',
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const dayCounts = {};
    for (const item of agg) {
      const d = item._id?.date;
      if (!d) continue;
      if (!dayCounts[d]) {
        dayCounts[d] = {
          total: 0,
          confirmed: 0,
          pending: 0,
          inProgress: 0,
          completed: 0,
          cancelled: 0,
          rescheduled: 0,
        };
      }
      dayCounts[d].total += item.count;
      const st = (item._id.status || '').toUpperCase();
      if (st === 'CONFIRMED' || st === 'ASSIGNED') dayCounts[d].confirmed += item.count;
      else if (st.includes('PENDING') || st === 'DRAFT') dayCounts[d].pending += item.count;
      else if (st === 'STARTED' || st === 'IN_PROGRESS' || st === 'ARRIVING') dayCounts[d].inProgress += item.count;
      else if (st === 'COMPLETED' || st === 'SERVICES_COMPLETED') dayCounts[d].completed += item.count;
      else if (st === 'CANCELLED' || st === 'FAILED' || st === 'PAYMENT_FAILED') dayCounts[d].cancelled += item.count;
      else if (st === 'RESCHEDULED') dayCounts[d].rescheduled += item.count;
    }

    return dayCounts;
  }

  async getSummaryStats({ startDate, endDate, beauticianId, serviceId, locationId } = {}) {
    const buildMatch = (start, end) => {
      const match = {};
      if (start || end) {
        match.scheduledDate = {};
        if (start) match.scheduledDate.$gte = start;
        if (end) match.scheduledDate.$lte = end;
      }
      if (beauticianId) match['beauticianAssignments.beauticianId'] = beauticianId;
      if (serviceId) match['items.serviceId'] = serviceId;
      if (locationId) {
        match.$or = [
          { addressId: locationId },
          { 'addressSnapshot.city': new RegExp(`^${locationId}$`, 'i') },
          { 'addressSnapshot.pincode': locationId },
        ];
      }
      return match;
    };

    const runAggregate = async (match) => {
      const agg = await BookingModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            revenue: { $sum: '$pricing.payableAmount' },
          },
        },
      ]);

      let total = 0;
      let confirmed = 0;
      let pending = 0;
      let inProgress = 0;
      let completed = 0;
      let cancelled = 0;
      let rescheduled = 0;
      let revenue = 0;

      for (const row of agg) {
        const c = row.count || 0;
        total += c;
        const st = (row._id || '').toUpperCase();
        if (st === 'CONFIRMED' || st === 'ASSIGNED') confirmed += c;
        else if (st.includes('PENDING') || st === 'DRAFT') pending += c;
        else if (st === 'STARTED' || st === 'IN_PROGRESS' || st === 'ARRIVING') inProgress += c;
        else if (st === 'COMPLETED' || st === 'SERVICES_COMPLETED') completed += c;
        else if (st === 'CANCELLED' || st === 'FAILED' || st === 'PAYMENT_FAILED') cancelled += c;
        else if (st === 'RESCHEDULED') rescheduled += c;

        if (st !== 'CANCELLED' && st !== 'FAILED' && st !== 'PAYMENT_FAILED') {
          revenue += row.revenue || 0;
        }
      }

      return { total, confirmed, pending, inProgress, completed, cancelled, rescheduled, revenue };
    };

    const currentStats = await runAggregate(buildMatch(startDate, endDate));

    let trends = { total: 0, confirmed: 0, pending: 0, cancelled: 0, completed: 0, revenue: 0 };
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffMs = Math.max(24 * 60 * 60 * 1000, end.getTime() - start.getTime());
      const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
      const prevStart = new Date(prevEnd.getTime() - diffMs);

      const prevStartStr = prevStart.toISOString().split('T')[0];
      const prevEndStr = prevEnd.toISOString().split('T')[0];

      const prevStats = await runAggregate(buildMatch(prevStartStr, prevEndStr));

      const calcTrend = (curr, prev) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return Math.round(((curr - prev) / prev) * 100);
      };

      trends = {
        total: calcTrend(currentStats.total, prevStats.total),
        confirmed: calcTrend(currentStats.confirmed, prevStats.confirmed),
        pending: calcTrend(currentStats.pending, prevStats.pending),
        cancelled: calcTrend(currentStats.cancelled, prevStats.cancelled),
        completed: calcTrend(currentStats.completed, prevStats.completed),
        revenue: calcTrend(currentStats.revenue, prevStats.revenue),
      };
    }

    return {
      ...currentStats,
      trends,
    };
  }

  async findOverlappingBookings({ date, startTime, endTime, beauticianId, excludeBookingId = null }) {
    if (!date || !startTime || !endTime || !beauticianId) return [];

    const startObj = typeof startTime === 'string' ? new Date(startTime.includes('T') ? startTime : `${date}T${startTime}:00Z`) : startTime;
    const endObj = typeof endTime === 'string' ? new Date(endTime.includes('T') ? endTime : `${date}T${endTime}:00Z`) : endTime;

    const filter = {
      scheduledDate: date,
      status: { $nin: ['CANCELLED', 'FAILED', 'REJECTED', 'PAYMENT_FAILED'] },
      'beauticianAssignments.beauticianId': beauticianId,
      scheduledStartTime: { $lt: endObj },
      scheduledEndTime: { $gt: startObj },
    };

    if (excludeBookingId) {
      filter._id = { $ne: excludeBookingId };
    }

    return BookingModel.find(filter).lean().exec();
  }

  async rescheduleBooking(id, { scheduledDate, scheduledStartTime, scheduledEndTime, beauticianId, beauticianName, actor, reason }, session = null) {
    const options = { new: true };
    if (session) options.session = session;

    const booking = await BookingModel.findById(id).session(session || null);
    if (!booking) return null;

    const oldDate = booking.scheduledDate;
    const oldStartTime = booking.scheduledStartTime;

    booking.scheduledDate = scheduledDate;
    if (scheduledStartTime) booking.scheduledStartTime = scheduledStartTime;
    if (scheduledEndTime) booking.scheduledEndTime = scheduledEndTime;
    booking.status = BOOKING_STATUS.RESCHEDULED;

    if (beauticianId) {
      const assignmentName = beauticianName || booking.beauticianAssignments?.[0]?.beauticianName || 'Beautician';
      booking.beauticianAssignments = [
        {
          beauticianId,
          beauticianName: assignmentName,
          assignedItemIds: booking.items.map((i) => i._id),
          assignmentStatus: 'ASSIGNED',
          assignedBy: 'ADMIN',
          assignedAt: new Date(),
        },
      ];
      booking.assignedBeauticianCount = 1;
      booking.items.forEach((item) => {
        item.assignedBeauticianId = beauticianId;
        item.assignedBeauticianName = assignmentName;
      });
    }

    booking.statusHistory.push({
      status: BOOKING_STATUS.RESCHEDULED,
      timestamp: new Date(),
      actor: actor || 'ADMIN',
      reason: reason || 'Booking rescheduled by admin',
      metadata: {
        oldDate,
        oldStartTime,
        newDate: scheduledDate,
        newStartTime: scheduledStartTime,
      },
    });

    return booking.save(options);
  }

  async completeBooking(id, { actor = 'ADMIN', notes = null } = {}, session = null) {
    const options = { new: true };
    if (session) options.session = session;

    const booking = await BookingModel.findById(id).session(session || null);
    if (!booking) return null;

    booking.status = BOOKING_STATUS.COMPLETED;
    booking.items.forEach((item) => {
      item.status = 'COMPLETED';
      item.completedAt = new Date();
      if (notes) item.beauticianNotes = notes;
    });

    if (booking.beauticianAssignments) {
      booking.beauticianAssignments.forEach((assign) => {
        assign.assignmentStatus = 'COMPLETED';
        assign.completedAt = new Date();
      });
    }

    booking.statusHistory.push({
      status: BOOKING_STATUS.COMPLETED,
      timestamp: new Date(),
      actor: actor || 'ADMIN',
      reason: notes || 'Booking completed by admin',
    });

    return booking.save(options);
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
