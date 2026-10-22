import mongoose from 'mongoose';
import { BeauticianProfileModel } from '../models/beautician.models.js';
import { beauticianCache } from '../cache/beautician.cache.js';
import { logger } from '@getready/logger';

export class BeauticianHomeService {
  /**
   * Ultra-fast Beautician Home Summary: < 50ms with Redis, < 200ms DB
   */
  async getSummary(beauticianId) {
    if (!beauticianId) {
      return {
        todayEarnings: 0,
        monthlyEarnings: 0,
        todayBookingsCount: 0,
        completedBookingsToday: 0,
        pendingBookingsToday: 0,
        rating: 5.0,
        ratingCount: 0,
        dutyStatus: 'offline',
        attendanceStatus: 'OFFLINE',
      };
    }

    const bid = String(beauticianId);
    const cacheKey = `home:beautician:${bid}:summary`;

    // 1. Try Redis cache
    const cached = await beauticianCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Query Profile and Collections concurrently
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayStr = startOfToday.toISOString().split('T')[0];

    const profilePromise = BeauticianProfileModel.findOne({
      $or: [{ userId: bid }, { _id: mongoose.isValidObjectId(bid) ? new mongoose.Types.ObjectId(bid) : null }],
    }).lean();

    // Query bookings collection if connected
    let todayBookingsCount = 0;
    let completedBookingsToday = 0;
    let pendingBookingsToday = 0;
    let todayEarnings = 0;
    let monthlyEarnings = 0;

    try {
      const db = mongoose.connection.db;
      if (db) {
        const bookingsColl = db.collection('bookings');
        const [todayDocs, completedDocs] = await Promise.all([
          bookingsColl
            .find({
              $or: [{ 'beauticianAssignments.beauticianId': bid }, { 'items.assignedBeauticianId': bid }],
              scheduledDate: todayStr,
            })
            .toArray(),

          bookingsColl
            .find({
              $or: [{ 'beauticianAssignments.beauticianId': bid }, { 'items.assignedBeauticianId': bid }],
              scheduledDate: todayStr,
              status: 'COMPLETED',
            })
            .toArray(),
        ]);

        todayBookingsCount = todayDocs.length;
        completedBookingsToday = completedDocs.length;
        pendingBookingsToday = Math.max(0, todayBookingsCount - completedBookingsToday);

        // Wallet transactions for today earnings
        const walletTxColl = db.collection('wallet_transactions');
        const todayTxDocs = await walletTxColl
          .find({
            userId: bid,
            category: 'SERVICE_EARNING',
            createdAt: { $gte: startOfToday },
          })
          .toArray();

        todayEarnings = todayTxDocs.reduce((acc, tx) => acc + (tx.amount || 0), 0);

        // Current wallet balance / monthly earnings
        const walletsColl = db.collection('wallets');
        const walletDoc = await walletsColl.findOne({ userId: bid });
        if (walletDoc) {
          monthlyEarnings = walletDoc.currentMonthEarnings || 0;
        }
      }
    } catch (err) {
      logger.warn({ err: err.message, bid }, 'Notice: Cross-collection aggregation fallback in BeauticianHomeService');
    }

    const profile = await profilePromise;

    const rating = profile?.ratingAvg || 4.8;
    const ratingCount = profile?.ratingCount || 0;
    const isOnline = profile?.operationalStatus === 'ONLINE';
    const finalMonthlyEarnings = monthlyEarnings || profile?.monthlyEarnings || 0;

    const summary = {
      todayEarnings,
      monthlyEarnings: finalMonthlyEarnings,
      todayBookingsCount,
      completedBookingsToday,
      pendingBookingsToday,
      rating,
      ratingCount,
      dutyStatus: isOnline ? 'online' : 'offline',
      attendanceStatus: isOnline ? 'PRESENT' : 'OFFLINE',
      meta: {
        beauticianId: bid,
        cachedAt: new Date().toISOString(),
      },
    };

    // 3. Cache in Redis for 30 seconds
    await beauticianCache.set(cacheKey, summary, 30);
    return summary;
  }

  /**
   * Beautician Active Services (Limit 4 default)
   */
  async getServices(beauticianId, { limit = 4 } = {}) {
    const bid = String(beauticianId || '');
    const parsedLimit = Math.min(20, Math.max(1, Number(limit) || 4));
    const cacheKey = `home:beautician:${bid}:services:${parsedLimit}`;

    // 1. Try Redis cache
    const cached = await beauticianCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Fetch Beautician Profile for eligibleServiceIds
    let eligibleIds = [];
    if (bid) {
      const profile = await BeauticianProfileModel.findOne({
        $or: [{ userId: bid }, { _id: mongoose.isValidObjectId(bid) ? new mongoose.Types.ObjectId(bid) : null }],
      })
        .select('eligibleServiceIds')
        .lean();

      eligibleIds = profile?.eligibleServiceIds || [];
    }

    // 3. Query services collection
    let services = [];
    try {
      const db = mongoose.connection.db;
      if (db) {
        const servicesColl = db.collection('services');
        const query = {
          isActive: true,
          status: 'APPROVED',
          deletedAt: null,
        };

        if (eligibleIds.length > 0) {
          const objectIds = eligibleIds.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
          query.$or = [{ _id: { $in: objectIds } }, { createdByBeauticianId: bid }];
        }

        const rawServices = await servicesColl
          .find(query)
          .sort({ displayOrder: 1, ratingAvg: -1 })
          .limit(parsedLimit)
          .toArray();

        services = rawServices.map((s) => ({
          id: s._id.toString(),
          title: s.name,
          slug: s.slug,
          price: s.discountedPrice || s.price,
          originalPrice: s.price,
          discount:
            s.discountedPrice && s.price > s.discountedPrice
              ? `${Math.round(((s.price - s.discountedPrice) / s.price) * 100)}% OFF`
              : null,
          duration: `${s.durationMinMinutes || 30}-${s.durationMaxMinutes || 45} mins`,
          rating: s.ratingAvg || 4.8,
          ratingCount: s.ratingCount || 0,
          thumbnail: s.thumbnail?.url || s.images?.[0]?.url || null,
          categoryName: s.categoryName || null,
        }));
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to fetch beautician services from database');
    }

    const result = {
      services,
      total: services.length,
      meta: {
        limit: parsedLimit,
        beauticianId: bid,
      },
    };

    // 4. Cache for 300 seconds (5 minutes)
    await beauticianCache.set(cacheKey, result, 300);
    return result;
  }

  /**
   * Duty / Availability Toggle Mutation
   */
  async updateDutyStatus(beauticianId, { dutyStatus, isAvailable }) {
    const bid = String(beauticianId);
    let newStatus = 'OFFLINE';
    let availableFlag = false;

    if (dutyStatus) {
      const clean = String(dutyStatus).toUpperCase();
      newStatus = clean === 'ONLINE' ? 'ONLINE' : 'OFFLINE';
      availableFlag = newStatus === 'ONLINE';
    } else if (typeof isAvailable === 'boolean') {
      availableFlag = isAvailable;
      newStatus = isAvailable ? 'ONLINE' : 'OFFLINE';
    }

    const updated = await BeauticianProfileModel.findOneAndUpdate(
      { $or: [{ userId: bid }, { _id: mongoose.isValidObjectId(bid) ? new mongoose.Types.ObjectId(bid) : null }] },
      {
        operationalStatus: newStatus,
        isAvailable: availableFlag,
      },
      { new: true, runValidators: true },
    );

    // Invalidate Redis caches immediately
    await beauticianCache.del(`home:beautician:${bid}:summary`);
    await beauticianCache.delByPattern(`home:beautician:${bid}:*`);

    logger.info({ beauticianId: bid, operationalStatus: newStatus }, 'Beautician duty status updated');

    return {
      dutyStatus: newStatus.toLowerCase(),
      isAvailable: availableFlag,
      operationalStatus: newStatus,
      updatedAt: updated?.updatedAt || new Date(),
    };
  }
}

export const beauticianHomeService = new BeauticianHomeService();
export default beauticianHomeService;
