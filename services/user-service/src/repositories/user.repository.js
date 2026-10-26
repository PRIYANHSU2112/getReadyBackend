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
    if (!email || typeof email !== 'string') return null;
    let q = UserModel.findOne({
      email: new RegExp(`^${email.trim()}$`, 'i'),
      ...(includeDeleted ? {} : { deletedAt: null }),
    });
    if (includePassword) q = q.select('+password');
    return lean ? q.lean().exec() : q.exec();
  }

  async findByPhone(phone, { role = null, includeDeleted = false, lean = true } = {}) {
    if (!phone || typeof phone !== 'string') return null;
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

  async getAdminStats({ startDate, endDate } = {}) {
    const matchPeriod = {};
    if (startDate || endDate) {
      matchPeriod.createdAt = {};
      if (startDate) matchPeriod.createdAt.$gte = new Date(startDate);
      if (endDate) matchPeriod.createdAt.$lte = new Date(endDate);
    }

    const [facetResults] = await UserModel.aggregate([
      {
        $facet: {
          totalUsers: [
            { $match: { deletedAt: null } },
            { $count: 'count' },
          ],
          activeUsers: [
            { $match: { isActive: true, deletedAt: null } },
            { $count: 'count' },
          ],
          periodNewUsers: [
            { $match: { deletedAt: null, ...matchPeriod } },
            { $count: 'count' },
          ],
          membershipUsers: [
            {
              $match: {
                deletedAt: null,
                $or: [
                  { membershipTier: { $exists: true, $nin: [null, '', 'STANDARD', 'Standard User'] } },
                  { isMember: true },
                ],
              },
            },
            { $count: 'count' },
          ],
          inactiveUsers: [
            { $match: { isActive: false, deletedAt: null } },
            { $count: 'count' },
          ],
        },
      },
    ]);

    return {
      totalCustomers: facetResults.totalUsers[0]?.count || 0,
      activeCustomers: facetResults.activeUsers[0]?.count || 0,
      newCustomersThisPeriod: facetResults.periodNewUsers[0]?.count || 0,
      membershipHolders: facetResults.membershipUsers[0]?.count || 0,
      blockedAccounts: facetResults.inactiveUsers[0]?.count || 0,
    };
  }

  async findReferrals({ page = 1, limit = 20, search } = {}) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = Math.min(parseInt(limit || '20', 10), 100);
    const skip = (pageNum - 1) * limitNum;
    const filter = { referredBy: { $ne: null }, deletedAt: null };

    const [items, total] = await Promise.all([
      UserModel.find(filter)
        .populate('referredBy', 'name phone email referralCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      UserModel.countDocuments(filter),
    ]);

    const formatted = items.map((user) => ({
      _id: user._id,
      id: user._id,
      referralCode: user.referredBy?.referralCode || '—',
      referrerName: user.referredBy?.name || 'Customer',
      referrerPhone: user.referredBy?.phone || '—',
      refereeName: user.name || 'New Customer',
      refereePhone: user.phone || '—',
      rewardAmount: 150,
      status: user.status === 'ACTIVE' ? 'COMPLETED' : 'PENDING_FIRST_BOOKING',
      bookingNumber: null,
      createdAt: user.createdAt,
    }));

    return { items: formatted, meta: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } };
  }
}
