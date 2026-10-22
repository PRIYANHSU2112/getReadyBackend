import {
  BeauticianProfileModel,
  WorkHistoryModel,
  CertificateModel,
  SkillModel,
  BankDetailModel,
} from '../models/beautician.models.js';

export class BeauticianProfileRepository {
  async create(data) {
    return BeauticianProfileModel.create(data);
  }

  async findByUserId(userId) {
    return BeauticianProfileModel.findOne({ userId, deletedAt: null });
  }

  async findById(id) {
    return BeauticianProfileModel.findById(id);
  }

  async updateByUserId(userId, data) {
    return BeauticianProfileModel.findOneAndUpdate({ userId, deletedAt: null }, { $set: data }, { new: true });
  }

  async updateById(id, data) {
    return BeauticianProfileModel.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  async findAndCount(filter = {}, { skip = 0, limit = 10, sort = '-createdAt' } = {}) {
    const [items, total] = await Promise.all([
      BeauticianProfileModel.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      BeauticianProfileModel.countDocuments(filter),
    ]);
    return { items, total };
  }

  async getAdminStats({ startDate, endDate } = {}) {
    const [facetResults] = await BeauticianProfileModel.aggregate([
      {
        $facet: {
          total: [
            { $match: { deletedAt: null } },
            { $count: 'count' },
          ],
          online: [
            { $match: { isOnline: true, deletedAt: null } },
            { $count: 'count' },
          ],
          kycPending: [
            { $match: { kycStatus: { $in: ['PENDING', 'UNDER_REVIEW'] }, deletedAt: null } },
            { $count: 'count' },
          ],
          kycApproved: [
            { $match: { kycStatus: 'APPROVED', deletedAt: null } },
            { $count: 'count' },
          ],
          topRated: [
            { $match: { 'rating.average': { $gte: 4.8 }, deletedAt: null } },
            { $count: 'count' },
          ],
        },
      },
    ]);

    const total = facetResults.total[0]?.count || 0;
    const online = facetResults.online[0]?.count || 0;
    const pendingKyc = facetResults.kycPending[0]?.count || 0;
    const approved = facetResults.kycApproved[0]?.count || 0;
    const topRated = facetResults.topRated[0]?.count || 0;

    return {
      totalRegistered: total,
      activeOnline: online,
      available: online,
      busy: 0,
      onLeave: Math.max(0, total - online),
      pendingKycQueue: pendingKyc,
      approvedPartners: approved,
      topRatedCount: topRated,
    };
  }
}

export class WorkHistoryRepository {
  async create(data) {
    return WorkHistoryModel.create(data);
  }

  async findByProfileId(profileId) {
    return WorkHistoryModel.find({ beauticianProfileId: profileId }).sort({ startDate: -1 }).lean();
  }

  async findById(id) {
    return WorkHistoryModel.findById(id);
  }

  async updateById(id, profileId, data) {
    return WorkHistoryModel.findOneAndUpdate({ _id: id, beauticianProfileId: profileId }, { $set: data }, { new: true });
  }

  async deleteById(id, profileId) {
    return WorkHistoryModel.findOneAndDelete({ _id: id, beauticianProfileId: profileId });
  }
}

export class CertificateRepository {
  async create(data) {
    return CertificateModel.create(data);
  }

  async findByProfileId(profileId) {
    return CertificateModel.find({ beauticianProfileId: profileId }).sort({ issueDate: -1 }).lean();
  }

  async findById(id) {
    return CertificateModel.findById(id);
  }

  async updateById(id, profileId, data) {
    return CertificateModel.findOneAndUpdate({ _id: id, beauticianProfileId: profileId }, { $set: data }, { new: true });
  }

  async reviewById(id, data) {
    return CertificateModel.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  async deleteById(id, profileId) {
    return CertificateModel.findOneAndDelete({ _id: id, beauticianProfileId: profileId });
  }
}

export class SkillRepository {
  async create(data) {
    return SkillModel.create(data);
  }

  async findActive() {
    return SkillModel.find({ isActive: true, deletedAt: null }).sort({ displayOrder: 1, name: 1 }).lean();
  }

  async findById(id) {
    return SkillModel.findOne({ _id: id, deletedAt: null });
  }

  async findBySlug(slug) {
    return SkillModel.findOne({ slug: slug.toLowerCase(), deletedAt: null });
  }

  async updateById(id, data) {
    return SkillModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: data }, { new: true });
  }

  async deleteById(id) {
    return SkillModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: { deletedAt: new Date(), isActive: false } }, { new: true });
  }
}

export class BankDetailRepository {
  async upsertByUserId(userId, data) {
    const existing = await BankDetailModel.findOne({ userId });
    if (existing) {
      Object.assign(existing, data, { deletedAt: null });
      return existing.save();
    }
    return BankDetailModel.create({ userId, ...data, deletedAt: null });
  }

  async findByUserId(userId) {
    return BankDetailModel.findOne({ userId, deletedAt: null });
  }

  async findById(id) {
    return BankDetailModel.findOne({ _id: id, deletedAt: null });
  }

  async reviewById(id, data) {
    return BankDetailModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: data }, { new: true });
  }

  async deleteByUserId(userId) {
    return BankDetailModel.findOneAndUpdate({ userId, deletedAt: null }, { $set: { deletedAt: new Date() } }, { new: true });
  }

  async findAndCount(filter = {}, { skip = 0, limit = 10 } = {}) {
    const [items, total] = await Promise.all([
      BankDetailModel.find({ ...filter, deletedAt: null }).skip(skip).limit(limit).lean().exec(),
      BankDetailModel.countDocuments({ ...filter, deletedAt: null }),
    ]);
    return { items, total };
  }
}
