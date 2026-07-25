import { BaseRepository } from '../../common/base/BaseRepository.js';
import { buildSearchFilter } from '../../common/helpers/list-query.helper.js';

const LIST_SELECT = '-__v';

export class FilterRepository extends BaseRepository {
  constructor(filterModel) {
    super(filterModel);
  }

  async findByIdAny(id) {
    return this.findOne({ _id: id }, { lean: true, select: LIST_SELECT });
  }

  async findActiveById(id) {
    return this.findOne({ _id: id, deletedAt: null }, { lean: true, select: LIST_SELECT });
  }

  async findBySlug(slug, { excludeId = null } = {}) {
    const filter = { slug, deletedAt: null };
    if (excludeId) filter._id = { $ne: excludeId };
    return this.findOne(filter, { lean: true, select: LIST_SELECT });
  }

  buildAdminFilter(query = {}) {
    const filter = {};
    if (!query.includeDeleted) filter.deletedAt = null;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.isFeatured !== undefined) filter.isFeatured = query.isFeatured;
    if (query.scope) {
      filter.$or = [{ scopes: query.scope }, { scopes: { $size: 0 } }, { scopes: null }];
    }
    const search = buildSearchFilter(query.search, ['name', 'slug', 'description']);
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

  /**
   * Slim public aggregation: active groups + active values, projected fields only.
   */
  async listPublicSlim(scope = null) {
    const match = { deletedAt: null, isActive: true };
    if (scope) {
      match.$or = [{ scopes: scope }, { scopes: { $size: 0 } }];
    }

    const rows = await this.model
      .aggregate([
        { $match: match },
        { $sort: { displayOrder: 1, name: 1 } },
        {
          $lookup: {
            from: 'filter_values',
            let: { filterId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$filterId', '$$filterId'] },
                  deletedAt: null,
                  isActive: true,
                },
              },
              { $sort: { displayOrder: 1, label: 1 } },
              {
                $project: {
                  _id: 0,
                  id: { $toString: '$_id' },
                  label: 1,
                  value: 1,
                  displayOrder: 1,
                  isDefault: 1,
                  icon: { $ifNull: ['$icon', null] },
                },
              },
            ],
            as: 'values',
          },
        },
        {
          $project: {
            _id: 0,
            id: { $toString: '$_id' },
            name: 1,
            slug: 1,
            displayType: 1,
            selectionType: 1,
            isRequired: 1,
            displayOrder: 1,
            values: 1,
          },
        },
      ])
      .exec();

    return rows;
  }
}
