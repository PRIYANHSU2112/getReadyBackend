import { ApiResponse, HttpStatus } from '@getready/errors';

export class HrmController {
  constructor(hrmService) {
    this.hrmService = hrmService;
  }

  // ==========================================
  // ATTENDANCE
  // ==========================================

  punchIn = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const result = await this.hrmService.recordPunchIn(userId);
    return ApiResponse.success(res, result, 'Punched in successfully');
  };

  punchOut = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const result = await this.hrmService.recordPunchOut(userId);
    return ApiResponse.success(res, result, 'Punched out successfully');
  };

  getMyAttendance = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const { page = 1, limit = 31, month, year } = req.query;
    const result = await this.hrmService.getMyAttendance(userId, {
      page: Number(page),
      limit: Number(limit),
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
    const totalPages = Math.ceil(result.total / Number(limit)) || 1;
    return ApiResponse.paginated(
      res,
      result.items,
      { page: Number(page), limit: Number(limit), total: result.total, totalPages },
      'Attendance fetched successfully'
    );
  };

  adminListAttendance = async (req, res) => {
    const { page = 1, limit = 20, date, status, beauticianId } = req.query;
    const result = await this.hrmService.adminListAttendance({
      page: Number(page),
      limit: Number(limit),
      date,
      status,
      beauticianId,
    });
    const totalPages = Math.ceil(result.total / Number(limit)) || 1;
    return ApiResponse.paginated(
      res,
      result.items,
      { page: Number(page), limit: Number(limit), total: result.total, totalPages },
      'Attendance list retrieved successfully'
    );
  };

  adminMarkAttendance = async (req, res) => {
    const adminId = req.headers['x-user-id'] || req.user?.id;
    const profileId = req.params.id || req.body.beauticianProfileId || req.body.profileId;
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const result = await this.hrmService.adminMarkAttendance(profileId, date, req.body, adminId);
    return ApiResponse.success(res, result, 'Attendance record updated successfully');
  };

  // ==========================================
  // LEAVES
  // ==========================================

  submitLeave = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const result = await this.hrmService.submitLeaveRequest(userId, req.body, req.file);
    return ApiResponse.created(res, result, 'Leave request submitted successfully');
  };

  getMyLeaves = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const { page = 1, limit = 20, status } = req.query;
    const result = await this.hrmService.getMyLeaves(userId, {
      page: Number(page),
      limit: Number(limit),
      status,
    });
    const totalPages = Math.ceil(result.total / Number(limit)) || 1;
    return ApiResponse.paginated(
      res,
      result.items,
      { page: Number(page), limit: Number(limit), total: result.total, totalPages },
      'Leave requests fetched successfully'
    );
  };

  cancelLeave = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const result = await this.hrmService.cancelMyLeave(userId, req.params.id);
    return ApiResponse.success(res, result, 'Leave request cancelled successfully');
  };

  adminGetLeaveQueue = async (req, res) => {
    const { page = 1, limit = 20, status, search } = req.query;
    const result = await this.hrmService.adminGetLeaveQueue({
      page: Number(page),
      limit: Number(limit),
      status,
      search,
    });
    const totalPages = Math.ceil(result.total / Number(limit)) || 1;
    return ApiResponse.paginated(
      res,
      result.items,
      { page: Number(page), limit: Number(limit), total: result.total, totalPages },
      'Leave review queue retrieved successfully'
    );
  };

  adminReviewLeave = async (req, res) => {
    const adminId = req.headers['x-user-id'] || req.user?.id;
    const result = await this.hrmService.adminReviewLeave(req.params.id, req.body, adminId);
    return ApiResponse.success(
      res,
      result,
      `Leave request ${req.body.status?.toLowerCase() || 'reviewed'} successfully`
    );
  };

  adminGetLeaveStats = async (_req, res) => {
    const stats = await this.hrmService.adminGetLeaveStats();
    return ApiResponse.success(res, stats, 'Leave statistics retrieved successfully');
  };

  // ==========================================
  // PAYSLIPS
  // ==========================================

  getMyPayslips = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const { page = 1, limit = 12 } = req.query;
    const result = await this.hrmService.getMyPayslips(userId, {
      page: Number(page),
      limit: Number(limit),
    });
    const totalPages = Math.ceil(result.total / Number(limit)) || 1;
    return ApiResponse.paginated(
      res,
      result.items,
      { page: Number(page), limit: Number(limit), total: result.total, totalPages },
      'Payslips retrieved successfully'
    );
  };

  adminListPayslips = async (req, res) => {
    const { page = 1, limit = 20, payPeriod, status } = req.query;
    const result = await this.hrmService.adminListPayslips({
      page: Number(page),
      limit: Number(limit),
      payPeriod,
      status,
    });
    const totalPages = Math.ceil(result.total / Number(limit)) || 1;
    return ApiResponse.paginated(
      res,
      result.items,
      { page: Number(page), limit: Number(limit), total: result.total, totalPages },
      'Admin payslips retrieved successfully'
    );
  };

  generatePayslip = async (req, res) => {
    const adminId = req.headers['x-user-id'] || req.user?.id;
    const beauticianId = req.body.beauticianId || req.body.beauticianProfileId;
    const result = await this.hrmService.generatePayslip(beauticianId, req.body, adminId);
    return ApiResponse.success(res, result, 'Monthly payslip generated successfully', HttpStatus.CREATED);
  };

  adminMarkPaid = async (req, res) => {
    const adminId = req.headers['x-user-id'] || req.user?.id;
    const result = await this.hrmService.adminMarkPaid(req.params.id, adminId);
    return ApiResponse.success(res, result, 'Payslip marked as PAID successfully');
  };

  adminGetPayslipStats = async (req, res) => {
    const { payPeriod } = req.query;
    const stats = await this.hrmService.adminGetPayslipStats(payPeriod);
    return ApiResponse.success(res, stats, 'Payslip statistics retrieved successfully');
  };
}
