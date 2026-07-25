import { BaseRepository } from '../../common/base/BaseRepository.js';

const LIST_SELECT = '-__v';

export class PermissionRepository extends BaseRepository {
  constructor(permissionModel) {
    super(permissionModel);
  }

  async findByKey(key) {
    return this.findOne({ key }, { lean: true });
  }

  async findAllActive(options = {}) {
    return this.findAll(
      { isActive: true },
      { ...options, sort: options.sort || 'module', select: options.select || LIST_SELECT },
    );
  }

  async upsertByKey(data) {
    return this.model
      .findOneAndUpdate(
        { key: data.key },
        {
          $set: {
            module: data.module,
            action: data.action,
            description: data.description,
            isActive: data.isActive !== false,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean()
      .exec();
  }

  /**
   * Upsert many permission catalog entries in one round-trip.
   * @param {Array<{ key: string, module: string, action: string, description?: string }>} items
   */
  async bulkUpsertFromCatalog(items) {
    if (!items?.length) return [];

    const ops = items.map((item) => ({
      updateOne: {
        filter: { key: item.key },
        update: {
          $set: {
            module: item.module,
            action: item.action,
            description: item.description || '',
            isActive: true,
          },
        },
        upsert: true,
      },
    }));

    await this.model.bulkWrite(ops, { ordered: false });

    return this.findAll(
      { key: { $in: items.map((i) => i.key) } },
      { limit: items.length, sort: 'module', lean: true, select: LIST_SELECT },
    );
  }

  async findKeys(keys) {
    if (!keys?.length) return [];
    return this.findAll(
      { key: { $in: keys }, isActive: true },
      { limit: keys.length, lean: true, select: 'key' },
    );
  }

  async searchAndCount(filter, options = {}) {
    return this.findAndCount(filter, {
      ...options,
      select: options.select || LIST_SELECT,
    });
  }
}
