import { UserModel } from '../models/user.model.js';

export class UserRepository {
  async create(data) {
    return UserModel.create(data);
  }

  async findById(id) {
    return UserModel.findById(id);
  }

  async findActiveById(id) {
    return UserModel.findOne({ _id: id, isActive: true, deletedAt: null });
  }

  async findByEmail(email, { includePassword = false, includeDeleted = false, lean = true } = {}) {
    let q = UserModel.findOne({
      email: new RegExp(`^${email.trim()}$`, 'i'),
      ...(includeDeleted ? {} : { deletedAt: null }),
    });
    if (includePassword) q = q.select('+password');
    return lean ? q.lean().exec() : q.exec();
  }

  async findByPhone(phone, { role = null, includeDeleted = false, lean = true } = {}) {
    const filter = {
      phone: phone.trim(),
      ...(role ? { role: role.toLowerCase() } : {}),
      ...(includeDeleted ? {} : { deletedAt: null }),
    };
    const q = UserModel.findOne(filter);
    return lean ? q.lean().exec() : q.exec();
  }

  async findByReferralCode(code) {
    return UserModel.findOne({ referralCode: code.toUpperCase(), deletedAt: null }).lean();
  }

  async updateById(id, payload) {
    return UserModel.findByIdAndUpdate(id, { $set: payload }, { new: true, runValidators: true });
  }

  async softDelete(id) {
    return UserModel.findByIdAndUpdate(id, { $set: { deletedAt: new Date(), isActive: false } }, { new: true });
  }

  async countActive(filter = {}) {
    return UserModel.countDocuments({ ...filter, isActive: true, deletedAt: null });
  }

  async searchAndCount(filter = {}, { skip = 0, limit = 10, sort = '-createdAt' } = {}) {
    const [items, total] = await Promise.all([
      UserModel.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      UserModel.countDocuments(filter),
    ]);
    return { items, total };
  }
}
