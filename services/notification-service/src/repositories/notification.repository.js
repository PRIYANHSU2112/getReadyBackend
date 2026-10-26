import mongoose from 'mongoose';
import { NotificationModel } from '../models/notification.model.js';

export class NotificationRepository {
  async create(data) {
    const doc = new NotificationModel(data);
    return doc.save();
  }

  async findByUserId(userId, { limit = 20, skip = 0 } = {}) {
    const query = {
      userId: new mongoose.Types.ObjectId(userId),
      deletedAt: null,
    };
    const [notifications, total] = await Promise.all([
      NotificationModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      NotificationModel.countDocuments(query),
    ]);
    return { notifications, total };
  }

  async markAsRead(id, userId) {
    return NotificationModel.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), userId: new mongoose.Types.ObjectId(userId) },
      { read: true },
      { new: true },
    );
  }

  async delete(id, userId) {
    return NotificationModel.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), userId: new mongoose.Types.ObjectId(userId) },
      { deletedAt: new Date() },
      { new: true },
    );
  }

  async findAdminWithPagination({ limit = 20, page = 1, channel, read, search } = {}) {
    const skip = (Math.max(1, page) - 1) * limit;
    const query = { deletedAt: null };

    if (channel && channel !== 'ALL' && channel !== 'all') {
      query.channel = channel.toUpperCase();
    }
    if (read !== undefined && read !== null && read !== 'ALL' && read !== 'all') {
      query.read = read === 'true' || read === true;
    }
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ title: regex }, { body: regex }];
    }

    const [items, total] = await Promise.all([
      NotificationModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      NotificationModel.countDocuments(query),
    ]);

    const formattedItems = items.map((n) => ({
      ...n,
      id: n._id?.toString(),
      status: 'SENT',
      recipientCount: n.recipientCount || 1,
      deliveredCount: n.deliveredCount || 1,
    }));

    return {
      items: formattedItems,
      total,
      page: Math.max(1, page),
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getAdminStats() {
    const [stats] = await NotificationModel.aggregate([
      { $match: { deletedAt: null } },
      {
        $facet: {
          total: [{ $count: 'count' }],
          inApp: [{ $match: { channel: 'IN_APP' } }, { $count: 'count' }],
          push: [{ $match: { channel: 'PUSH' } }, { $count: 'count' }],
          unread: [{ $match: { read: false } }, { $count: 'count' }],
          delivered: [{ $group: { _id: null, sum: { $sum: '$deliveredCount' } } }],
        },
      },
    ]);

    return {
      totalSent: stats?.total?.[0]?.count || 0,
      inAppCount: stats?.inApp?.[0]?.count || 0,
      pushCount: stats?.push?.[0]?.count || 0,
      unreadCount: stats?.unread?.[0]?.count || 0,
      totalDelivered: stats?.delivered?.[0]?.sum || stats?.total?.[0]?.count || 0,
    };
  }
}

