import mongoose from 'mongoose';
import { BaseRepository } from '../../common/base/BaseRepository.js';
import { buildSearchFilter } from '../../common/helpers/list-query.helper.js';

const LIST_SELECT = '-__v';

function toObjectId(id) {
  if (!id) return id;
  if (id instanceof mongoose.Types.ObjectId) return id;
  return new mongoose.Types.ObjectId(id);
}

export class FilterValueRepository extends BaseRepository {
  constructor(filterValueModel) {
    super(filterValueModel);
  }

  async findActiveById(id, filterId) {
    return this.findOne(
      { _id: id, filterId: toObjectId(filterId), deletedAt: null },
      { lean: true, select: LIST_SELECT },
    );
  }

  async findByIdAny(id, filterId) {
    return this.findOne(
      { _id: id, filterId: toObjectId(filterId) },
      { lean: true, select: LIST_SELECT },
    );
  }

  async findBySlug(filterId, slug, { excludeId = null } = {}) {
    const filter = { filterId: toObjectId(filterId), slug, deletedAt: null };
    if (excludeId) filter._id = { $ne: excludeId };
    return this.findOne(filter, { lean: true, select: LIST_SELECT });
  }

  buildListFilter(filterId, query = {}) {
    const filter = { filterId: toObjectId(filterId) };
    if (!query.includeDeleted) filter.deletedAt = null;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    const search = buildSearchFilter(query.search, ['label', 'value', 'slug']);
    if (search) Object.assign(filter, search);
    return filter;
  }

  async listByFilter(filter, options = {}) {
    return this.findAndCount(filter, {
      skip: options.skip ?? 0,
      limit: options.limit ?? 20,
      sort: options.sort || 'displayOrder',
      select: LIST_SELECT,
    });
  }

  async clearDefaults(filterId, { exceptId = null } = {}) {
    const q = { filterId: toObjectId(filterId), deletedAt: null, isDefault: true };
    if (exceptId) q._id = { $ne: exceptId };
    return this.model.updateMany(q, { $set: { isDefault: false } }).exec();
  }

  async softDelete(id, filterId) {
    return this.model
      .findOneAndUpdate(
        { _id: id, filterId: toObjectId(filterId), deletedAt: null },
        { $set: { deletedAt: new Date(), isActive: false } },
        { new: true },
      )
      .select(LIST_SELECT)
      .lean()
      .exec();
  }

  async softDeleteByFilterId(filterId) {
    return this.model
      .updateMany(
        { filterId: toObjectId(filterId), deletedAt: null },
        { $set: { deletedAt: new Date(), isActive: false } },
      )
      .exec();
  }

  async restore(id, filterId) {
    return this.model
      .findOneAndUpdate(
        { _id: id, filterId: toObjectId(filterId), deletedAt: { $ne: null } },
        { $set: { deletedAt: null } },
        { new: true },
      )
      .select(LIST_SELECT)
      .lean()
      .exec();
  }

  async reorder(filterId, items = []) {
    if (!items.length) return;
    const fid = toObjectId(filterId);
    const ops = items.map(({ id, displayOrder }) => ({
      updateOne: {
        filter: { _id: id, filterId: fid, deletedAt: null },
        update: { $set: { displayOrder } },
      },
    }));
    return this.model.bulkWrite(ops, { ordered: false });
  }

  async listActiveByFilterIds(filterIds) {
    return this.findAll(
      {
        filterId: { $in: filterIds.map(toObjectId) },
        deletedAt: null,
        isActive: true,
      },
      { limit: 10000, sort: 'displayOrder', lean: true, select: LIST_SELECT },
    );
  }
}
