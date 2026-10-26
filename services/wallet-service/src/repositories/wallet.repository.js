import mongoose from 'mongoose';
import { WalletModel, WalletTransactionModel } from '../models/wallet.model.js';
import { PayoutRequestModel } from '../models/payout-request.model.js';
import { PayoutConfigModel } from '../models/payout-config.model.js';
import { LoyaltyRuleModel } from '../models/loyalty-rule.model.js';
import { WalletType } from '../models/wallet.enum.js';

export class WalletRepository {
  async getOrCreateForUser(userId, walletType = WalletType.CUSTOMER, session = null) {
    const uidStr = String(userId);
    let wallet = await WalletModel.findOne({ userId: uidStr, walletType }).session(session);
    if (!wallet) {
      wallet = new WalletModel({
        userId: uidStr,
        walletType,
        balance: 0,
        pendingWithdrawalBalance: 0,
        totalEarnedLifetime: 0,
        totalWithdrawnLifetime: 0,
        currentMonthEarnings: 0,
        points: 0,
        cashbackBalance: 0,
      });
      await wallet.save({ session });
    }
    return wallet;
  }

  async findByUserId(userId, walletType = WalletType.CUSTOMER, session = null) {
    const uidStr = String(userId);
    return WalletModel.findOne({ userId: uidStr, walletType }).session(session);
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
    const stats = await WalletModel.aggregate([
      {
        $group: {
          _id: null,
          totalWallets: { $sum: 1 },
          totalMoneyInWallets: { $sum: '$balance' },
          totalUserWallets: {
            $sum: { $cond: [{ $eq: ['$walletType', 'CUSTOMER'] }, 1, 0] },
          },
          totalBeauticianWallets: {
            $sum: { $cond: [{ $eq: ['$walletType', 'BEAUTICIAN'] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalWallets: 1,
          totalMoneyInWallets: 1,
          totalUserWallets: 1,
          totalBeauticianWallets: 1,
        },
      },
    ]);

    return (
      stats[0] || {
        totalWallets: 0,
        totalMoneyInWallets: 0,
        totalUserWallets: 0,
        totalBeauticianWallets: 0,
      }
    );
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
    const doc = new WalletTransactionModel({
      ...data,
      userId: String(data.userId),
    });
    return doc.save({ session });
  }

  async findById(id) {
    if (mongoose.Types.ObjectId.isValid(id)) {
      return WalletTransactionModel.findById(id).lean();
    }
    return WalletTransactionModel.findOne({ referenceId: id }).lean();
  }

  async findByRazorpayOrderId(orderId) {
    return WalletTransactionModel.findOne({ razorpayOrderId: orderId });
  }

  async findByRazorpayPaymentId(paymentId) {
    return WalletTransactionModel.findOne({ razorpayPaymentId: paymentId });
  }

  async listByUser(userId, { limit = 20, skip = 0, type = null, category = null } = {}) {
    const query = { userId: String(userId) };
    if (type) query.type = type.toUpperCase();
    if (category) query.category = category.toUpperCase();

    const [transactions, total] = await Promise.all([
      WalletTransactionModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WalletTransactionModel.countDocuments(query),
    ]);
    return { transactions, total };
  }

  async listRecent(userId, limit = 5) {
    return WalletTransactionModel.find({ userId: String(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}

export class PayoutRequestRepository {
  async create(data, session = null) {
    const doc = new PayoutRequestModel({
      ...data,
      beauticianId: String(data.beauticianId),
    });
    return doc.save({ session });
  }

  async findById(id, session = null) {
    if (mongoose.Types.ObjectId.isValid(id)) {
      return PayoutRequestModel.findById(id).session(session);
    }
    return PayoutRequestModel.findOne({ payoutNumber: id }).session(session);
  }

  async findByPayoutNumber(payoutNumber) {
    return PayoutRequestModel.findOne({ payoutNumber });
  }

  async listByBeautician(beauticianId, { limit = 20, skip = 0, status = null } = {}) {
    const query = { beauticianId: String(beauticianId) };
    if (status) query.status = status;
    const [payouts, total] = await Promise.all([
      PayoutRequestModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PayoutRequestModel.countDocuments(query),
    ]);
    return { payouts, total };
  }

  async listAll({ limit = 25, skip = 0, status = null } = {}) {
    const query = {};
    if (status) query.status = status;
    const [payouts, total] = await Promise.all([
      PayoutRequestModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PayoutRequestModel.countDocuments(query),
    ]);
    return { payouts, total };
  }

  async getStats() {
    const stats = await PayoutRequestModel.aggregate([
      {
        $group: {
          _id: null,
          pendingCount: {
            $sum: {
              $cond: [
                { $in: ['$status', ['REQUESTED', 'PENDING', 'PROCESSING']] },
                1,
                0,
              ],
            },
          },
          pendingAmount: {
            $sum: {
              $cond: [
                { $in: ['$status', ['REQUESTED', 'PENDING', 'PROCESSING']] },
                '$amount',
                0,
              ],
            },
          },
          totalDisbursed: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'COMPLETED'] },
                '$amount',
                0,
              ],
            },
          },
          totalCommissionEarned: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'COMPLETED'] },
                { $ifNull: ['$commissionDeducted', 0] },
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          pendingCount: 1,
          pendingAmount: 1,
          totalDisbursed: 1,
          totalCommissionEarned: 1,
        },
      },
    ]);

    return (
      stats[0] || {
        pendingCount: 0,
        pendingAmount: 0,
        totalDisbursed: 0,
        totalCommissionEarned: 0,
      }
    );
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

export class PayoutConfigRepository {
  async getConfig() {
    let configDoc = await PayoutConfigModel.findOne().lean();
    if (!configDoc) {
      configDoc = await PayoutConfigModel.create({
        minWithdrawalAmount: 100,
        maxWithdrawalAmount: 50000,
        defaultCommissionPercentage: 10,
        dailyWithdrawalLimit: 25000,
        allowUpiPayout: true,
        allowBankPayout: true,
      });
      configDoc = configDoc.toObject();
    }
    return configDoc;
  }

  async updateConfig(data, adminUserId = null) {
    let configDoc = await PayoutConfigModel.findOne();
    if (!configDoc) {
      configDoc = new PayoutConfigModel({ ...data, updatedBy: adminUserId });
    } else {
      Object.assign(configDoc, data, { updatedBy: adminUserId });
    }
    await configDoc.save();
    return configDoc.toObject();
  }
}

