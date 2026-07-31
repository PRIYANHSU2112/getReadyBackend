import mongoose from 'mongoose';
import { BaseRepository } from '../../common/base/BaseRepository.js';
import { buildSearchFilter } from '../../common/helpers/list-query.helper.js';
import { ServiceStatus } from '../../common/constants/enums.js';

const LIST_SELECT = '-__v';

const PUBLIC_PROJECT = {
  _id: 0,
  id: { $toString: '$_id' },
  name: 1,
  slug: 1,
  shortDescription: { $ifNull: ['$shortDescription', null] },
  description: { $ifNull: ['$description', null] },
  categoryId: { $toString: '$categoryId' },
  images: 1,
  thumbnail: 1,
  video: 1,
  durationMinMinutes: { $ifNull: ['$durationMinMinutes', null] },
  durationMaxMinutes: { $ifNull: ['$durationMaxMinutes', null] },
  price: 1,
  discountType: 1,
  discountValue: 1,
  discountedPrice: { $ifNull: ['$discountedPrice', null] },
  badges: 1,
  isPopular: 1,
  isTrending: 1,
  isFeatured: 1,
  inclusions: 1,
  isHomeServiceAvailable: 1,
  homeVisitFee: 1,
  rewardPointsMultiplier: 1,
  ratingAvg: 1,
  ratingCount: 1,
  tags: 1,
  gender: 1,
  displayOrder: 1,
};

export class ServiceRepository extends BaseRepository {
  constructor(serviceModel) {
    super(serviceModel);
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

  async findBySlug(slug, { excludeId = null } = {}) {
    const filter = { slug, deletedAt: null };
    if (excludeId) filter._id = { $ne: excludeId };
    return this.findOne(filter, { lean: true, select: LIST_SELECT });
  }

  buildAdminFilter(query = {}, { createdBy = null } = {}) {
    const filter = {};
    if (!query.includeDeleted) filter.deletedAt = null;
    if (createdBy) filter.createdBy = createdBy;
    if (query.status) filter.status = query.status;
    if (query.categoryId) filter.categoryId = query.categoryId;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.isFeatured !== undefined) filter.isFeatured = query.isFeatured;
    if (query.isPopular !== undefined) filter.isPopular = query.isPopular;
    if (query.isTrending !== undefined) filter.isTrending = query.isTrending;
    if (query.gender) filter.gender = query.gender;
    if (query.tag) filter.tags = query.tag;
    const search = buildSearchFilter(query.search, [
      'name',
      'slug',
      'shortDescription',
      'tags',
    ]);
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

  buildPublicMatch(query = {}) {
    const match = {
      deletedAt: null,
      isActive: true,
      status: ServiceStatus.APPROVED,
      price: { $ne: null },
    };

    if (query.categoryId) {
      match.categoryId =
        typeof query.categoryId === 'string'
          ? new mongoose.Types.ObjectId(query.categoryId)
          : query.categoryId;
    }
    if (query.featured === true) match.isFeatured = true;
    if (query.popular === true) match.isPopular = true;
    if (query.trending === true) match.isTrending = true;
    if (query.isHomeServiceAvailable === true) match.isHomeServiceAvailable = true;
    if (query.gender) match.gender = query.gender;
    if (query.tag) match.tags = query.tag;
    if (query.minRating != null) match.ratingAvg = { $gte: Number(query.minRating) };

    const andConditions = [];

    if (query.minPrice != null || query.maxPrice != null) {
      const priceFilter = {};
      if (query.minPrice != null) priceFilter.$gte = Number(query.minPrice);
      if (query.maxPrice != null) priceFilter.$lte = Number(query.maxPrice);

      andConditions.push({
        $or: [
          { discountedPrice: { $ne: null, ...priceFilter } },
          { discountedPrice: null, price: priceFilter },
        ],
      });
    }

    const searchStr = (query.search || query.q || '').trim();
    if (searchStr) {
      const searchRegex = new RegExp(
        searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );
      andConditions.push({
        $or: [
          { name: searchRegex },
          { slug: searchRegex },
          { shortDescription: searchRegex },
          { tags: searchRegex },
        ],
      });
    }

    if (andConditions.length === 1) {
      Object.assign(match, andConditions[0]);
    } else if (andConditions.length > 1) {
      match.$and = andConditions;
    }

    return match;
  }

  buildPublicSort(sortKey) {
    switch (sortKey) {
      case 'price_asc':
      case 'price-asc':
        return { price: 1, displayOrder: 1 };
      case 'price_desc':
      case 'price-desc':
        return { price: -1, displayOrder: 1 };
      case 'rating':
      case 'rating_desc':
        return { ratingAvg: -1, ratingCount: -1, displayOrder: 1 };
      case 'popular':
        return { isPopular: -1, ratingAvg: -1, displayOrder: 1 };
      case 'newest':
      case 'created_at_desc':
        return { createdAt: -1 };
      case 'name':
        return { name: 1 };
      case 'displayOrder':
      default:
        return { displayOrder: 1, name: 1 };
    }
  }

  async listPublicSlim(query = {}, { skip = 0, limit = 20 } = {}) {
    const match = this.buildPublicMatch(query);
    const sortStage = this.buildPublicSort(query.sort);

    const pipeline = [
      { $match: match },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            { $sort: sortStage },
            { $skip: skip },
            { $limit: limit },
            { $project: PUBLIC_PROJECT },
          ],
        },
      },
    ];

    const [result] = await this.model.aggregate(pipeline).exec();
    const total = result?.metadata[0]?.total || 0;
    const items = result?.data || [];

    return { items, total };
  }

  async countPublic(query = {}) {
    return this.count(this.buildPublicMatch(query));
  }

  async findPublicBySlug(slug) {
    const rows = await this.model
      .aggregate([
        {
          $match: {
            slug,
            deletedAt: null,
            isActive: true,
            status: ServiceStatus.APPROVED,
            price: { $ne: null },
          },
        },
        { $limit: 1 },
        { $project: PUBLIC_PROJECT },
      ])
      .exec();
    return rows[0] || null;
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
