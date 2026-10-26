import mongoose from 'mongoose';
import {
  AttendanceModel,
  LeaveRequestModel,
  PayslipModel,
} from '../models/hrm.models.js';

export class AttendanceRepository {
  async findByProfileAndDate(beauticianProfileId, date) {
    return AttendanceModel.findOne({ beauticianProfileId, date }).lean();
  }

  async upsertByProfileAndDate(beauticianProfileId, date, data) {
    return AttendanceModel.findOneAndUpdate(
      { beauticianProfileId, date },
      { $set: data },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async findByProfile(beauticianProfileId, { month, year, page = 1, limit = 31 } = {}) {
    const filter = { beauticianProfileId };
    if (year && month) {
      const monthStr = String(month).padStart(2, '0');
      filter.date = { $regex: new RegExp(`^${year}-${monthStr}`) };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      AttendanceModel.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean()
        .exec(),
      AttendanceModel.countDocuments(filter),
    ]);

    return { items, total };
  }

  async findAdminList({ date, status, beauticianId, page = 1, limit = 20 } = {}) {
    const filter = {};
    if (date) filter.date = date;
    if (status) filter.status = status;
    if (beauticianId) {
      filter.beauticianProfileId = mongoose.isValidObjectId(beauticianId)
        ? new mongoose.Types.ObjectId(beauticianId)
        : beauticianId;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const pipeline = [
      { $match: filter },
      { $sort: { date: -1, createdAt: -1 } },
      {
        $lookup: {
          from: 'beauticianprofiles',
          localField: 'beauticianProfileId',
          foreignField: '_id',
          as: 'profile',
        },
      },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          beauticianProfileId: 1,
          userId: 1,
          date: 1,
          punchIn: 1,
          punchOut: 1,
          totalHoursWorked: 1,
          status: 1,
          source: 1,
          remarks: 1,
          markedBy: 1,
          createdAt: 1,
          updatedAt: 1,
          beautician: {
            id: '$profile._id',
            operationalArea: '$profile.operationalArea',
            serviceRadiusKm: '$profile.serviceRadiusKm',
            rating: '$profile.rating',
            profilePhoto: '$profile.profilePhoto',
          },
        },
      },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: Number(limit) }],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [facet] = await AttendanceModel.aggregate(pipeline);
    const items = facet?.items || [];
    const total = facet?.total?.[0]?.count || 0;

    return { items, total };
  }

  async aggregateMonthlyStats(beauticianProfileId, year, month) {
    const monthStr = String(month).padStart(2, '0');
    const regex = new RegExp(`^${year}-${monthStr}`);

    const stats = await AttendanceModel.aggregate([
      {
        $match: {
          beauticianProfileId: new mongoose.Types.ObjectId(beauticianProfileId),
          date: { $regex: regex },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalHours: { $sum: '$totalHoursWorked' },
        },
      },
    ]);

    const result = {
      present: 0,
      absent: 0,
      halfDay: 0,
      onLeave: 0,
      holiday: 0,
      totalHours: 0,
    };

    stats.forEach((s) => {
      if (s._id === 'PRESENT') result.present = s.count;
      if (s._id === 'ABSENT') result.absent = s.count;
      if (s._id === 'HALF_DAY') result.halfDay = s.count;
      if (s._id === 'ON_LEAVE') result.onLeave = s.count;
      if (s._id === 'HOLIDAY') result.holiday = s.count;
      result.totalHours += s.totalHours || 0;
    });

    return result;
  }
}

export class LeaveRepository {
  async create(data) {
    return LeaveRequestModel.create(data);
  }

  async findById(id) {
    return LeaveRequestModel.findById(id).lean();
  }

  async findByProfileId(beauticianProfileId, { status, page = 1, limit = 20 } = {}) {
    const filter = { beauticianProfileId };
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      LeaveRequestModel.find(filter)
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean()
        .exec(),
      LeaveRequestModel.countDocuments(filter),
    ]);

    return { items, total };
  }

  async findAdminQueue({ status, page = 1, limit = 20, search } = {}) {
    const match = {};
    if (status) match.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const pipeline = [
      { $match: match },
      { $sort: { startDate: 1, createdAt: -1 } },
      {
        $lookup: {
          from: 'beauticianprofiles',
          localField: 'beauticianProfileId',
          foreignField: '_id',
          as: 'profile',
        },
      },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
    ];

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      pipeline.push({
        $match: {
          $or: [
            { reason: searchRegex },
            { leaveType: searchRegex },
            { 'profile.operationalArea': searchRegex },
          ],
        },
      });
    }

    pipeline.push({
      $facet: {
        items: [
          { $skip: skip },
          { $limit: Number(limit) },
          {
            $project: {
              _id: 1,
              beauticianProfileId: 1,
              userId: 1,
              leaveType: 1,
              duration: 1,
              startDate: 1,
              endDate: 1,
              totalDays: 1,
              reason: 1,
              attachmentUrl: 1,
              status: 1,
              reviewedBy: 1,
              reviewedAt: 1,
              adminRemarks: 1,
              createdAt: 1,
              beautician: {
                id: '$profile._id',
                operationalArea: '$profile.operationalArea',
                profilePhoto: '$profile.profilePhoto',
                experienceYears: '$profile.experienceYears',
              },
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    });

    const [facet] = await LeaveRequestModel.aggregate(pipeline);
    const items = facet?.items || [];
    const total = facet?.total?.[0]?.count || 0;

    return { items, total };
  }

  async updateById(id, data) {
    return LeaveRequestModel.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  async countLeavesByProfileAndPeriod(beauticianProfileId, month, year) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    const leaves = await LeaveRequestModel.find({
      beauticianProfileId,
      status: 'APPROVED',
      startDate: { $lte: endOfMonth },
      endDate: { $gte: startOfMonth },
    }).lean();

    return leaves.reduce((sum, l) => sum + (l.totalDays || 1), 0);
  }

  async getAdminStats() {
    const [result] = await LeaveRequestModel.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          pending: [{ $match: { status: 'PENDING' } }, { $count: 'count' }],
          approved: [{ $match: { status: 'APPROVED' } }, { $count: 'count' }],
          rejected: [{ $match: { status: 'REJECTED' } }, { $count: 'count' }],
          cancelled: [{ $match: { status: 'CANCELLED' } }, { $count: 'count' }],
        },
      },
    ]);

    return {
      total: result?.total?.[0]?.count || 0,
      pending: result?.pending?.[0]?.count || 0,
      approved: result?.approved?.[0]?.count || 0,
      rejected: result?.rejected?.[0]?.count || 0,
      cancelled: result?.cancelled?.[0]?.count || 0,
    };
  }
}

export class PayslipRepository {
  async findByProfileAndPeriod(beauticianProfileId, payPeriod) {
    return PayslipModel.findOne({ beauticianProfileId, payPeriod }).lean();
  }

  async upsertByProfileAndPeriod(beauticianProfileId, payPeriod, data) {
    return PayslipModel.findOneAndUpdate(
      { beauticianProfileId, payPeriod },
      { $set: data },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async findByProfile(beauticianProfileId, { page = 1, limit = 12 } = {}) {
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      PayslipModel.find({ beauticianProfileId })
        .sort({ payPeriod: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean()
        .exec(),
      PayslipModel.countDocuments({ beauticianProfileId }),
    ]);

    return { items, total };
  }

  async findAdminList({ payPeriod, status, page = 1, limit = 20 } = {}) {
    const match = {};
    if (payPeriod) match.payPeriod = payPeriod;
    if (status) match.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const pipeline = [
      { $match: match },
      { $sort: { payPeriod: -1, createdAt: -1 } },
      {
        $lookup: {
          from: 'beauticianprofiles',
          localField: 'beauticianProfileId',
          foreignField: '_id',
          as: 'profile',
        },
      },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: Number(limit) },
            {
              $project: {
                _id: 1,
                beauticianProfileId: 1,
                userId: 1,
                payPeriod: 1,
                month: 1,
                year: 1,
                totalBookings: 1,
                totalEarnings: 1,
                platformCommission: 1,
                tds: 1,
                netPayout: 1,
                bonuses: 1,
                deductions: 1,
                presentDays: 1,
                absentDays: 1,
                leaveDays: 1,
                workingDays: 1,
                status: 1,
                generatedAt: 1,
                paidAt: 1,
                paidBy: 1,
                remarks: 1,
                createdAt: 1,
                beautician: {
                  id: '$profile._id',
                  operationalArea: '$profile.operationalArea',
                  profilePhoto: '$profile.profilePhoto',
                },
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [facet] = await PayslipModel.aggregate(pipeline);
    const items = facet?.items || [];
    const total = facet?.total?.[0]?.count || 0;

    return { items, total };
  }

  async updateById(id, data) {
    return PayslipModel.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  async getAdminStats(payPeriod) {
    const match = {};
    if (payPeriod) match.payPeriod = payPeriod;

    const [result] = await PayslipModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          paidCount: {
            $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, 1, 0] },
          },
          draftCount: {
            $sum: { $cond: [{ $eq: ['$status', 'DRAFT'] }, 1, 0] },
          },
          generatedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'GENERATED'] }, 1, 0] },
          },
          totalNetPayout: { $sum: '$netPayout' },
          totalEarnings: { $sum: '$totalEarnings' },
        },
      },
    ]);

    return {
      total: result?.totalCount || 0,
      paid: result?.paidCount || 0,
      draft: result?.draftCount || 0,
      generated: result?.generatedCount || 0,
      totalNetPayout: result?.totalNetPayout || 0,
      totalEarnings: result?.totalEarnings || 0,
    };
  }
}
