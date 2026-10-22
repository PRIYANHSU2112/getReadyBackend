import mongoose from 'mongoose';
import { TicketModel } from '../models/ticket.model.js';

export class TicketRepository {
  async create(data) {
    const ticket = new TicketModel(data);
    return ticket.save();
  }

  async findById(id) {
    if (mongoose.Types.ObjectId.isValid(id)) {
      return TicketModel.findById(id);
    }
    return TicketModel.findOne({ ticketNumber: id });
  }

  async findWithPagination({ filter = {}, page = 1, limit = 25, sortBy = 'createdAt', sortOrder = 'desc' }) {
    const skip = (Math.max(1, page) - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [items, total] = await Promise.all([
      TicketModel.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true })
        .exec(),
      TicketModel.countDocuments(filter),
    ]);

    const formattedItems = items.map((t) => {
      const id = t.ticketNumber || (t._id ? `TCK-${t._id.toString().slice(-6).toUpperCase()}` : 'TCK-000001');
      return {
        ...t,
        id,
        name: t.subject || 'Support Ticket',
        priority: t.priority || 'MEDIUM',
        status: t.status || 'OPEN',
      };
    });

    return {
      items: formattedItems,
      total,
      page: Math.max(1, page),
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async update(id, data) {
    if (mongoose.Types.ObjectId.isValid(id)) {
      return TicketModel.findByIdAndUpdate(id, data, { new: true });
    }
    return TicketModel.findOneAndUpdate({ ticketNumber: id }, data, { new: true });
  }

  async delete(id) {
    if (mongoose.Types.ObjectId.isValid(id)) {
      return TicketModel.findByIdAndDelete(id);
    }
    return TicketModel.findOneAndDelete({ ticketNumber: id });
  }

  async getAdminStats({ startDate, endDate, priority, category } = {}) {
    const match = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    if (priority && priority !== 'ALL' && priority !== 'all') {
      match.priority = priority.toUpperCase();
    }
    if (category && category !== 'ALL' && category !== 'all') {
      match.category = category;
    }

    const [res] = await TicketModel.aggregate([
      { $match: match },
      {
        $facet: {
          totals: [{ $count: 'count' }],
          open: [{ $match: { status: 'OPEN' } }, { $count: 'count' }],
          inProgress: [{ $match: { status: 'IN_PROGRESS' } }, { $count: 'count' }],
          resolved: [{ $match: { status: { $in: ['RESOLVED', 'CLOSED'] } } }, { $count: 'count' }],
          urgent: [{ $match: { priority: 'URGENT', status: { $nin: ['RESOLVED', 'CLOSED'] } } }, { $count: 'count' }],
        },
      },
    ]);

    return {
      total: res?.totals?.[0]?.count || 0,
      open: res?.open?.[0]?.count || 0,
      inProgress: res?.inProgress?.[0]?.count || 0,
      resolved: res?.resolved?.[0]?.count || 0,
      urgent: res?.urgent?.[0]?.count || 0,
    };
  }
}
