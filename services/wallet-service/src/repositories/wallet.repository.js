import mongoose from 'mongoose';
import { WalletModel, WalletTransactionModel } from '../models/wallet.model.js';
import { LoyaltyRuleModel } from '../models/loyalty-rule.model.js';

export class WalletRepository {
  async getOrCreateForUser(userId, session = null) {
    const uid = new mongoose.Types.ObjectId(userId);
    let wallet = await WalletModel.findOne({ userId: uid }).session(session);
    if (!wallet) {
      wallet = new WalletModel({ userId: uid, balance: 0, points: 0, cashbackBalance: 0 });
      await wallet.save({ session });
    }
    return wallet;
  }

  async findByUserId(userId, session = null) {
    if (!mongoose.Types.ObjectId.isValid(userId)) return null;
    return WalletModel.findOne({ userId: new mongoose.Types.ObjectId(userId) }).session(session);
  }

  async findById(id) {
    if (mongoose.Types.ObjectId.isValid(id)) {
      return WalletModel.findById(id);
    }
    return WalletModel.findOne({ walletNumber: id });
  }

  async findWithPagination({ filter = {}, page = 1, limit = 25, sortBy = 'createdAt', sortOrder = 'desc' }) {
    const skip = (Math.max(1, page) - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [items, total] = await Promise.all([
      WalletModel.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true })
        .exec(),
      WalletModel.countDocuments(filter),
    ]);

    const formattedItems = items.map((w) => {
      const id = w.walletNumber || (w._id ? `GRWAL${w._id.toString().slice(-6).toUpperCase()}` : 'GRWAL000001');
      return {
        ...w,
        id,
        name: w.walletNumber ? `Wallet (${w.walletNumber})` : `Wallet #${id}`,
        status: w.status || (w.isActive ? 'ACTIVE' : 'INACTIVE'),
        balance: w.balance || 0,
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
    const [stats, statusCounts] = await Promise.all([
      WalletModel.aggregate([
        {
          $group: {
            _id: null,
            totalBalance: { $sum: '$balance' },
            totalPoints: { $sum: '$points' },
            totalCount: { $sum: 1 },
          },
        },
      ]),
      WalletModel.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const active = statusCounts.find((s) => s._id === 'ACTIVE')?.count || 0;
    const total = stats[0]?.totalCount || 0;
    const totalBalance = stats[0]?.totalBalance || 0;

    return {
      total,
      active,
      pending: total - active,
      totalBalance,
    };
  }

  async create(data) {
    const wallet = new WalletModel(data);
    return wallet.save();
  }

  async update(id, data) {
    if (mongoose.Types.ObjectId.isValid(id)) {
      return WalletModel.findByIdAndUpdate(id, data, { new: true });
    }
    return WalletModel.findOneAndUpdate({ walletNumber: id }, data, { new: true });
  }

  async save(wallet, session = null) {
    return wallet.save({ session });
  }
}

export class WalletTransactionRepository {
  async create(data, session = null) {
    const doc = new WalletTransactionModel(data);
    return doc.save({ session });
  }

  async findByRazorpayOrderId(orderId) {
    return WalletTransactionModel.findOne({ razorpayOrderId: orderId });
  }

  async findByRazorpayPaymentId(paymentId) {
    return WalletTransactionModel.findOne({ razorpayPaymentId: paymentId });
  }

  async listByUser(userId, { limit = 20, skip = 0, type = null } = {}) {
    const query = { userId: new mongoose.Types.ObjectId(userId) };
    if (type) query.type = type;
    const [transactions, total] = await Promise.all([
      WalletTransactionModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WalletTransactionModel.countDocuments(query),
    ]);
    return { transactions, total };
  }
}

export class LoyaltyRuleRepository {
  async findRule() {
    let rule = await LoyaltyRuleModel.findOne();
    if (!rule) {
      rule = await LoyaltyRuleModel.create({
        earnRatio: 0.1,
        redeemRatio: 0.1,
        minPointsToRedeem: 100,
        maxRedeemPercentage: 50,
      });
    }
    return rule;
  }

  async updateRule(data, adminUserId = null) {
    let rule = await LoyaltyRuleModel.findOne();
    if (!rule) {
      rule = new LoyaltyRuleModel({ ...data, updatedBy: adminUserId });
    } else {
      Object.assign(rule, data, { updatedBy: adminUserId });
    }
    return rule.save();
  }
}
