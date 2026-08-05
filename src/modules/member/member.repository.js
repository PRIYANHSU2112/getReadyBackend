import mongoose from 'mongoose';
import { BaseRepository } from '../../common/base/BaseRepository.js';

const LIST_SELECT = '-__v';

function toObjectId(id) {
  if (!id) return id;
  if (id instanceof mongoose.Types.ObjectId) return id;
  return new mongoose.Types.ObjectId(id);
}

export class MemberRepository extends BaseRepository {
  constructor(memberModel) {
    super(memberModel);
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

  async softDeleteForUser(id, userId) {
    return this.model
      .findOneAndUpdate(
        { _id: id, userId: toObjectId(userId), deletedAt: null },
        { $set: { deletedAt: new Date() } },
        { new: true },
      )
      .select(LIST_SELECT)
      .lean()
      .exec();
  }
}
