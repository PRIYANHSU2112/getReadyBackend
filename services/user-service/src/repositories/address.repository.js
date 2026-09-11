import { AddressModel } from '../models/address.model.js';

export class AddressRepository {
  async create(data) {
    if (data.isDefault) {
      await AddressModel.updateMany({ userId: data.userId }, { $set: { isDefault: false } });
    }
    return AddressModel.create(data);
  }

  async findActiveByUserId(userId) {
    return AddressModel.find({ userId, deletedAt: null }).sort({ isDefault: -1, createdAt: -1 }).lean();
  }

  async findActiveById(id, userId) {
    return AddressModel.findOne({ _id: id, userId, deletedAt: null });
  }

  async updateById(id, userId, data) {
    if (data.isDefault) {
      await AddressModel.updateMany({ userId }, { $set: { isDefault: false } });
    }
    return AddressModel.findOneAndUpdate({ _id: id, userId, deletedAt: null }, { $set: data }, { new: true });
  }

  async softDelete(id, userId) {
    return AddressModel.findOneAndUpdate({ _id: id, userId, deletedAt: null }, { $set: { deletedAt: new Date(), isActive: false } }, { new: true });
  }

  async setDefault(id, userId) {
    await AddressModel.updateMany({ userId }, { $set: { isDefault: false } });
    return AddressModel.findOneAndUpdate({ _id: id, userId, deletedAt: null }, { $set: { isDefault: true } }, { new: true });
  }
}
