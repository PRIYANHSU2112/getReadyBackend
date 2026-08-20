import { BaseRepository } from '../../common/base/BaseRepository.js';
import { HygieneKitStatus } from '../../common/constants/enums.js';
import {
  HYGIENE_KIT_ADMIN_SELECT,
  HYGIENE_KIT_PUBLIC_SELECT,
  DEFAULT_HYGIENE_KIT_SORT,
} from '../../common/constants/hygiene-kit.js';

export class HygieneKitRepository extends BaseRepository {
  constructor(hygieneKitModel) {
    super(hygieneKitModel);
  }

  /**
   * Find the single active default hygiene kit for cart and checkout calculations.
   */
  async findDefaultActive() {
    return this.model
      .findOne({
        status: HygieneKitStatus.ACTIVE,
        deletedAt: null,
        isDefault: true,
      })
      .select(HYGIENE_KIT_PUBLIC_SELECT)
      .lean()
      .exec();
  }

  /**
   * Find an active hygiene kit by ID.
   * @param {string} id
   */
  async findActiveById(id) {
    return this.model
      .findOne({
        _id: id,
        status: HygieneKitStatus.ACTIVE,
        deletedAt: null,
      })
      .select(HYGIENE_KIT_PUBLIC_SELECT)
      .lean()
      .exec();
  }

  /**
   * Find hygiene kit by unique code.
   * @param {string} code
   */
  async findByCode(code) {
    if (!code) return null;
    return this.model
      .findOne({ code: code.toUpperCase(), deletedAt: null })
      .select(HYGIENE_KIT_ADMIN_SELECT)
      .lean()
      .exec();
  }

  /**
   * Unset isDefault from all other hygiene kits when a new default is assigned.
   * @param {string} [excludeId]
   */
  async clearOtherDefaults(excludeId = null) {
    const filter = { isDefault: true };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    return this.model.updateMany(filter, { $set: { isDefault: false } }).exec();
  }

  /**
   * Build admin query filter.
   * @param {Record<string, any>} query
   */
  buildAdminFilter(query = {}) {
    const filter = { deletedAt: null };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.isDefault !== undefined) {
      filter.isDefault =
        query.isDefault === true ||
        query.isDefault === 'true' ||
        query.isDefault === 1 ||
        query.isDefault === '1';
    }

    if (query.search) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ title: regex }, { code: regex }, { description: regex }];
    }

    return filter;
  }

  /**
   * Paginated admin list.
   * @param {object} filter
   * @param {object} options
   */
  async listAdmin(filter, options = {}) {
    return this.findAndCount(filter, {
      skip: options.skip ?? 0,
      limit: options.limit ?? 10,
      sort: options.sort || DEFAULT_HYGIENE_KIT_SORT,
      select: HYGIENE_KIT_ADMIN_SELECT,
    });
  }

  /**
   * Paginated public active list.
   * @param {object} [filter]
   * @param {object} [options]
   */
  async listActivePublic(filter = {}, options = {}) {
    const publicFilter = {
      deletedAt: null,
      status: HygieneKitStatus.ACTIVE,
      ...filter,
    };

    return this.findAndCount(publicFilter, {
      skip: options.skip ?? 0,
      limit: options.limit ?? 20,
      sort: options.sort || DEFAULT_HYGIENE_KIT_SORT,
      select: HYGIENE_KIT_PUBLIC_SELECT,
    });
  }

  /**
   * Soft delete kit.
   * @param {string} id
   */
  async softDelete(id) {
    return this.model
      .findOneAndUpdate(
        { _id: id, deletedAt: null },
        {
          $set: {
            deletedAt: new Date(),
            status: HygieneKitStatus.INACTIVE,
            isDefault: false,
          },
        },
        { new: true },
      )
      .select(HYGIENE_KIT_ADMIN_SELECT)
      .lean()
      .exec();
  }

  /**
   * Restore soft-deleted kit.
   * @param {string} id
   */
  async restore(id) {
    return this.model
      .findOneAndUpdate(
        { _id: id, deletedAt: { $ne: null } },
        {
          $set: {
            deletedAt: null,
            status: HygieneKitStatus.ACTIVE,
          },
        },
        { new: true },
      )
      .select(HYGIENE_KIT_ADMIN_SELECT)
      .lean()
      .exec();
  }
}
