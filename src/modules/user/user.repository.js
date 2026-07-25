import { BaseRepository } from '../../common/base/BaseRepository.js';
import {
  buildSearchFilter,
  buildDateRangeFilter,
} from '../../common/helpers/list-query.helper.js';

const LIST_SELECT =
  '-password -__v -fcmToken';

export class UserRepository extends BaseRepository {
  constructor(userModel) {
    super(userModel);
  }

  async findByPhone(phone, { role, includePassword = false, lean = true, includeDeleted = false } = {}) {
    if (!phone) return null;
    const filter = { phone };
    if (!includeDeleted) filter.deletedAt = null;
    // Phone is globally unique — only filter by role when looking up for login, not uniqueness.
    if (role) filter.role = role;
    let query = this.model.findOne(filter);
    if (includePassword) query = query.select('+password');
    if (lean) query = query.lean();
    return query.exec();
  }

  async findByEmail(email, { includePassword = false, lean = true, includeDeleted = false } = {}) {
    if (!email) return null;
    const filter = { email: email.toLowerCase() };
    if (!includeDeleted) filter.deletedAt = null;
    let query = this.model.findOne(filter);
    if (includePassword) query = query.select('+password');
    if (lean) query = query.lean();
    return query.exec();
  }

  /**
   * Soft-delete and release unique fields so email/phone can be reused.
   * Use $unset (not null) — Mongo unique indexes treat multiple nulls as one value.
   */
  async softDelete(id) {
    return this.model
      .findByIdAndUpdate(
        id,
        {
          $set: {
            deletedAt: new Date(),
            isActive: false,
            fcmToken: null,
          },
          $unset: {
            email: 1,
            phone: 1,
            referralCode: 1,
          },
        },
        { new: true },
      )
      .lean()
      .exec();
  }

  async findByReferralCode(code) {
    if (!code) return null;
    return this.model
      .findOne({ referralCode: code.toUpperCase().trim(), deletedAt: null, isActive: true })
      .lean()
      .exec();
  }

  async findActiveById(id, { select = LIST_SELECT } = {}) {
    return this.findOne({ _id: id, deletedAt: null, isActive: true }, { select, lean: true });
  }

  buildListFilter(query) {
    const filter = { deletedAt: null };

    if (query.role) filter.role = query.role;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.gender) filter.gender = query.gender;

    if (query.hasReferral === true) filter.referredBy = { $ne: null };
    if (query.hasReferral === false) filter.referredBy = null;

    const createdRange = buildDateRangeFilter(query.createdFrom, query.createdTo);
    if (createdRange) filter.createdAt = createdRange;

    const searchFilter = buildSearchFilter(query.search, [
      'name',
      'email',
      'phone',
      'referralCode',
    ]);
    if (searchFilter) {
      filter.$and = filter.$and || [];
      filter.$and.push(searchFilter);
    }

    return filter;
  }

  async search(filter, options) {
    return this.findAll(
      { ...filter, deletedAt: null },
      { ...options, lean: true, select: options.select || LIST_SELECT },
    );
  }

  async searchAndCount(filter, options = {}) {
    return this.findAndCount(
      { ...filter, deletedAt: null },
      { ...options, select: options.select || LIST_SELECT },
    );
  }

  async countActive(filter = {}) {
    return this.count({ ...filter, deletedAt: null });
  }
}
