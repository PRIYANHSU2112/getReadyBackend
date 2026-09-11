import {
  CategoryModel,
  ServiceModel,
  ServiceChangeRequestModel,
  PackageModel,
  FilterModel,
  FilterValueModel,
  HygieneKitModel,
  CouponModel,
} from '../models/catalog.models.js';

export class CategoryRepository {
  async create(data) {
    return CategoryModel.create(data);
  }

  async findActive() {
    return CategoryModel.find({ isActive: true, deletedAt: null }).sort({ displayOrder: 1, name: 1 }).lean();
  }

  async findBySlug(slug) {
    return CategoryModel.findOne({ slug: slug.toLowerCase(), deletedAt: null }).lean();
  }

  async findActiveBySlug(slug) {
    return CategoryModel.findOne({ slug: slug.toLowerCase(), isActive: true, deletedAt: null }).lean();
  }

  async findById(id) {
    return CategoryModel.findOne({ _id: id, deletedAt: null });
  }

  async updateById(id, data) {
    return CategoryModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: data }, { new: true });
  }

  async deleteById(id) {
    return CategoryModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: { deletedAt: new Date(), isActive: false } }, { new: true });
  }

  async restoreById(id) {
    return CategoryModel.findByIdAndUpdate(id, { $set: { deletedAt: null, isActive: true } }, { new: true });
  }

  async findAndCount(filter = {}, { skip = 0, limit = 10, sort = 'displayOrder' } = {}) {
    const [items, total] = await Promise.all([
      CategoryModel.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      CategoryModel.countDocuments(filter),
    ]);
    return { items, total };
  }
}

export class ServiceRepository {
  async create(data) {
    return ServiceModel.create(data);
  }

  async findActive() {
    return ServiceModel.find({ isActive: true, status: 'APPROVED', deletedAt: null }).sort({ displayOrder: 1, name: 1 }).lean();
  }

  async findActiveByCategory(categoryId) {
    return ServiceModel.find({ categoryId, isActive: true, status: 'APPROVED', deletedAt: null }).sort({ displayOrder: 1, name: 1 }).lean();
  }

  async findActiveBySlug(slug) {
    return ServiceModel.findOne({ slug: slug.toLowerCase(), isActive: true, status: 'APPROVED', deletedAt: null }).populate('categoryId').lean();
  }

  async findActiveById(id) {
    return ServiceModel.findOne({ _id: id, isActive: true, deletedAt: null }).lean();
  }

  async findById(id) {
    return ServiceModel.findOne({ _id: id, deletedAt: null }).populate('categoryId');
  }

  async updateById(id, data) {
    return ServiceModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: data }, { new: true });
  }

  async deleteById(id) {
    return ServiceModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: { deletedAt: new Date(), isActive: false } }, { new: true });
  }

  async restoreById(id) {
    return ServiceModel.findByIdAndUpdate(id, { $set: { deletedAt: null, isActive: true } }, { new: true });
  }

  async findAndCount(filter = {}, { skip = 0, limit = 10, sort = '-createdAt' } = {}) {
    const [items, total] = await Promise.all([
      ServiceModel.find(filter).populate('categoryId').sort(sort).skip(skip).limit(limit).lean().exec(),
      ServiceModel.countDocuments(filter),
    ]);
    return { items, total };
  }
}

export class ServiceChangeRequestRepository {
  async create(data) {
    return ServiceChangeRequestModel.create(data);
  }

  async findById(id) {
    return ServiceChangeRequestModel.findById(id).populate('serviceId');
  }

  async findAndCount(filter = {}, { skip = 0, limit = 10, sort = '-createdAt' } = {}) {
    const [items, total] = await Promise.all([
      ServiceChangeRequestModel.find(filter).populate('serviceId').sort(sort).skip(skip).limit(limit).lean().exec(),
      ServiceChangeRequestModel.countDocuments(filter),
    ]);
    return { items, total };
  }

  async updateStatus(id, status, extra = {}) {
    return ServiceChangeRequestModel.findByIdAndUpdate(id, { $set: { status, ...extra } }, { new: true });
  }
}

export class PackageRepository {
  async create(data) {
    return PackageModel.create(data);
  }

  async findPublic() {
    return PackageModel.find({ isActive: true, status: 'APPROVED', deletedAt: null }).sort({ createdAt: -1 }).lean();
  }

  async findPublicByCategory(categoryId) {
    return PackageModel.find({ categoryId, isActive: true, status: 'APPROVED', deletedAt: null }).sort({ createdAt: -1 }).lean();
  }

  async findPublicBySlug(slug) {
    return PackageModel.findOne({ slug: slug.toLowerCase(), isActive: true, status: 'APPROVED', deletedAt: null }).lean();
  }

  async findPublicById(id) {
    return PackageModel.findOne({ _id: id, isActive: true, status: 'APPROVED', deletedAt: null }).lean();
  }

  async findById(id) {
    return PackageModel.findOne({ _id: id, deletedAt: null });
  }

  async updateById(id, data) {
    return PackageModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: data }, { new: true });
  }

  async deleteById(id) {
    return PackageModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: { deletedAt: new Date(), isActive: false } }, { new: true });
  }

  async findAndCount(filter = {}, { skip = 0, limit = 10, sort = '-createdAt' } = {}) {
    const [items, total] = await Promise.all([
      PackageModel.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      PackageModel.countDocuments(filter),
    ]);
    return { items, total };
  }
}

export class FilterRepository {
  async create(data) {
    return FilterModel.create(data);
  }

  async findActive() {
    return FilterModel.find({ isActive: true, deletedAt: null }).sort({ displayOrder: 1 }).lean();
  }

  async findById(id) {
    return FilterModel.findOne({ _id: id, deletedAt: null });
  }

  async updateById(id, data) {
    return FilterModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: data }, { new: true });
  }

  async deleteById(id) {
    return FilterModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: { deletedAt: new Date(), isActive: false } }, { new: true });
  }

  async restoreById(id) {
    return FilterModel.findByIdAndUpdate(id, { $set: { deletedAt: null, isActive: true } }, { new: true });
  }

  // Filter Values
  async createValue(data) {
    return FilterValueModel.create(data);
  }

  async findValuesByFilterId(filterId) {
    return FilterValueModel.find({ filterId, isActive: true, deletedAt: null }).sort({ displayOrder: 1 }).lean();
  }

  async updateValueById(id, data) {
    return FilterValueModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: data }, { new: true });
  }

  async deleteValueById(id) {
    return FilterValueModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: { deletedAt: new Date(), isActive: false } }, { new: true });
  }

  async restoreValueById(id) {
    return FilterValueModel.findByIdAndUpdate(id, { $set: { deletedAt: null, isActive: true } }, { new: true });
  }
}

export class HygieneKitRepository {
  async create(data) {
    if (data.isDefault) {
      await HygieneKitModel.updateMany({}, { $set: { isDefault: false } });
    }
    return HygieneKitModel.create(data);
  }

  async findDefault() {
    return HygieneKitModel.findOne({ isDefault: true, isActive: true, deletedAt: null }).lean();
  }

  async findActive() {
    return HygieneKitModel.find({ isActive: true, deletedAt: null }).sort({ isDefault: -1, createdAt: -1 }).lean();
  }

  async findById(id) {
    return HygieneKitModel.findOne({ _id: id, deletedAt: null });
  }

  async updateById(id, data) {
    if (data.isDefault) {
      await HygieneKitModel.updateMany({}, { $set: { isDefault: false } });
    }
    return HygieneKitModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: data }, { new: true });
  }

  async deleteById(id) {
    return HygieneKitModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: { deletedAt: new Date(), isActive: false } }, { new: true });
  }

  async restoreById(id) {
    return HygieneKitModel.findByIdAndUpdate(id, { $set: { deletedAt: null, isActive: true } }, { new: true });
  }

  async setDefault(id) {
    await HygieneKitModel.updateMany({}, { $set: { isDefault: false } });
    return HygieneKitModel.findByIdAndUpdate(id, { $set: { isDefault: true, isActive: true, deletedAt: null } }, { new: true });
  }

  async findAndCount(filter = {}, { skip = 0, limit = 10 } = {}) {
    const [items, total] = await Promise.all([
      HygieneKitModel.find(filter).skip(skip).limit(limit).lean().exec(),
      HygieneKitModel.countDocuments(filter),
    ]);
    return { items, total };
  }
}

export class CouponRepository {
  async create(data) {
    return CouponModel.create(data);
  }

  async findById(id) {
    return CouponModel.findById(id);
  }

  async findByCode(code) {
    return CouponModel.findOne({
      code: code.trim().toUpperCase(),
      isActive: true,
      deletedAt: null,
    });
  }

  async findAndCount(filter = {}, { skip = 0, limit = 25, sort = { createdAt: -1 } } = {}) {
    const [items, total] = await Promise.all([
      CouponModel.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      CouponModel.countDocuments(filter),
    ]);

    const formatted = items.map((c) => ({
      ...c,
      id: c._id?.toString(),
      name: c.code || c.name,
      discount: c.discountType === 'PERCENTAGE' ? `${c.discountValue}% OFF` : `₹${c.discountValue} FLAT`,
      used: c.usedCount || 0,
      status: c.status || (c.isActive ? 'ACTIVE' : 'INACTIVE'),
    }));

    return { items: formatted, total };
  }

  async updateById(id, data) {
    return CouponModel.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  async deleteById(id) {
    return CouponModel.findByIdAndUpdate(id, { $set: { deletedAt: new Date(), isActive: false, status: 'INACTIVE' } }, { new: true });
  }
}
