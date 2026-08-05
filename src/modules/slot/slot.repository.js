import { BaseRepository } from '../../common/base/BaseRepository.js';
import { SlotStatus } from '../../common/constants/enums.js';
import { DEFAULT_SLOT_SORT } from '../../common/constants/slot.js';

const LIST_SELECT = '-__v';

export class SlotRepository extends BaseRepository {
  constructor(model) {
    super(model);
  }

  async findByIdLean(id) {
    return this.findOne({ _id: id }, { lean: true, select: LIST_SELECT });
  }

  /**
   * Public available: all non-cancelled slots for a date (includes BLOCKED for FULL display).
   * Service decides availability flags.
   */
  async listByDate(date) {
    return this.model
      .find({
        date,
        status: { $in: [SlotStatus.ACTIVE, SlotStatus.BLOCKED, SlotStatus.COMPLETED] },
      })
      .sort({ startAt: 1 })
      .select(LIST_SELECT)
      .lean()
      .exec();
  }

  buildAdminFilter(query = {}) {
    const filter = {};
    if (query.date) filter.date = query.date;
    if (query.status) filter.status = query.status;
    if (query.beauticianId) filter.beauticianId = query.beauticianId;
    if (query.isBookable !== undefined) filter.isBookable = query.isBookable;
    return filter;
  }

  async listAdmin(filter, options = {}) {
    return this.findAndCount(filter, {
      skip: options.skip ?? 0,
      limit: options.limit ?? 20,
      sort: options.sort || DEFAULT_SLOT_SORT,
      select: LIST_SELECT,
    });
  }

  async createMany(docs) {
    return this.model.insertMany(docs, { ordered: true });
  }

  async softCancel(id, updatedBy = null) {
    return this.model
      .findOneAndUpdate(
        { _id: id, status: { $ne: SlotStatus.CANCELLED } },
        {
          $set: {
            status: SlotStatus.CANCELLED,
            isBookable: false,
            ...(updatedBy ? { updatedBy } : {}),
          },
        },
        { new: true },
      )
      .select(LIST_SELECT)
      .lean()
      .exec();
  }
}
