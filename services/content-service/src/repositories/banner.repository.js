import { BannerModel } from '../models/banner.model.js';

export class BannerRepository {
  async findActive() {
    const now = new Date();
    return BannerModel.find({
      isActive: true,
      $or: [{ startDate: null }, { startDate: { $lte: now } }],
      $and: [{ $or: [{ endDate: null }, { endDate: { $gte: now } }] }],
    }).sort({ displayOrder: 1, createdAt: -1 });
  }

  async list({ limit = 20, skip = 0, isActive } = {}) {
    const query = {};
    if (typeof isActive === 'boolean') query.isActive = isActive;
    const [banners, total] = await Promise.all([
      BannerModel.find(query).sort({ displayOrder: 1, createdAt: -1 }).skip(skip).limit(limit),
      BannerModel.countDocuments(query),
    ]);
    return { banners, total };
  }

  async findById(id) {
    return BannerModel.findById(id);
  }

  async create(data) {
    const doc = new BannerModel(data);
    return doc.save();
  }

  async update(id, data) {
    return BannerModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async delete(id) {
    return BannerModel.findByIdAndDelete(id);
  }

  async getAdminStats({ startDate, endDate } = {}) {
    const match = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    const now = new Date();
    const [res] = await BannerModel.aggregate([
      { $match: match },
      {
        $facet: {
          totals: [{ $count: 'count' }],
          active: [{ $match: { isActive: true } }, { $count: 'count' }],
          inactive: [{ $match: { isActive: false } }, { $count: 'count' }],
          deeplinked: [{ $match: { deepLinkType: { $ne: 'NONE' } } }, { $count: 'count' }],
          currentlyLive: [
            {
              $match: {
                isActive: true,
                $and: [
                  { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
                  { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
                ],
              },
            },
            { $count: 'count' },
          ],
        },
      },
    ]);

    return {
      total: res?.totals?.[0]?.count || 0,
      active: res?.active?.[0]?.count || 0,
      inactive: res?.inactive?.[0]?.count || 0,
      deeplinked: res?.deeplinked?.[0]?.count || 0,
      currentlyLive: res?.currentlyLive?.[0]?.count || 0,
    };
  }
}
