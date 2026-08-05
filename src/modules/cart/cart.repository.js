import mongoose from 'mongoose';
import { BaseRepository } from '../../common/base/BaseRepository.js';

const CART_SELECT = '-__v';

function toObjectId(id) {
  if (!id) return id;
  if (id instanceof mongoose.Types.ObjectId) return id;
  return new mongoose.Types.ObjectId(id);
}

export class CartRepository extends BaseRepository {
  constructor(cartModel) {
    super(cartModel);
  }

  async findByUserId(userId) {
    return this.findOne(
      { userId: toObjectId(userId) },
      { lean: true, select: CART_SELECT },
    );
  }

  /**
   * Find cart as a mongoose document (for in-memory mutation + save).
   */
  async findDocumentByUserId(userId) {
    return this.model.findOne({ userId: toObjectId(userId) }).exec();
  }

  async createForUser(userId, data = {}) {
    return this.create({
      userId: toObjectId(userId),
      items: [],
      specialInstructions: null,
      benefits: {},
      pricing: null,
      ...data,
    });
  }

  async saveDocument(cartDoc) {
    return cartDoc.save();
  }

  async replaceCart(userId, payload) {
    return this.model
      .findOneAndUpdate(
        { userId: toObjectId(userId) },
        { $set: payload },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .select(CART_SELECT)
      .lean()
      .exec();
  }

  async clearCart(userId) {
    return this.model
      .findOneAndUpdate(
        { userId: toObjectId(userId) },
        {
          $set: {
            items: [],
            specialInstructions: null,
            benefits: {
              useWallet: false,
              couponCode: null,
              useCredits: false,
              useCashback: false,
              membershipOptIn: false,
            },
            pricing: null,
            checkedOutAt: null,
          },
        },
        { new: true },
      )
      .select(CART_SELECT)
      .lean()
      .exec();
  }

  async deleteByUserId(userId) {
    return this.model.deleteOne({ userId: toObjectId(userId) }).exec();
  }
}
