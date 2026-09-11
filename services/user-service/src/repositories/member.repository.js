import { MemberModel } from '../models/member.model.js';

export class MemberRepository {
  async create(data) {
    return MemberModel.create(data);
  }

  async findActiveByUserId(userId) {
    return MemberModel.find({ userId, deletedAt: null }).sort({ createdAt: -1 }).lean();
  }

  async findAndCount(filter = {}, { skip = 0, limit = 25, sort = { createdAt: -1 } } = {}) {
    const [items, total] = await Promise.all([
      MemberModel.find({ deletedAt: null, ...filter }).sort(sort).skip(skip).limit(limit).lean().exec(),
      MemberModel.countDocuments({ deletedAt: null, ...filter }),
    ]);

    const formatted = items.map((m) => ({
      ...m,
      id: m._id?.toString(),
      name: m.name || m.planName || 'Membership Plan',
      price: m.price || 999,
      members: m.memberCount || 1,
      status: m.status || (m.isActive ? 'ACTIVE' : 'INACTIVE'),
    }));

    return { items: formatted, total };
  }

  async findActiveByIdForUser(id, userId) {
    if (userId) {
      return MemberModel.findOne({ _id: id, userId, deletedAt: null }).lean();
    }
    return MemberModel.findOne({ _id: id, deletedAt: null }).lean();
  }

  async updateById(id, userId, data) {
    const query = userId ? { _id: id, userId, deletedAt: null } : { _id: id, deletedAt: null };
    return MemberModel.findOneAndUpdate(query, { $set: data }, { new: true });
  }

  async softDelete(id, userId) {
    const query = userId ? { _id: id, userId, deletedAt: null } : { _id: id, deletedAt: null };
    return MemberModel.findOneAndUpdate(query, { $set: { deletedAt: new Date(), isActive: false } }, { new: true });
  }
}
