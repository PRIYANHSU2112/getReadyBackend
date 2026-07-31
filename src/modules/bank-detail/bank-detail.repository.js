import { BaseRepository } from '../../common/base/BaseRepository.js';

const LIST_SELECT = '-__v';

export class BankDetailRepository extends BaseRepository {
  constructor(model) {
    super(model);
  }

  #toSortObject(sort) {
    if (!sort) return { createdAt: -1 };
    if (typeof sort === 'object') return sort;
    const out = {};
    for (const part of String(sort).split(/\s+/).filter(Boolean)) {
      if (part.startsWith('-')) out[part.slice(1)] = -1;
      else out[part] = 1;
    }
    return out;
  }

  async findByUserId(userId) {
    return this.model.findOne({ userId, deletedAt: null }).select(LIST_SELECT).lean().exec();
  }

  async findByProfileId(beauticianProfileId) {
    return this.model
      .findOne({ beauticianProfileId, deletedAt: null })
      .select(LIST_SELECT)
      .lean()
      .exec();
  }

  async updateByUserId(userId, data) {
    return this.model
      .findOneAndUpdate(
        { userId, deletedAt: null },
        { $set: data },
        { new: true, runValidators: true },
      )
      .select(LIST_SELECT)
      .lean()
      .exec();
  }

  /**
   * Admin list aggregation pipeline joining User details.
   */
  async listAdminWithDetails(filter = {}, options = {}) {
    const { skip = 0, limit = 10, sort = '-createdAt' } = options;
    const sortObj = this.#toSortObject(sort);

    const [result] = await this.model
      .aggregate([
        { $match: filter },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'userInfo',
          },
        },
        {
          $facet: {
            items: [
              { $sort: Object.keys(sortObj).length ? sortObj : { createdAt: -1 } },
              { $skip: skip },
              { $limit: limit },
              {
                $project: {
                  _id: 0,
                  id: { $toString: '$_id' },
                  userId: {
                    $let: {
                      vars: { u: { $arrayElemAt: ['$userInfo', 0] } },
                      in: {
                        id: { $toString: '$$u._id' },
                        name: '$$u.name',
                        email: '$$u.email',
                        phone: '$$u.phone',
                      },
                    },
                  },
                  beauticianProfileId: { $toString: '$beauticianProfileId' },
                  accountHolderName: 1,
                  accountNumber: 1,
                  ifscCode: 1,
                  bankName: 1,
                  branchName: 1,
                  passbookImage: 1,
                  upiId: 1,
                  status: 1,
                  rejectionReason: 1,
                  createdAt: 1,
                },
              },
            ],
            total: [{ $count: 'n' }],
          },
        },
      ])
      .exec();

    return {
      items: result?.items || [],
      total: result?.total?.[0]?.n || 0,
    };
  }

  async findPendingVerification(options = {}) {
    const filter = { status: 'PENDING', deletedAt: null };
    return this.listAdminWithDetails(filter, options);
  }
}
