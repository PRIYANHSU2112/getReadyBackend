import mongoose from 'mongoose';
import { ReviewModel } from '../models/review.model.js';

export class ReviewRepository {
  async create(data) {
    const review = new ReviewModel(data);
    return review.save();
  }

  async findById(id) {
    return ReviewModel.findById(id);
  }

  async findWithPagination({ filter = {}, page = 1, limit = 25, sortBy = 'createdAt', sortOrder = 'desc' }) {
    const skip = (Math.max(1, page) - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [items, total] = await Promise.all([
      ReviewModel.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true })
        .exec(),
      ReviewModel.countDocuments(filter),
    ]);

    const formattedItems = items.map((r) => ({
      ...r,
      id: r._id?.toString(),
      name: r.title || r.comment?.slice(0, 30) || `${r.rating}★ Review`,
      service: r.serviceName || 'Service',
      status: r.status || 'APPROVED',
      rating: r.rating || 5,
    }));

    return {
      items: formattedItems,
      total,
      page: Math.max(1, page),
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async update(id, data) {
    return ReviewModel.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id) {
    return ReviewModel.findByIdAndDelete(id);
  }

  async getAdminStats({ startDate, endDate, serviceId, beauticianId } = {}) {
    const match = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    if (serviceId) {
      match.serviceId = mongoose.Types.ObjectId.isValid(serviceId)
        ? new mongoose.Types.ObjectId(serviceId)
        : serviceId;
    }
    if (beauticianId) {
      match.beauticianId = mongoose.Types.ObjectId.isValid(beauticianId)
        ? new mongoose.Types.ObjectId(beauticianId)
        : beauticianId;
    }

    const [res] = await ReviewModel.aggregate([
      { $match: match },
      {
        $facet: {
          totals: [{ $count: 'count' }],
          avgRating: [{ $group: { _id: null, avg: { $avg: '$rating' } } }],
          fiveStar: [{ $match: { rating: 5 } }, { $count: 'count' }],
          pending: [{ $match: { status: 'PENDING' } }, { $count: 'count' }],
          approved: [{ $match: { status: 'APPROVED' } }, { $count: 'count' }],
          rejected: [{ $match: { status: 'REJECTED' } }, { $count: 'count' }],
        },
      },
    ]);

    const total = res?.totals?.[0]?.count || 0;
    const rawAvg = res?.avgRating?.[0]?.avg;
    const avgRating = total > 0 && rawAvg != null ? Math.round(rawAvg * 10) / 10 : 5.0;

    return {
      total,
      avgRating,
      fiveStarCount: res?.fiveStar?.[0]?.count || 0,
      pendingModeration: res?.pending?.[0]?.count || 0,
      approvedCount: res?.approved?.[0]?.count || 0,
      rejectedCount: res?.rejected?.[0]?.count || 0,
    };
  }
}
