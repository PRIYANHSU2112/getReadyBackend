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
}
