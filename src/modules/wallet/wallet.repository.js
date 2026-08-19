import mongoose from 'mongoose';
import { BaseRepository } from '../../common/base/BaseRepository.js';
import { WalletModel, WalletTransactionModel } from './wallet.model.js';
import { AppError } from '../../common/errors/AppError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';

function toObjectId(id) {
  if (!id) return id;
  if (id instanceof mongoose.Types.ObjectId) return id;
  return new mongoose.Types.ObjectId(id);
}

export class WalletRepository extends BaseRepository {
  constructor(walletModel = WalletModel) {
    super(walletModel);
  }

  async findDocumentByUserId(userId, session = null) {
    const query = this.model.findOne({ userId: toObjectId(userId) });
    if (session) query.session(session);
    return query.exec();
  }

  async getOrCreateForUser(userId, session = null) {
    let wallet = await this.findDocumentByUserId(userId, session);
    if (!wallet) {
      try {
        const docs = await this.model.create(
          [
            {
              userId: toObjectId(userId),
              balance: 0,
              points: 0,
              cashbackBalance: 0,
              currency: 'INR',
              isActive: true,
            },
          ],
          { session },
        );
        wallet = docs[0];
      } catch (err) {
        if (err.code === 11000 || (err.message && err.message.includes('E11000'))) {
          wallet = await this.findDocumentByUserId(userId, session);
        } else {
          throw err;
        }
      }
    }
    return wallet;
  }

  async atomicAddBalance(userId, amount, session = null) {
    const value = Math.max(0, Number(amount) || 0);
    const query = this.model.findOneAndUpdate(
      { userId: toObjectId(userId) },
      { $inc: { balance: value } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    if (session) query.session(session);
    return query.exec();
  }

  async atomicDeductBalance(userId, amount, session = null) {
    const value = Math.max(0, Number(amount) || 0);
    const query = this.model.findOneAndUpdate(
      { userId: toObjectId(userId), balance: { $gte: value } },
      { $inc: { balance: -value } },
      { new: true },
    );
    if (session) query.session(session);
    const updated = await query.exec();
    if (!updated) {
      throw new AppError(
        'Insufficient wallet balance',
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.WALLET_INSUFFICIENT_BALANCE,
      );
    }
    return updated;
  }

  async atomicAddPoints(userId, points, session = null) {
    const value = Math.max(0, Math.floor(Number(points) || 0));
    const query = this.model.findOneAndUpdate(
      { userId: toObjectId(userId) },
      { $inc: { points: value } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    if (session) query.session(session);
    return query.exec();
  }

  async atomicDeductPoints(userId, points, session = null) {
    const value = Math.max(0, Math.floor(Number(points) || 0));
    const query = this.model.findOneAndUpdate(
      { userId: toObjectId(userId), points: { $gte: value } },
      { $inc: { points: -value } },
      { new: true },
    );
    if (session) query.session(session);
    const updated = await query.exec();
    if (!updated) {
      throw new AppError(
        'Insufficient points balance',
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.WALLET_INSUFFICIENT_POINTS,
      );
    }
    return updated;
  }
}

export class WalletTransactionRepository extends BaseRepository {
  constructor(transactionModel = WalletTransactionModel) {
    super(transactionModel);
  }

  async createTransaction(data, session = null) {
    if (session) {
      const docs = await this.model.create([data], { session });
      return docs[0];
    }
    return this.create(data);
  }

  async findByRazorpayOrderId(orderId, session = null) {
    const query = this.model.findOne({ razorpayOrderId: String(orderId) });
    if (session) query.session(session);
    return query.exec();
  }

  async updateStatusByRazorpayOrderId(orderId, status, paymentDetails = {}, session = null) {
    const query = this.model.findOneAndUpdate(
      { razorpayOrderId: String(orderId) },
      {
        $set: {
          status,
          ...(paymentDetails.razorpayPaymentId
            ? { razorpayPaymentId: paymentDetails.razorpayPaymentId }
            : {}),
          ...(paymentDetails.razorpaySignature
            ? { razorpaySignature: paymentDetails.razorpaySignature }
            : {}),
          ...(paymentDetails.balanceAfter != null
            ? { balanceAfter: paymentDetails.balanceAfter }
            : {}),
          ...(paymentDetails.pointsAfter != null
            ? { pointsAfter: paymentDetails.pointsAfter }
            : {}),
        },
      },
      { new: true },
    );
    if (session) query.session(session);
    return query.exec();
  }

  async listByUserWithAggregation(userId, { page = 1, limit = 10, category, type } = {}) {
    const skip = (Math.max(1, page) - 1) * limit;
    const match = { userId: toObjectId(userId) };
    if (category) match.category = category;
    if (type) match.type = type;

    const pipeline = [
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ];

    const [result] = await this.model.aggregate(pipeline).exec();
    const total = result?.metadata[0]?.total || 0;
    const items = result?.data || [];
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }
}
