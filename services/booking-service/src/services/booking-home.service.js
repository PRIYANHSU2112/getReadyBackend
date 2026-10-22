import mongoose from 'mongoose';
import { BookingModel, BOOKING_STATUS } from '../models/booking.models.js';
import { bookingCache } from '../cache/booking.cache.js';
import { logger } from '@getready/logger';

export class BookingHomeService {
  /**
   * User Home Summary: Strictly user-isolated, < 50ms with Redis, < 200ms DB
   */
  async getUserHomeSummary(userId) {
    if (!userId) {
      return {
        unreadNotificationsCount: 0,
        activeBooking: null,
        recentBookings: [],
      };
    }

    const uid = String(userId);
    const cacheKey = `home:user:${uid}:summary`;

    // 1. Try Redis cache
    const cached = await bookingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Query DB concurrently
    const activeStatuses = [
      BOOKING_STATUS.CONFIRMED,
      BOOKING_STATUS.ASSIGNMENT_PENDING,
      BOOKING_STATUS.PARTIALLY_ASSIGNED,
      BOOKING_STATUS.ASSIGNED,
      BOOKING_STATUS.ARRIVING,
      BOOKING_STATUS.STARTED,
      BOOKING_STATUS.IN_PROGRESS,
      BOOKING_STATUS.SERVICES_COMPLETED,
    ];

    // Notification model lookup (if notifications collection exists in same db)
    let unreadCount = 0;
    try {
      const notificationColl = mongoose.connection.collection('notifications');
      unreadCount = await notificationColl.countDocuments({
        userId: new mongoose.Types.ObjectId(uid),
        read: false,
        deletedAt: null,
      });
    } catch {
      unreadCount = 0;
    }

    const [activeBookingDoc, recentBookingDocs] = await Promise.all([
      BookingModel.findOne({
        userId: uid,
        status: { $in: activeStatuses },
      })
        .sort({ scheduledDate: 1, scheduledStartTime: 1 })
        .lean(),

      BookingModel.find({
        userId: uid,
        status: BOOKING_STATUS.COMPLETED,
      })
        .sort({ createdAt: -1 })
        .limit(3)
        .lean(),
    ]);

    // Format Active Booking
    let activeBooking = null;
    if (activeBookingDoc) {
      const primaryItem = activeBookingDoc.items?.[0];
      const assignedBeautician =
        activeBookingDoc.beauticianAssignments?.[0]?.beauticianName ||
        primaryItem?.assignedBeauticianName ||
        null;

      activeBooking = {
        bookingId: activeBookingDoc._id.toString(),
        bookingNumber: activeBookingDoc.bookingNumber,
        status: activeBookingDoc.status,
        serviceTitle: primaryItem?.serviceName || 'Beauty Service',
        additionalServicesCount: Math.max(0, (activeBookingDoc.items?.length || 1) - 1),
        scheduledDate: activeBookingDoc.scheduledDate,
        scheduledStartTime: activeBookingDoc.scheduledStartTime,
        scheduledEndTime: activeBookingDoc.scheduledEndTime,
        assignedBeauticianName: assignedBeautician,
        totalAmount: activeBookingDoc.pricing?.payableAmount || 0,
        address: activeBookingDoc.addressSnapshot?.addressLine1 || activeBookingDoc.addressSnapshot?.city || null,
      };
    }

    // Format Recent Bookings
    const recentBookings = (recentBookingDocs || []).map((doc) => ({
      bookingId: doc._id.toString(),
      bookingNumber: doc.bookingNumber,
      status: doc.status,
      serviceTitle: doc.items?.[0]?.serviceName || 'Salon Service',
      scheduledDate: doc.scheduledDate,
      totalAmount: doc.pricing?.payableAmount || 0,
      completedAt: doc.updatedAt,
      items: (doc.items || []).map((i) => ({
        serviceId: i.serviceId,
        serviceName: i.serviceName,
        price: i.unitPrice,
      })),
    }));

    const result = {
      unreadNotificationsCount: unreadCount,
      activeBooking,
      recentBookings,
      meta: {
        userId: uid,
        cachedAt: new Date().toISOString(),
      },
    };

    // 3. Cache for 20 seconds (user personalized, fast changing)
    await bookingCache.set(cacheKey, result, 20);
    return result;
  }

  /**
   * Beautician Home: Upcoming Bookings (Limit 2 default)
   */
  async getBeauticianUpcomingBookings(beauticianId, { limit = 2 } = {}) {
    if (!beauticianId) {
      return { bookings: [], total: 0 };
    }

    const bid = String(beauticianId);
    const parsedLimit = Math.min(10, Math.max(1, Number(limit) || 2));
    const cacheKey = `home:beautician:${bid}:upcoming:${parsedLimit}`;

    // 1. Try Redis cache
    const cached = await bookingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const upcomingStatuses = [
      BOOKING_STATUS.CONFIRMED,
      BOOKING_STATUS.ASSIGNED,
      BOOKING_STATUS.ARRIVING,
      BOOKING_STATUS.STARTED,
      BOOKING_STATUS.IN_PROGRESS,
    ];

    const query = {
      $and: [
        {
          $or: [
            { 'beauticianAssignments.beauticianId': bid },
            { 'items.assignedBeauticianId': bid },
          ],
        },
        { status: { $in: upcomingStatuses } },
        { scheduledDate: { $gte: todayStr } },
      ],
    };

    const [docs, total] = await Promise.all([
      BookingModel.find(query)
        .sort({ scheduledDate: 1, scheduledStartTime: 1 })
        .limit(parsedLimit)
        .lean(),
      BookingModel.countDocuments(query),
    ]);

    const formatted = (docs || []).map((b) => {
      const primaryItem = b.items?.[0];
      const customer = b.participants?.[0] || {
        name: b.addressSnapshot?.recipientName || 'Client',
        mobileNumber: b.addressSnapshot?.phoneNumber || null,
      };

      const customerAddress = [
        b.addressSnapshot?.addressLine1,
        b.addressSnapshot?.locality,
        b.addressSnapshot?.city,
      ]
        .filter(Boolean)
        .join(', ');

      return {
        bookingId: b._id.toString(),
        bookingNumber: b.bookingNumber,
        serviceName: primaryItem?.serviceName || 'Service',
        durationMinutes: primaryItem?.durationMinutes || 45,
        price: primaryItem?.unitPrice || b.pricing?.payableAmount || 0,
        status: b.status,
        scheduledDate: b.scheduledDate,
        timeSlot: b.scheduledStartTime
          ? new Date(b.scheduledStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '10:00 AM',
        clientName: customer.name || 'Client',
        clientPhone: customer.mobileNumber || null,
        clientAddress: customerAddress || 'Client Location',
        totalItemsCount: b.items?.length || 1,
      };
    });

    const result = {
      bookings: formatted,
      total,
      meta: {
        limit: parsedLimit,
        beauticianId: bid,
      },
    };

    // 3. Cache for 30 seconds
    await bookingCache.set(cacheKey, result, 30);
    return result;
  }

  async invalidateUserSummary(userId) {
    if (userId) {
      await bookingCache.del(`home:user:${String(userId)}:summary`);
    }
  }

  async invalidateBeauticianUpcoming(beauticianId) {
    if (beauticianId) {
      await bookingCache.delByPattern(`home:beautician:${String(beauticianId)}:upcoming:*`);
    }
  }
}

export const bookingHomeService = new BookingHomeService();
export default bookingHomeService;
