import { RoleModel } from '../models/role.model.js';
import { PermissionModel } from '../models/permission.model.js';

export class RoleRepository {
  async create(data) {
    return RoleModel.create(data);
  }

  async findById(id) {
    return RoleModel.findById(id);
  }

  async findBySlug(slug) {
    return RoleModel.findOne({ slug: slug.toLowerCase() });
  }

  async findActiveBySlug(slug) {
    return RoleModel.findOne({ slug: slug.toLowerCase(), isActive: true });
  }

  async upsertBySlug(data) {
    return RoleModel.findOneAndUpdate(
      { slug: data.slug.toLowerCase() },
      { $set: data },
      { upsert: true, new: true },
    );
  }

  async updateById(id, data) {
    return RoleModel.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  async deleteById(id) {
    return RoleModel.findByIdAndDelete(id);
  }

  async findAndCount(filter = {}, { skip = 0, limit = 50, sort = 'name' } = {}) {
    const [items, total] = await Promise.all([
      RoleModel.find(filter).sort(sort).skip(skip).limit(limit).lean().exec(),
      RoleModel.countDocuments(filter),
    ]);
    return { items, total };
  }
}

export class PermissionRepository {
  async findActive() {
    return PermissionModel.find({ isActive: true }).sort({ module: 1, key: 1 }).lean();
  }

  async findByKey(key) {
    return PermissionModel.findOne({ key, isActive: true }).lean();
  }

  async findByKeys(keys) {
    return PermissionModel.find({ key: { $in: keys }, isActive: true }).lean();
  }

  async bulkWrite(ops) {
    return PermissionModel.bulkWrite(ops);
  }

  async deactivateUnlistedKeys(keys) {
    return PermissionModel.updateMany(
      { key: { $nin: keys } },
      { $set: { isActive: false } },
    );
  }
}
