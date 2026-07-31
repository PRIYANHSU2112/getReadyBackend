import mongoose from 'mongoose';
import { BaseRepository } from '../../common/base/BaseRepository.js';

const LIST_SELECT = '-__v';

export class BeauticianProfileRepository extends BaseRepository {
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

  /**
   * Single-query Aggregation Pipeline joining users, skills, work_histories, and certificates.
   */
  async findFullProfileAggregateByUserId(userId) {
    const userObjectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
    const rows = await this.model
      .aggregate([
        { $match: { userId: userObjectId, deletedAt: null } },
        { $limit: 1 },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'userInfo',
          },
        },
        {
          $lookup: {
            from: 'skills',
            localField: 'skills',
            foreignField: '_id',
            as: 'skillsInfo',
          },
        },
        {
          $lookup: {
            from: 'work_histories',
            let: { bpId: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$beauticianProfileId', '$$bpId'] }, deletedAt: null } },
              { $sort: { startDate: -1 } },
            ],
            as: 'workHistory',
          },
        },
        {
          $lookup: {
            from: 'certificates',
            let: { bpId: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$beauticianProfileId', '$$bpId'] }, deletedAt: null } },
              { $sort: { issueDate: -1 } },
            ],
            as: 'certificates',
          },
        },
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
                  profileImage: '$$u.profileImage',
                  gender: '$$u.gender',
                  dob: '$$u.dob',
                },
              },
            },
            languages: 1,
            bio: { $ifNull: ['$bio', null] },
            skills: {
              $map: {
                input: '$skillsInfo',
                as: 's',
                in: {
                  id: { $toString: '$$s._id' },
                  name: '$$s.name',
                  icon: { $ifNull: ['$$s.icon', null] },
                },
              },
            },
            yearsOfExperience: { $ifNull: ['$yearsOfExperience', null] },
            preferredHours: 1,
            ratingAvg: 1,
            ratingCount: 1,
            kyc: {
              status: '$kyc.status',
              rejectionReason: { $ifNull: ['$kyc.rejectionReason', null] },
              verifiedBy: { $ifNull: ['$kyc.verifiedBy', null] },
              verifiedAt: { $ifNull: ['$kyc.verifiedAt', null] },
              selfieImage: '$kyc.selfieImage',
              idCardFront: '$kyc.idCardFront',
              idCardBack: '$kyc.idCardBack',
            },
            profileStatus: 1,
            rejectionReason: { $ifNull: ['$rejectionReason', null] },
            reviewedBy: { $ifNull: ['$reviewedBy', null] },
            reviewedAt: { $ifNull: ['$reviewedAt', null] },
            submittedAt: { $ifNull: ['$submittedAt', null] },
            isActive: 1,
            createdAt: 1,
            updatedAt: 1,
            workHistory: {
              $map: {
                input: '$workHistory',
                as: 'w',
                in: {
                  id: { $toString: '$$w._id' },
                  salonName: '$$w.salonName',
                  role: { $ifNull: ['$$w.role', null] },
                  startDate: '$$w.startDate',
                  endDate: { $ifNull: ['$$w.endDate', null] },
                  isCurrent: '$$w.isCurrent',
                },
              },
            },
            certificates: {
              $map: {
                input: '$certificates',
                as: 'c',
                in: {
                  id: { $toString: '$$c._id' },
                  title: '$$c.title',
                  issueDate: { $ifNull: ['$$c.issueDate', null] },
                  certificateImage: '$$c.certificateImage',
                  status: '$$c.status',
                  rejectionReason: { $ifNull: ['$$c.rejectionReason', null] },
                },
              },
            },
          },
        },
      ])
      .exec();

    return rows[0] || null;
  }

  /**
   * Single-query Aggregation Pipeline joining profile details by profile _id.
   */
  async findFullProfileAggregateById(id) {
    const profileObjectId = typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
    const rows = await this.model
      .aggregate([
        { $match: { _id: profileObjectId, deletedAt: null } },
        { $limit: 1 },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'userInfo',
          },
        },
        {
          $lookup: {
            from: 'skills',
            localField: 'skills',
            foreignField: '_id',
            as: 'skillsInfo',
          },
        },
        {
          $lookup: {
            from: 'work_histories',
            let: { bpId: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$beauticianProfileId', '$$bpId'] }, deletedAt: null } },
              { $sort: { startDate: -1 } },
            ],
            as: 'workHistory',
          },
        },
        {
          $lookup: {
            from: 'certificates',
            let: { bpId: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$beauticianProfileId', '$$bpId'] }, deletedAt: null } },
              { $sort: { issueDate: -1 } },
            ],
            as: 'certificates',
          },
        },
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
                  profileImage: '$$u.profileImage',
                  gender: '$$u.gender',
                  dob: '$$u.dob',
                },
              },
            },
            languages: 1,
            bio: { $ifNull: ['$bio', null] },
            skills: {
              $map: {
                input: '$skillsInfo',
                as: 's',
                in: {
                  id: { $toString: '$$s._id' },
                  name: '$$s.name',
                  icon: { $ifNull: ['$$s.icon', null] },
                },
              },
            },
            yearsOfExperience: { $ifNull: ['$yearsOfExperience', null] },
            preferredHours: 1,
            ratingAvg: 1,
            ratingCount: 1,
            kyc: {
              status: '$kyc.status',
              rejectionReason: { $ifNull: ['$kyc.rejectionReason', null] },
              verifiedBy: { $ifNull: ['$kyc.verifiedBy', null] },
              verifiedAt: { $ifNull: ['$kyc.verifiedAt', null] },
              selfieImage: '$kyc.selfieImage',
              idCardFront: '$kyc.idCardFront',
              idCardBack: '$kyc.idCardBack',
            },
            profileStatus: 1,
            rejectionReason: { $ifNull: ['$rejectionReason', null] },
            reviewedBy: { $ifNull: ['$reviewedBy', null] },
            reviewedAt: { $ifNull: ['$reviewedAt', null] },
            submittedAt: { $ifNull: ['$submittedAt', null] },
            isActive: 1,
            createdAt: 1,
            updatedAt: 1,
            workHistory: {
              $map: {
                input: '$workHistory',
                as: 'w',
                in: {
                  id: { $toString: '$$w._id' },
                  salonName: '$$w.salonName',
                  role: { $ifNull: ['$$w.role', null] },
                  startDate: '$$w.startDate',
                  endDate: { $ifNull: ['$$w.endDate', null] },
                  isCurrent: '$$w.isCurrent',
                },
              },
            },
            certificates: {
              $map: {
                input: '$certificates',
                as: 'c',
                in: {
                  id: { $toString: '$$c._id' },
                  title: '$$c.title',
                  issueDate: { $ifNull: ['$$c.issueDate', null] },
                  certificateImage: '$$c.certificateImage',
                  status: '$$c.status',
                  rejectionReason: { $ifNull: ['$$c.rejectionReason', null] },
                },
              },
            },
          },
        },
      ])
      .exec();

    return rows[0] || null;
  }

  async updateByUserId(userId, data) {
    return this.model
      .findOneAndUpdate({ userId, deletedAt: null }, { $set: data }, { new: true, runValidators: true })
      .select(LIST_SELECT)
      .lean()
      .exec();
  }

  buildAdminFilter(query = {}) {
    const filter = { deletedAt: null };
    if (query.profileStatus) filter.profileStatus = query.profileStatus;
    if (query.kycStatus) filter['kyc.status'] = query.kycStatus;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    return filter;
  }

  /**
   * Admin listing aggregation pipeline with single-roundtrip $lookup for User & Skill details.
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
          $lookup: {
            from: 'skills',
            localField: 'skills',
            foreignField: '_id',
            as: 'skillsInfo',
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
                        profileImage: '$$u.profileImage',
                        gender: '$$u.gender',
                      },
                    },
                  },
                  languages: 1,
                  bio: 1,
                  skills: {
                    $map: {
                      input: '$skillsInfo',
                      as: 's',
                      in: {
                        id: { $toString: '$$s._id' },
                        name: '$$s.name',
                        icon: '$$s.icon',
                      },
                    },
                  },
                  yearsOfExperience: 1,
                  preferredHours: 1,
                  ratingAvg: 1,
                  ratingCount: 1,
                  kyc: {
                    status: '$kyc.status',
                    rejectionReason: '$kyc.rejectionReason',
                    selfieImage: '$kyc.selfieImage',
                    idCardFront: '$kyc.idCardFront',
                    idCardBack: '$kyc.idCardBack',
                  },
                  profileStatus: 1,
                  submittedAt: 1,
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

  async findPendingReview(options = {}) {
    const filter = {
      profileStatus: 'UNDER_REVIEW',
      isActive: true,
      deletedAt: null,
    };
    return this.listAdminWithDetails(filter, options);
  }
}

export class WorkHistoryRepository extends BaseRepository {
  constructor(model) {
    super(model);
  }

  async findByProfile(beauticianProfileId) {
    return this.model
      .find({ beauticianProfileId, deletedAt: null })
      .sort('-startDate')
      .select(LIST_SELECT)
      .lean()
      .exec();
  }

  async findByUserId(userId) {
    return this.model
      .find({ userId, deletedAt: null })
      .sort('-startDate')
      .select(LIST_SELECT)
      .lean()
      .exec();
  }
}

export class CertificateRepository extends BaseRepository {
  constructor(model) {
    super(model);
  }

  async findByProfile(beauticianProfileId) {
    return this.model
      .find({ beauticianProfileId, deletedAt: null })
      .sort('-issueDate')
      .select(LIST_SELECT)
      .lean()
      .exec();
  }

  async findByUserId(userId) {
    return this.model
      .find({ userId, deletedAt: null })
      .sort('-issueDate')
      .select(LIST_SELECT)
      .lean()
      .exec();
  }

  async findPendingVerification(options = {}) {
    const filter = { status: 'PENDING', deletedAt: null };
    return this.findAndCount(filter, { sort: 'createdAt', select: LIST_SELECT, ...options });
  }
}
