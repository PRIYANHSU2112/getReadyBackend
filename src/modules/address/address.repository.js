import mongoose from 'mongoose';
import { BaseRepository } from '../../common/base/BaseRepository.js';

const LIST_SELECT = '-__v';

function toObjectId(id) {
  if (!id) return id;
  if (id instanceof mongoose.Types.ObjectId) return id;
  return new mongoose.Types.ObjectId(id);
}

export class AddressRepository extends BaseRepository {
  constructor(addressModel) {
    super(addressModel);
  }

  async findActiveById(id) {
    return this.findOne({ _id: id, deletedAt: null }, { lean: true, select: LIST_SELECT });
  }

  async findActiveByIdForUser(id, userId) {
    return this.findOne(
      { _id: id, userId: toObjectId(userId), deletedAt: null },
      { lean: true, select: LIST_SELECT },
    );
  }

  async countActiveByUser(userId) {
    return this.count({ userId: toObjectId(userId), deletedAt: null });
  }

  async listByUser(userId, options = {}) {
    return this.findAndCount(
      { userId: toObjectId(userId), deletedAt: null },
      {
        skip: options.skip ?? 0,
        limit: options.limit ?? 10,
        sort: options.sort || '-createdAt',
        select: LIST_SELECT,
      },
    );
  }

  async clearDefaultForUser(userId) {
    return this.model
      .updateMany(
        { userId: toObjectId(userId), deletedAt: null, isDefault: true },
        { $set: { isDefault: false } },
      )
      .exec();
  }

  async findLatestActiveForUser(userId) {
    const [item] = await this.findAll(
      { userId: toObjectId(userId), deletedAt: null },
      { limit: 1, sort: '-createdAt', lean: true, select: LIST_SELECT },
    );
    return item || null;
  }

  /**
   * Soft-delete and return the updated doc.
   */
  async softDeleteForUser(id, userId) {
    return this.model
      .findOneAndUpdate(
        { _id: id, userId: toObjectId(userId), deletedAt: null },
        { $set: { deletedAt: new Date(), isDefault: false } },
        { new: true },
      )
      .select(LIST_SELECT)
      .lean()
      .exec();
  }
}
