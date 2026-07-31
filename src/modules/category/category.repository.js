import { BaseRepository } from '../../common/base/BaseRepository.js';
import { buildSearchFilter } from '../../common/helpers/list-query.helper.js';

const LIST_SELECT = '-__v';

const PUBLIC_PROJECT = {
  _id: 0,
  id: { $toString: '$_id' },
  name: 1,
  slug: 1,
  description: { $ifNull: ['$description', null] },
  image: {
    url: { $ifNull: ['$image.url', null] },
    publicId: { $ifNull: ['$image.publicId', null] },
  },
  icon: { $ifNull: ['$icon', null] },
  color: { $ifNull: ['$color', null] },
  displayOrder: 1,
  isFeatured: 1,
  defaultPriceRange: {
    min: { $ifNull: ['$defaultPriceRange.min', null] },
    max: { $ifNull: ['$defaultPriceRange.max', null] },
  },
};

export class CategoryRepository extends BaseRepository {
  constructor(categoryModel) {
    super(categoryModel);
  }

  async findByIdAny(id) {
    return this.findOne({ _id: id }, { lean: true, select: LIST_SELECT });
  }

  async findActiveById(id) {
    return this.findOne(
      { _id: id, deletedAt: null },
      { lean: true, select: LIST_SELECT },
    );
  }

  async findBySlug(slug, { excludeId = null, activeOnly = false } = {}) {
    const filter = { slug, deletedAt: null };
    if (activeOnly) filter.isActive = true;
    if (excludeId) filter._id = { $ne: excludeId };
    return this.findOne(filter, { lean: true, select: LIST_SELECT });
  }

  buildAdminFilter(query = {}) {
    const filter = {};
    if (!query.includeDeleted) filter.deletedAt = null;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.isFeatured !== undefined) filter.isFeatured = query.isFeatured;
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
   * Slim public list: active categories only, projected fields.
   * @param {{ featured?: boolean }} [opts]
   */
  async listPublicSlim({ featured } = {}) {
    const match = { deletedAt: null, isActive: true };
    if (featured === true) match.isFeatured = true;

    return this.model
      .aggregate([
        { $match: match },
        { $sort: { displayOrder: 1, name: 1 } },
        { $project: PUBLIC_PROJECT },
      ])
      .exec();
  }

  /**
   * Slim public get by slug.
   */
  async findPublicBySlug(slug) {
    const rows = await this.model
      .aggregate([
        {
          $match: {
            slug,
            deletedAt: null,
            isActive: true,
          },
        },
        { $limit: 1 },
        { $project: PUBLIC_PROJECT },
      ])
      .exec();
    return rows[0] || null;
  }
}
