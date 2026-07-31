import { BaseRepository } from '../../common/base/BaseRepository.js';
import { buildSearchFilter } from '../../common/helpers/list-query.helper.js';

const LIST_SELECT = '-__v';

const PUBLIC_PROJECT = {
  _id: 0,
  id: { $toString: '$_id' },
  name: 1,
  categoryId: { $ifNull: ['$categoryId', null] },
  icon: { $ifNull: ['$icon', null] },
  displayOrder: 1,
};

export class SkillRepository extends BaseRepository {
  constructor(model) {
    super(model);
  }

  async findByIdAny(id) {
    return this.findOne({ _id: id }, { lean: true, select: LIST_SELECT });
  }

  async findActiveById(id) {
    return this.findOne(
      { _id: id, deletedAt: null, isActive: true },
      { lean: true, select: LIST_SELECT },
    );
  }

  async findByName(name, { excludeId = null } = {}) {
    const filter = { name: new RegExp(`^${name.trim()}$`, 'i'), deletedAt: null };
    if (excludeId) filter._id = { $ne: excludeId };
    return this.findOne(filter, { lean: true, select: LIST_SELECT });
  }

  buildAdminFilter(query = {}) {
    const filter = {};
    if (!query.includeDeleted) filter.deletedAt = null;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.categoryId) filter.categoryId = query.categoryId;
    const search = buildSearchFilter(query.search, ['name']);
    if (search) Object.assign(filter, search);
    return filter;
  }

  async listAdmin(filter, options = {}) {
    return this.findAndCount(filter, {
      skip: options.skip ?? 0,
      limit: options.limit ?? 10,
      sort: options.sort || 'displayOrder',
      select: LIST_SELECT,
    });
  }

  async listPublicSlim({ categoryId } = {}) {
    const match = { deletedAt: null, isActive: true };
    if (categoryId) match.categoryId = categoryId;

    return this.model
      .aggregate([
        { $match: match },
        { $sort: { displayOrder: 1, name: 1 } },
        { $project: PUBLIC_PROJECT },
      ])
      .exec();
  }

  async findByIds(ids) {
    return this.model
      .find({ _id: { $in: ids }, isActive: true, deletedAt: null })
      .sort('displayOrder')
      .select(LIST_SELECT)
      .lean()
      .exec();
  }

  async softDelete(id) {
    return this.model
      .findOneAndUpdate(
        { _id: id, deletedAt: null },
        { $set: { deletedAt: new Date(), isActive: false } },
        { new: true },
      )
      .select(LIST_SELECT)
      .lean()
      .exec();
  }

  async softDeleteMany(ids) {
    return this.model
      .updateMany(
        { _id: { $in: ids }, deletedAt: null },
        { $set: { deletedAt: new Date(), isActive: false } },
      )
      .exec();
  }

  async restore(id) {
    return this.model
      .findOneAndUpdate(
        { _id: id, deletedAt: { $ne: null } },
        { $set: { deletedAt: null } },
        { new: true },
      )
      .select(LIST_SELECT)
      .lean()
      .exec();
  }

  async bulkSetActive(ids, isActive) {
    return this.model
      .updateMany(
        { _id: { $in: ids }, deletedAt: null },
        { $set: { isActive } },
      )
      .exec();
  }

  async reorder(items = []) {
    if (!items.length) return;
    const ops = items.map(({ id, displayOrder }) => ({
      updateOne: {
        filter: { _id: id, deletedAt: null },
        update: { $set: { displayOrder } },
      },
    }));
    return this.model.bulkWrite(ops, { ordered: false });
  }
}
