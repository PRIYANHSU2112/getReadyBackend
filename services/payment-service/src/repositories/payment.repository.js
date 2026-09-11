import mongoose from 'mongoose';
import { PaymentModel } from '../models/payment.model.js';

export class PaymentRepository {
  async create(data, session = null) {
    const payment = new PaymentModel(data);
    return payment.save({ session });
  }

  async findById(id) {
    if (mongoose.Types.ObjectId.isValid(id)) {
      return PaymentModel.findById(id);
    }
    return PaymentModel.findOne({
      $or: [{ paymentNumber: id }, { razorpayOrderId: id }, { razorpayPaymentId: id }],
    });
  }

  async findByRazorpayOrderId(orderId) {
    return PaymentModel.findOne({ razorpayOrderId: orderId });
  }

  async findByBookingId(bookingId) {
    if (mongoose.Types.ObjectId.isValid(bookingId)) {
      return PaymentModel.find({ bookingId: new mongoose.Types.ObjectId(bookingId) });
    }
    return [];
  }

  async findWithPagination({ filter = {}, page = 1, limit = 25, sortBy = 'createdAt', sortOrder = 'desc' }) {
    const skip = (Math.max(1, page) - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [items, total] = await Promise.all([
      PaymentModel.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true })
        .exec(),
      PaymentModel.countDocuments(filter),
    ]);

    const formattedItems = items.map((p) => {
      const id = p.paymentNumber || (p._id ? `GRPAY${p._id.toString().slice(-6).toUpperCase()}` : 'GRPAY000001');
      return {
        ...p,
        id,
        name: p.paymentNumber || p.razorpayOrderId || `Payment #${id}`,
        method: p.paymentMethod || 'RAZORPAY',
        status: p.status || 'PENDING',
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

  async getKpis() {
    const [totalStats, statusCounts] = await Promise.all([
      PaymentModel.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, '$amount', 0] } },
            totalCount: { $sum: 1 },
          },
        },
      ]),
      PaymentModel.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            amount: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    const active = statusCounts.find((s) => s._id === 'SUCCESS')?.count || 0;
    const pending = statusCounts.find((s) => s._id === 'PENDING')?.count || 0;
    const failed = statusCounts.find((s) => s._id === 'FAILED')?.count || 0;
    const total = totalStats[0]?.totalCount || 0;
    const revenue = totalStats[0]?.totalRevenue || 0;

    return {
      total,
      active,
      pending,
      failed,
      revenue,
    };
  }

  async update(id, data) {
    if (mongoose.Types.ObjectId.isValid(id)) {
      return PaymentModel.findByIdAndUpdate(id, data, { new: true });
    }
    return PaymentModel.findOneAndUpdate(
      { $or: [{ paymentNumber: id }, { razorpayOrderId: id }] },
      data,
      { new: true },
    );
  }

  async save(payment, session = null) {
    return payment.save({ session });
  }
}
