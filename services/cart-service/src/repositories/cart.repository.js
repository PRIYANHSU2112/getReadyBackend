import mongoose from 'mongoose';
import { CartModel } from '../models/cart.model.js';

export class CartRepository {
  async findByUserId(userId) {
    return CartModel.findOne({ userId: new mongoose.Types.ObjectId(userId) });
  }

  async createForUser(userId, defaults = {}) {
    return CartModel.create({
      userId: new mongoose.Types.ObjectId(userId),
      items: [],
      ...defaults,
    });
  }

  async save(cart) {
    return cart.save();
  }

  async deleteByUserId(userId) {
    return CartModel.deleteOne({ userId: new mongoose.Types.ObjectId(userId) });
  }
}
