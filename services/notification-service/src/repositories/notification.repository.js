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
}
