import { AppError, HttpStatus, ErrorCodes } from '@getready/errors';
import { EVENT_TYPES } from '@getready/rabbitmq';
import { BOOKING_STATUS } from '../models/booking.models.js';

function formatTimeString(dateObj) {
  if (!dateObj) return '00:00';
  if (typeof dateObj === 'string') {
    if (/^\d{2}:\d{2}$/.test(dateObj)) return dateObj;
    const d = new Date(dateObj);
    if (!isNaN(d.getTime())) {
      return d.toISOString().substring(11, 16);
    }
    return dateObj;
  }
  if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
    return dateObj.toISOString().substring(11, 16);
  }
  return '00:00';
}

function computeDurationMinutes(booking) {
  if (booking.scheduledStartTime && booking.scheduledEndTime) {
    const s = new Date(booking.scheduledStartTime).getTime();
    const e = new Date(booking.scheduledEndTime).getTime();
    if (e > s) {
      return Math.round((e - s) / (60 * 1000));
    }
  }
  if (Array.isArray(booking.items) && booking.items.length > 0) {
    return booking.items.reduce((sum, item) => sum + (item.durationMinutes || 30), 0);
  }
  return 60;
}

export class CalendarService {
  /**
   * @param {import('../repositories/booking.repositories.js').BookingRepository} bookingRepo
   * @param {import('../repositories/booking.repositories.js').SlotRepository} slotRepo
   * @param {import('@getready/rabbitmq').EventPublisher|null} eventPublisher
   */
  constructor(bookingRepo, slotRepo, eventPublisher = null) {
    this.bookingRepo = bookingRepo;
    this.slotRepo = slotRepo;
    this.eventPublisher = eventPublisher;
  }

  /**
   * Normalize and transform a raw DB booking into a standard Calendar Appointment
   */
  transformAppointment(booking) {
    const startTimeStr = formatTimeString(booking.scheduledStartTime);
    const duration = computeDurationMinutes(booking);

    let endTimeStr = formatTimeString(booking.scheduledEndTime);
    if (endTimeStr === '00:00' && startTimeStr !== '00:00') {
      const [sh, sm] = startTimeStr.split(':').map(Number);
      const totalMinutes = sh * 60 + sm + duration;
      const eh = Math.floor(totalMinutes / 60) % 24;
      const em = totalMinutes % 60;
      endTimeStr = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
    }

    const firstItem = booking.items?.[0] || {};
    const firstParticipant = booking.participants?.[0] || {};
    const firstBeautician = booking.beauticianAssignments?.[0] || {};

    const serviceNames = (booking.items || []).map((i) => i.serviceName).filter(Boolean);
    const beauticianNames = (booking.beauticianAssignments || []).map((b) => b.beauticianName).filter(Boolean);

    const addressSnap = booking.addressSnapshot || {};
    const fullAddress = [
      addressSnap.addressLine1 || addressSnap.formattedAddress || addressSnap.street,
      addressSnap.city,
      addressSnap.state,
      addressSnap.pincode,
    ]
      .filter(Boolean)
      .join(', ');

    return {
      id: booking._id?.toString() || booking.id,
      _id: booking._id?.toString() || booking.id,
      bookingId: booking.bookingNumber || booking._id?.toString(),
      bookingNumber: booking.bookingNumber,
      userId: booking.userId,
      accountOwnerId: booking.accountOwnerId,
      date: booking.scheduledDate,
      scheduledDate: booking.scheduledDate,
      startTime: startTimeStr,
      endTime: endTimeStr,
      scheduledStartTime: booking.scheduledStartTime,
      scheduledEndTime: booking.scheduledEndTime,
      durationMinutes: duration,
      status: booking.status,
      paymentStatus: booking.paymentStatus || 'PENDING',
      paymentMethod: booking.paymentMethod || 'online',
      service: {
        id: firstItem.serviceId || 'srv-default',
        name: serviceNames.length > 0 ? serviceNames.join(', ') : 'Salon Service',
        itemCount: booking.items?.length || 1,
        items: booking.items || [],
      },
      customer: {
        id: firstParticipant.customerProfileId || booking.userId || 'cust-default',
        name: firstParticipant.name || 'Valued Customer',
        phone: firstParticipant.mobileNumber || '',
        avatar: '',
        participants: booking.participants || [],
      },
      beautician: {
        id: firstBeautician.beauticianId || null,
        name: beauticianNames.length > 0 ? beauticianNames.join(', ') : 'Unassigned',
        avatar: '',
        status: 'ONLINE',
        assignments: booking.beauticianAssignments || [],
      },
      location: {
        id: booking.addressId || 'loc-home',
        name: addressSnap.city || 'Home Service',
        address: fullAddress || 'Home Service Location',
      },
      amount: booking.pricing?.payableAmount || 0,
      pricing: booking.pricing,
      notes: booking.specialInstructions || '',
      hasConflict: false,
      conflicts: [],
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    };
  }

  /**
   * Detect overlapping appointments for beauticians
   */
  attachConflicts(appointments) {
    const timeToMinutes = (t) => {
      if (!t || typeof t !== 'string' || !t.includes(':')) return 0;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const activeAppointments = appointments.filter(
      (a) => !['CANCELLED', 'FAILED', 'PAYMENT_FAILED', 'REJECTED'].includes(a.status),
    );

    // Group by date
    const byDate = new Map();
    activeAppointments.forEach((app) => {
      const d = app.date;
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d).push(app);
    });

    byDate.forEach((dateApps) => {
      for (let i = 0; i < dateApps.length; i++) {
        const a = dateApps[i];
        const aBeauticians = (a.beautician?.assignments || []).map((b) => b.beauticianId).filter(Boolean);
        if (a.beautician?.id && !aBeauticians.includes(a.beautician.id)) {
          aBeauticians.push(a.beautician.id);
        }
        if (aBeauticians.length === 0) continue;

        const aStart = timeToMinutes(a.startTime);
        const aEnd = timeToMinutes(a.endTime);

        for (let j = i + 1; j < dateApps.length; j++) {
          const b = dateApps[j];
          if (a.id === b.id) continue;

          const bBeauticians = (b.beautician?.assignments || []).map((x) => x.beauticianId).filter(Boolean);
          if (b.beautician?.id && !bBeauticians.includes(b.beautician.id)) {
            bBeauticians.push(b.beautician.id);
          }
          if (bBeauticians.length === 0) continue;

          // Check if they share at least one beautician
          const sharedBeautician = aBeauticians.some((bId) => bBeauticians.includes(bId));
          if (!sharedBeautician) continue;

          const bStart = timeToMinutes(b.startTime);
          const bEnd = timeToMinutes(b.endTime);

          // Interval overlap: (StartA < EndB) && (EndA > StartB)
          if (aStart < bEnd && aEnd > bStart) {
            a.hasConflict = true;
            b.hasConflict = true;

            const conflictForA = {
              bookingId: b.bookingId || b.id,
              bookingNumber: b.bookingNumber || b.bookingId,
              customerName: b.customer?.name,
              beauticianName: b.beautician?.name,
              startTime: b.startTime,
              endTime: b.endTime,
              type: 'BEAUTICIAN_OVERLAP',
            };
            const conflictForB = {
              bookingId: a.bookingId || a.id,
              bookingNumber: a.bookingNumber || a.bookingId,
              customerName: a.customer?.name,
              beauticianName: a.beautician?.name,
              startTime: a.startTime,
              endTime: a.endTime,
              type: 'BEAUTICIAN_OVERLAP',
            };

            if (!a.conflicts.some((c) => c.bookingId === conflictForA.bookingId)) {
              a.conflicts.push(conflictForA);
            }
            if (!b.conflicts.some((c) => c.bookingId === conflictForB.bookingId)) {
              b.conflicts.push(conflictForB);
            }
          }
        }
      }
    });

    return appointments;
  }

  /**
   * Main Calendar Query API
   */
  async getCalendar(query = {}) {
    const view = (query.view || 'month').toLowerCase();
    const todayStr = new Date().toISOString().split('T')[0];

    let startDate = query.startDate;
    let endDate = query.endDate;
    let date = query.date;

    // View-specific date range resolution
    if (view === 'day') {
      date = date || startDate || todayStr;
      startDate = date;
      endDate = date;
    } else if (view === 'week') {
      if (!startDate) {
        const refDate = date ? new Date(date) : new Date();
        const dayOfWeek = refDate.getDay(); // 0 is Sunday
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(refDate.getTime() + mondayOffset * 24 * 60 * 60 * 1000);
        const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
        startDate = monday.toISOString().split('T')[0];
        endDate = sunday.toISOString().split('T')[0];
      } else if (!endDate) {
        const start = new Date(startDate);
        const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
        endDate = end.toISOString().split('T')[0];
      }
    } else if (view === 'month') {
      if (!startDate && !endDate) {
        const ref = date ? new Date(date) : new Date();
        const y = ref.getFullYear();
        const m = ref.getMonth();
        const firstDay = new Date(Date.UTC(y, m, 1));
        const lastDay = new Date(Date.UTC(y, m + 1, 0));
        startDate = firstDay.toISOString().split('T')[0];
        endDate = lastDay.toISOString().split('T')[0];
      }
    } else if (view === 'agenda') {
      if (!startDate) startDate = date || todayStr;
      if (!endDate) {
        const start = new Date(startDate);
        const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
        endDate = end.toISOString().split('T')[0];
      }
    }

    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '500', 10), 1000);
    const skip = (page - 1) * limit;

    const [appointmentsResult, dayCounts, summary] = await Promise.all([
      this.bookingRepo.findCalendarAppointments({
        startDate,
        endDate,
        date: view === 'day' ? date : undefined,
        beauticianId: query.beauticianId,
        serviceId: query.serviceId,
        status: query.status,
        locationId: query.locationId,
        search: query.search,
        skip,
        limit,
      }),
      this.bookingRepo.getDayLevelCounts({
        startDate,
        endDate,
        date: view === 'day' ? date : undefined,
        beauticianId: query.beauticianId,
        serviceId: query.serviceId,
        status: query.status,
        locationId: query.locationId,
      }),
      this.bookingRepo.getSummaryStats({
        startDate,
        endDate,
        beauticianId: query.beauticianId,
        serviceId: query.serviceId,
        locationId: query.locationId,
      }),
    ]);

    const rawAppointments = appointmentsResult.items.map((b) => this.transformAppointment(b));
    const appointmentsWithConflicts = this.attachConflicts(rawAppointments);

    // Group by date for agenda view
    const groupedByDate = {};
    appointmentsWithConflicts.forEach((app) => {
      const d = app.date || 'Unknown';
      if (!groupedByDate[d]) groupedByDate[d] = [];
      groupedByDate[d].push(app);
    });

    return {
      view,
      startDate: startDate || todayStr,
      endDate: endDate || todayStr,
      date: date || (view === 'day' ? startDate : undefined),
      appointments: appointmentsWithConflicts,
      groupedByDate,
      dayCounts,
      summary,
      meta: {
        total: appointmentsResult.total,
        page,
        limit,
        totalPages: Math.ceil(appointmentsResult.total / limit),
      },
    };
  }

  /**
   * Today's Appointments (Right Sidebar widget)
   */
  async getTodayAppointments(query = {}) {
    const todayStr = query.date || new Date().toISOString().split('T')[0];
    const { items, total } = await this.bookingRepo.findCalendarAppointments({
      date: todayStr,
      beauticianId: query.beauticianId,
      serviceId: query.serviceId,
      status: query.status,
      locationId: query.locationId,
      search: query.search,
      skip: 0,
      limit: 100,
    });

    const appointments = items.map((b) => this.transformAppointment(b));
    const appointmentsWithConflicts = this.attachConflicts(appointments);

    // Sort chronologically
    appointmentsWithConflicts.sort((a, b) => a.startTime.localeCompare(b.startTime));

    return {
      date: todayStr,
      appointments: appointmentsWithConflicts,
      total,
    };
  }

  /**
   * Calendar KPI Summary & Trends
   */
  async getSummary(query = {}) {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();

    const defaultStart = new Date(Date.UTC(y, m, 1)).toISOString().split('T')[0];
    const defaultEnd = new Date(Date.UTC(y, m + 1, 0)).toISOString().split('T')[0];

    const startDate = query.startDate || defaultStart;
    const endDate = query.endDate || defaultEnd;

    return this.bookingRepo.getSummaryStats({
      startDate,
      endDate,
      beauticianId: query.beauticianId,
      serviceId: query.serviceId,
      locationId: query.locationId,
    });
  }

  /**
   * Beautician Availability API
   */
  async getAvailability(query = {}) {
    const { date, beauticianId, serviceId, durationMinutes = 60 } = query;
    if (!date) {
      throw new AppError('Date parameter is required', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const startHour = 9; // 09:00 AM
    const endHour = 20; // 08:00 PM
    const stepMinutes = 60;

    let overlappingBookings = [];
    if (beauticianId) {
      overlappingBookings = await this.bookingRepo.findOverlappingBookings({
        date,
        startTime: '09:00',
        endTime: '20:00',
        beauticianId,
      });
    }

    const slots = [];
    for (let hour = startHour; hour < endHour; hour += stepMinutes / 60) {
      const sh = String(Math.floor(hour)).padStart(2, '0');
      const sm = String((hour % 1) * 60).padStart(2, '0');
      const startTimeStr = `${sh}:${sm}`;

      const endHourVal = hour + durationMinutes / 60;
      const eh = String(Math.floor(endHourVal)).padStart(2, '0');
      const em = String(Math.round((endHourVal % 1) * 60)).padStart(2, '0');
      const endTimeStr = `${eh}:${em}`;

      const slotStartMin = hour * 60;
      const slotEndMin = endHourVal * 60;

      let isAvailable = true;
      let conflictBookingId = null;

      if (beauticianId) {
        for (const booking of overlappingBookings) {
          const bStart = formatTimeString(booking.scheduledStartTime);
          const bEnd = formatTimeString(booking.scheduledEndTime);
          const [bsh, bsm] = bStart.split(':').map(Number);
          const [beh, bem] = bEnd.split(':').map(Number);
          const bStartMin = bsh * 60 + bsm;
          const bEndMin = beh * 60 + bem;

          if (slotStartMin < bEndMin && slotEndMin > bStartMin) {
            isAvailable = false;
            conflictBookingId = booking.bookingNumber || booking._id?.toString();
            break;
          }
        }
      }

      slots.push({
        startTime: startTimeStr,
        endTime: endTimeStr,
        available: isAvailable,
        bookingId: conflictBookingId,
      });
    }

    return {
      date,
      beauticianId: beauticianId || null,
      serviceId: serviceId || null,
      durationMinutes: Number(durationMinutes),
      slots,
    };
  }

  /**
   * Conflicts Detection API
   */
  async getConflicts(query = {}) {
    const calendarData = await this.getCalendar(query);
    const conflicts = calendarData.appointments.filter((a) => a.hasConflict);

    return {
      totalConflicts: conflicts.length,
      appointmentsWithConflicts: conflicts,
    };
  }

  /**
   * Reschedule Booking with Conflict Prevention
   */
  async rescheduleBooking(id, data, actor = 'ADMIN') {
    const { date, startTime, endTime, beauticianId, beauticianName, reason } = data;

    const booking = await this.bookingRepo.findById(id);
    if (!booking) {
      throw new AppError('Booking not found', HttpStatus.NOT_FOUND, ErrorCodes.BOOKING_NOT_FOUND);
    }

    if (booking.status === BOOKING_STATUS.CANCELLED) {
      throw new AppError('Cannot reschedule a cancelled booking', HttpStatus.BAD_REQUEST, ErrorCodes.BOOKING_ALREADY_CANCELLED);
    }
    if (booking.status === BOOKING_STATUS.COMPLETED) {
      throw new AppError('Cannot reschedule an already completed booking', HttpStatus.BAD_REQUEST, ErrorCodes.BOOKING_ALREADY_COMPLETED);
    }

    const duration = computeDurationMinutes(booking);
    let resolvedEndTime = endTime;
    if (!resolvedEndTime && startTime) {
      const [sh, sm] = startTime.split(':').map(Number);
      const totalMin = sh * 60 + sm + duration;
      const eh = Math.floor(totalMin / 60) % 24;
      const em = totalMin % 60;
      resolvedEndTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
    }

    const scheduledStartTimeObj = new Date(`${date}T${startTime}:00Z`);
    const scheduledEndTimeObj = new Date(`${date}T${resolvedEndTime}:00Z`);

    const targetBeauticianId = beauticianId || booking.beauticianAssignments?.[0]?.beauticianId;

    // Check for beautician conflict if beautician assigned
    if (targetBeauticianId) {
      const overlapping = await this.bookingRepo.findOverlappingBookings({
        date,
        startTime: scheduledStartTimeObj,
        endTime: scheduledEndTimeObj,
        beauticianId: targetBeauticianId,
        excludeBookingId: booking._id,
      });

      if (overlapping.length > 0) {
        throw new AppError(
          'Beautician is already booked during this time interval.',
          HttpStatus.CONFLICT,
          'BEAUTICIAN_TIME_CONFLICT',
        );
      }
    }

    const updatedBooking = await this.bookingRepo.rescheduleBooking(id, {
      scheduledDate: date,
      scheduledStartTime: scheduledStartTimeObj,
      scheduledEndTime: scheduledEndTimeObj,
      beauticianId: targetBeauticianId,
      beauticianName,
      actor,
      reason,
    });

    if (this.eventPublisher) {
      this.eventPublisher
        .publish('booking.rescheduled', EVENT_TYPES.BOOKING_RESCHEDULED || 'booking.rescheduled', {
          bookingId: id,
          bookingNumber: updatedBooking.bookingNumber,
          accountOwnerId: updatedBooking.accountOwnerId,
          newDate: date,
          newStartTime: startTime,
          beauticianId: targetBeauticianId,
        })
        .catch(() => {});
    }

    return this.transformAppointment(updatedBooking);
  }

  /**
   * Complete Booking by Admin
   */
  async completeBooking(id, data = {}, actor = 'ADMIN') {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) {
      throw new AppError('Booking not found', HttpStatus.NOT_FOUND, ErrorCodes.BOOKING_NOT_FOUND);
    }

    if (booking.status === BOOKING_STATUS.CANCELLED) {
      throw new AppError('Cannot complete a cancelled booking', HttpStatus.BAD_REQUEST, ErrorCodes.BOOKING_ALREADY_CANCELLED);
    }

    const updated = await this.bookingRepo.completeBooking(id, {
      actor,
      notes: data.notes || 'Marked completed by admin',
    });

    if (this.eventPublisher) {
      this.eventPublisher
        .publish('booking.completed', EVENT_TYPES.BOOKING_COMPLETED || 'booking.completed', {
          bookingId: id,
          bookingNumber: updated.bookingNumber,
          accountOwnerId: updated.accountOwnerId,
        })
        .catch(() => {});
    }

    return this.transformAppointment(updated);
  }
}
