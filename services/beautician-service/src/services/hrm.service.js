import mongoose from 'mongoose';
import { AppError, HttpStatus, ErrorCodes } from '@getready/errors';

export class HrmService {
  constructor(attendanceRepo, leaveRepo, payslipRepo, profileRepo, storageService = null, cache = null) {
    this.attendanceRepo = attendanceRepo;
    this.leaveRepo = leaveRepo;
    this.payslipRepo = payslipRepo;
    this.profileRepo = profileRepo;
    this.storageService = storageService;
    this.cache = cache;
  }

  // ==========================================
  // ATTENDANCE METHODS
  // ==========================================

  async recordPunchIn(userId) {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new AppError('Beautician profile not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const existing = await this.attendanceRepo.findByProfileAndDate(profile._id, today);

    const data = {
      beauticianProfileId: profile._id,
      userId,
      date: today,
      punchIn: existing?.punchIn || now,
      status: 'PRESENT',
      source: 'DUTY_TOGGLE',
    };

    const record = await this.attendanceRepo.upsertByProfileAndDate(profile._id, today, data);
    if (this.cache?.del) {
      await this.cache.del(`home:beautician:${userId}:summary`).catch(() => {});
    }
    return record;
  }

  async recordPunchOut(userId) {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new AppError('Beautician profile not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const today = new Date().toISOString().split('T')[0];
    const existing = await this.attendanceRepo.findByProfileAndDate(profile._id, today);

    if (!existing || !existing.punchIn) {
      throw new AppError('No punch-in record found for today', HttpStatus.BAD_REQUEST, ErrorCodes.BAD_REQUEST);
    }

    const now = new Date();
    const punchInTime = new Date(existing.punchIn).getTime();
    const diffHours = Math.max(0, (now.getTime() - punchInTime) / (1000 * 60 * 60));
    const totalHoursWorked = Number(diffHours.toFixed(2));
    const status = totalHoursWorked >= 4 ? 'PRESENT' : 'HALF_DAY';

    const data = {
      punchOut: now,
      totalHoursWorked,
      status: existing.status === 'HOLIDAY' || existing.status === 'ON_LEAVE' ? existing.status : status,
    };

    const record = await this.attendanceRepo.upsertByProfileAndDate(profile._id, today, data);
    if (this.cache?.del) {
      await this.cache.del(`home:beautician:${userId}:summary`).catch(() => {});
    }
    return record;
  }

  async getMyAttendance(userId, params = {}) {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new AppError('Beautician profile not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }
    return this.attendanceRepo.findByProfile(profile._id, params);
  }

  async adminListAttendance(params = {}) {
    return this.attendanceRepo.findAdminList(params);
  }

  async adminMarkAttendance(profileId, date, data = {}, adminId = 'admin') {
    if (!mongoose.isValidObjectId(profileId)) {
      throw new AppError('Invalid beautician profile ID', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
    const profile = await this.profileRepo.findById(profileId);
    if (!profile) {
      throw new AppError('Beautician profile not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const hours = data.totalHoursWorked !== undefined
      ? Number(data.totalHoursWorked)
      : data.status === 'PRESENT'
      ? 8
      : data.status === 'HALF_DAY'
      ? 4
      : 0;

    const payload = {
      beauticianProfileId: profile._id,
      userId: profile.userId,
      date,
      status: data.status || 'PRESENT',
      source: 'MANUAL_ADMIN',
      markedBy: adminId,
      remarks: data.remarks || 'Marked by administrator',
      punchIn: data.punchIn ? new Date(data.punchIn) : null,
      punchOut: data.punchOut ? new Date(data.punchOut) : null,
      totalHoursWorked: hours,
    };

    return this.attendanceRepo.upsertByProfileAndDate(profile._id, date, payload);
  }

  // ==========================================
  // LEAVE METHODS
  // ==========================================

  async submitLeaveRequest(userId, data, file = null) {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new AppError('Beautician profile not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('Valid startDate and endDate are required', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    if (start > end) {
      throw new AppError('Start date must be before or equal to end date', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const totalDays = data.duration === 'HALF_DAY' ? 0.5 : diffDays;

    let attachmentUrl = null;
    let attachmentKey = null;

    if (file && this.storageService) {
      const uploadRes = await this.storageService.upload(file, 'leaves', true);
      if (uploadRes) {
        attachmentUrl = uploadRes.url;
        attachmentKey = uploadRes.key || uploadRes.publicId;
      }
    }

    return this.leaveRepo.create({
      beauticianProfileId: profile._id,
      userId,
      leaveType: data.leaveType,
      duration: data.duration || 'FULL_DAY',
      startDate: start,
      endDate: end,
      totalDays,
      reason: data.reason,
      attachmentUrl,
      attachmentKey,
      status: 'PENDING',
    });
  }

  async getMyLeaves(userId, params = {}) {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new AppError('Beautician profile not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }
    return this.leaveRepo.findByProfileId(profile._id, params);
  }

  async cancelMyLeave(userId, leaveId) {
    if (!mongoose.isValidObjectId(leaveId)) {
      throw new AppError('Invalid leave ID', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
    const leave = await this.leaveRepo.findById(leaveId);
    if (!leave) {
      throw new AppError('Leave request not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }
    if (leave.userId !== userId) {
      throw new AppError('Unauthorized', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }
    if (leave.status !== 'PENDING') {
      throw new AppError('Only pending leave requests can be cancelled', HttpStatus.BAD_REQUEST, ErrorCodes.BAD_REQUEST);
    }
    return this.leaveRepo.updateById(leaveId, { status: 'CANCELLED' });
  }

  async adminGetLeaveQueue(params = {}) {
    return this.leaveRepo.findAdminQueue(params);
  }

  async adminReviewLeave(leaveId, { status, adminRemarks = null } = {}, adminId = 'admin') {
    if (!mongoose.isValidObjectId(leaveId)) {
      throw new AppError('Invalid leave ID', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new AppError('Review status must be either APPROVED or REJECTED', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const leave = await this.leaveRepo.findById(leaveId);
    if (!leave) {
      throw new AppError('Leave request not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const updated = await this.leaveRepo.updateById(leaveId, {
      status,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      adminRemarks,
    });

    if (status === 'APPROVED') {
      const cur = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      while (cur <= end) {
        const dateStr = cur.toISOString().split('T')[0];
        await this.attendanceRepo.upsertByProfileAndDate(leave.beauticianProfileId, dateStr, {
          beauticianProfileId: leave.beauticianProfileId,
          userId: leave.userId,
          date: dateStr,
          status: 'ON_LEAVE',
          source: 'SYSTEM',
          remarks: `Approved ${leave.leaveType} Leave`,
        });
        cur.setDate(cur.getDate() + 1);
      }
    }

    return updated;
  }

  async adminGetLeaveStats() {
    return this.leaveRepo.getAdminStats();
  }

  // ==========================================
  // PAYSLIP METHODS
  // ==========================================

  async generatePayslip(beauticianId, body = {}, adminId = 'admin') {
    if (!mongoose.isValidObjectId(beauticianId)) {
      throw new AppError('Invalid beautician ID', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
    const profile = await this.profileRepo.findById(beauticianId);
    if (!profile) {
      throw new AppError('Beautician profile not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const month = Number(body.month || new Date().getMonth() + 1);
    const year = Number(body.year || new Date().getFullYear());
    const payPeriod = `${year}-${String(month).padStart(2, '0')}`;

    const attendanceStats = await this.attendanceRepo.aggregateMonthlyStats(profile._id, year, month);
    const leaveDays = await this.leaveRepo.countLeavesByProfileAndPeriod(profile._id, month, year);

    const workingDays = 26;
    const presentDays = attendanceStats.present + attendanceStats.halfDay * 0.5;
    const absentDays = Math.max(0, workingDays - presentDays - leaveDays);

    const totalEarnings = Number(body.totalEarnings || 0);
    const platformCommission = Number(body.platformCommission || 0);
    const bonuses = Number(body.bonuses || 0);
    const deductions = Number(body.deductions || 0);

    const taxableBase = Math.max(0, totalEarnings - platformCommission);
    const tds = Number((taxableBase * 0.02).toFixed(2));
    const netPayout = Math.max(0, Number((totalEarnings - platformCommission - tds + bonuses - deductions).toFixed(2)));

    const payload = {
      beauticianProfileId: profile._id,
      userId: profile.userId,
      payPeriod,
      month,
      year,
      totalBookings: Number(body.totalBookings || 0),
      totalEarnings,
      platformCommission,
      tds,
      netPayout,
      bonuses,
      deductions,
      presentDays,
      absentDays,
      leaveDays,
      workingDays,
      status: 'GENERATED',
      generatedAt: new Date(),
      generatedBy: adminId,
      remarks: body.remarks || null,
    };

    return this.payslipRepo.upsertByProfileAndPeriod(profile._id, payPeriod, payload);
  }

  async getMyPayslips(userId, params = {}) {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new AppError('Beautician profile not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }
    return this.payslipRepo.findByProfile(profile._id, params);
  }

  async adminListPayslips(params = {}) {
    return this.payslipRepo.findAdminList(params);
  }

  async adminMarkPaid(payslipId, adminId = 'admin') {
    if (!mongoose.isValidObjectId(payslipId)) {
      throw new AppError('Invalid payslip ID', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
    const payslip = await this.payslipRepo.updateById(payslipId, {
      status: 'PAID',
      paidAt: new Date(),
      paidBy: adminId,
    });
    if (!payslip) {
      throw new AppError('Payslip not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }
    return payslip;
  }

  async adminGetPayslipStats(payPeriod) {
    return this.payslipRepo.getAdminStats(payPeriod);
  }
}
