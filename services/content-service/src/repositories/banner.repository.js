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
}
