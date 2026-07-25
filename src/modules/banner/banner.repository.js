import mongoose from 'mongoose';
import { BaseRepository } from '../../common/base/BaseRepository.js';
import { BannerStatus, BannerPlatform } from '../../common/constants/enums.js';
import { BANNER_PUBLIC_SELECT } from '../../common/constants/banner.js';

const LIST_SELECT = '-__v';

function toObjectId(id) {
  if (!id) return id;
  if (id instanceof mongoose.Types.ObjectId) return id;
  return new mongoose.Types.ObjectId(id);
}

export class BannerRepository extends BaseRepository {
  constructor(bannerModel) {
    super(bannerModel);
  }

  async findActiveById(id) {
    return this.findOne({ _id: id, deletedAt: null }, { lean: true, select: LIST_SELECT });
  }

  async countActiveAtPosition(position) {
    return this.count({
      position,
      deletedAt: null,
      status: BannerStatus.ACTIVE,
    });
  }

  /**
   * Admin list filter builder.
   */
  buildAdminFilter(query = {}) {
    const filter = { deletedAt: null };
    if (query.position !== undefined) filter.position = Number(query.position);
    if (query.serviceCategory) filter.serviceCategory = query.serviceCategory;
    if (query.serviceId) filter.serviceIds = toObjectId(query.serviceId);
    if (query.platform) filter.platform = query.platform;
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;
    return filter;
  }

  /**
   * Public active + in-window filter.
   */
  buildActiveFilter(query = {}, now = new Date()) {
    const filter = {
      deletedAt: null,
      status: BannerStatus.ACTIVE,
      $and: [
        { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
        { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
      ],
    };

    if (query.position !== undefined) filter.position = Number(query.position);
    if (query.serviceCategory) filter.serviceCategory = query.serviceCategory;
    if (query.serviceId) filter.serviceIds = toObjectId(query.serviceId);
    if (query.type) filter.type = query.type;

    if (query.platform && query.platform !== BannerPlatform.ALL) {
      filter.platform = { $in: [BannerPlatform.ALL, query.platform] };
    }

    return filter;
  }

  async listAdmin(filter, options = {}) {
    return this.findAndCount(filter, {
      skip: options.skip ?? 0,
      limit: options.limit ?? 10,
      sort: options.sort || 'sortOrder',
      select: LIST_SELECT,
    });
  }

  async listActivePublic(filter, options = {}) {
    return this.findAndCount(filter, {
      skip: options.skip ?? 0,
      limit: options.limit ?? 10,
      sort: options.sort || 'sortOrder',
      select: BANNER_PUBLIC_SELECT,
    });
  }

  async softDelete(id) {
    return this.model
      .findOneAndUpdate(
        { _id: id, deletedAt: null },
        { $set: { deletedAt: new Date(), status: BannerStatus.INACTIVE } },
        { new: true },
      )
      .select(LIST_SELECT)
      .lean()
      .exec();
  }
}
