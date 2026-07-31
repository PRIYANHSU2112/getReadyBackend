import mongoose from 'mongoose';
import { BaseRepository } from '../../common/base/BaseRepository.js';
import { PackageStatus, PackageChangeRequestStatus } from './package.enum.js';

export class PackageRepository extends BaseRepository {
  constructor(packageModel, changeRequestModel) {
    super(packageModel);
    this.changeRequestModel = changeRequestModel;
  }

  get PUBLIC_PROJECT() {
    return {
      _id: 1,
      id: '$_id',
      name: 1,
      slug: 1,
      badgeTag: 1,
      shortDescription: 1,
      packageType: 1,
      minSelectCount: 1,
      maxSelectCount: 1,
      selectionNotice: 1,
      items: 1,
      categoryIds: 1,
      thumbnail: 1,
      images: 1,
      durationMinMinutes: 1,
      durationMaxMinutes: 1,
      originalPrice: 1,
      price: 1,
      discountType: 1,
      discountValue: 1,
      discountedPrice: 1,
      badges: 1,
      ratingAvg: 1,
      ratingCount: 1,
      bookingCount: 1,
      socialProofText: 1,
      gender: 1,
      isPopular: 1,
      isTrending: 1,
      isFeatured: 1,
      isHomeServiceAvailable: 1,
      displayOrder: 1,
      createdAt: 1,
    };
  }

  buildPublicMatch(filter = {}) {
    const match = {
      status: PackageStatus.APPROVED,
      isActive: true,
      deletedAt: null,
    };

    if (filter.categoryId) {
      match.categoryIds = new mongoose.Types.ObjectId(filter.categoryId);
    }
    if (filter.gender && filter.gender !== 'all') {
      match.gender = { $in: [filter.gender, 'all'] };
    }
    if (filter.packageType) {
      match.packageType = filter.packageType;
    }
    if (filter.isPopular) match.isPopular = true;
    if (filter.isTrending) match.isTrending = true;
    if (filter.isFeatured) match.isFeatured = true;
    if (filter.isHomeServiceAvailable !== undefined) {
      match.isHomeServiceAvailable = filter.isHomeServiceAvailable;
    }

    if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
      match.price = {};
      if (filter.minPrice !== undefined) match.price.$gte = filter.minPrice;
      if (filter.maxPrice !== undefined) match.price.$lte = filter.maxPrice;
    }

    if (filter.minRating !== undefined) {
      match.ratingAvg = { $gte: filter.minRating };
    }

    if (filter.search || filter.q) {
      const term = (filter.search || filter.q).trim();
      match.$or = [
        { name: { $regex: term, $options: 'i' } },
        { shortDescription: { $regex: term, $options: 'i' } },
        { badgeTag: { $regex: term, $options: 'i' } },
      ];
    }

    return match;
  }

  buildSortStage(sortKey) {
    switch (sortKey) {
      case 'price_asc':
        return { price: 1, _id: 1 };
      case 'price_desc':
        return { price: -1, _id: 1 };
      case 'rating':
        return { ratingAvg: -1, ratingCount: -1, _id: 1 };
      case 'popular':
        return { isPopular: -1, bookingCount: -1, _id: 1 };
      case 'newest':
        return { createdAt: -1, _id: 1 };
      case 'displayOrder':
      default:
        return { displayOrder: 1, _id: 1 };
    }
  }

  async listPublicSlim(filter = {}, { skip = 0, limit = 10, sort = 'displayOrder' } = {}) {
    const match = this.buildPublicMatch(filter);
    const sortStage = this.buildSortStage(sort);

    const pipeline = [
      { $match: match },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          items: [
            { $sort: sortStage },
            { $skip: skip },
            { $limit: limit },
            { $project: this.PUBLIC_PROJECT },
          ],
        },
      },
    ];

    const results = await this.model.aggregate(pipeline);
    const facet = results[0] || {};
    const total = facet.metadata && facet.metadata[0] ? facet.metadata[0].total : 0;
    const items = facet.items || [];

    return { items, total };
  }

  async countPublic(filter = {}) {
    const match = this.buildPublicMatch(filter);
    return this.model.countDocuments(match);
  }

  async findPublicBySlug(slug) {
    return this.model
      .findOne({
        slug: slug.toLowerCase(),
        status: PackageStatus.APPROVED,
        isActive: true,
        deletedAt: null,
      })
      .populate('items.serviceId', 'name slug shortDescription price durationMinMinutes thumbnail')
      .populate('items.categoryId', 'name slug icon')
      .lean();
  }

  async findPublicById(id) {
    return this.model
      .findOne({
        _id: id,
        status: PackageStatus.APPROVED,
        isActive: true,
        deletedAt: null,
      })
      .populate('items.serviceId', 'name slug shortDescription price durationMinMinutes thumbnail')
      .populate('items.categoryId', 'name slug icon')
      .lean();
  }

  async listAdmin(filter = {}, { skip = 0, limit = 10, sort = '-createdAt' } = {}) {
    const match = { deletedAt: null };

    if (filter.status) match.status = filter.status;
    if (filter.gender) match.gender = filter.gender;
    if (filter.packageType) match.packageType = filter.packageType;
    if (filter.search) {
      match.name = { $regex: filter.search.trim(), $options: 'i' };
    }

    const total = await this.model.countDocuments(match);
    const items = await this.model
      .find(match)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name email role')
      .lean();

    return { items, total };
  }

  // --- Change Request Methods ---
  async createChangeRequest(payload) {
    return this.changeRequestModel.create(payload);
  }

  async findChangeRequestById(id) {
    return this.changeRequestModel
      .findById(id)
      .populate('requestedBy', 'name email role')
      .populate('packageId')
      .lean();
  }

  async listChangeRequests(filter = {}, { skip = 0, limit = 10 } = {}) {
    const query = {};
    if (filter.status) query.status = filter.status;
    if (filter.packageId) query.packageId = filter.packageId;

    const total = await this.changeRequestModel.countDocuments(query);
    const items = await this.changeRequestModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('requestedBy', 'name email role')
      .populate('packageId', 'name slug status price approxPrice')
      .lean();

    return { items, total };
  }

  async updateChangeRequestStatus(id, status, extraFields = {}) {
    return this.changeRequestModel.findByIdAndUpdate(
      id,
      { $set: { status, ...extraFields } },
      { new: true },
    );
  }
}
