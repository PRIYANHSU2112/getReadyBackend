import { ApiResponse } from '@getready/errors';
import { getOrCreateBookingSettings, BookingSettingsModel, invalidateSettingsCache } from '../models/booking-settings.model.js';
import { BookingAnalyticsService } from '../services/booking.analytics.js';

export class SlotController {
  constructor(slotService) {
    this.slotService = slotService;
  }

  listAvailable = async (req, res) => {
    const items = await this.slotService.listAvailable(req.query);
    return ApiResponse.success(res, items, 'Available slots fetched successfully');
  };

  listAdmin = async (req, res) => {
    const result = await this.slotService.listAdmin(req.query);
    return ApiResponse.paginated(res, result.items, result.meta, 'Slots fetched successfully');
  };

  getById = async (req, res) => {
    const item = await this.slotService.getById(req.params.id);
    return ApiResponse.success(res, item, 'Slot fetched successfully');
  };

  create = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const item = await this.slotService.create(req.body, userId);
    return ApiResponse.created(res, item, 'Slot created successfully');
  };

  bulkCreate = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const result = await this.slotService.bulkCreate(req.body, userId);
    return ApiResponse.created(res, result, `${result.createdCount} slots created successfully`);
  };

  update = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const item = await this.slotService.update(req.params.id, req.body, userId);
    return ApiResponse.success(res, item, 'Slot updated successfully');
  };

  remove = async (req, res) => {
    await this.slotService.remove(req.params.id);
    return ApiResponse.success(res, { id: req.params.id }, 'Slot cancelled successfully');
  };

  hold = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const result = await this.slotService.holdSlot(userId, req.body);
    return ApiResponse.success(res, result, 'Slot held successfully');
  };

  release = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const result = await this.slotService.releaseSlot(userId, req.body);
    return ApiResponse.success(res, result, 'Slot hold released successfully');
  };
}

export class BookingController {
  constructor(bookingService) {
    this.bookingService = bookingService;
  }

  preview = async (req, res) => {
    const accountOwnerId = req.headers['x-user-id'] || req.user?.id || 'guest-user';
    const previewData = await this.bookingService.previewBooking(accountOwnerId, req.body);
    return ApiResponse.success(res, previewData, 'Booking preview generated successfully');
  };

  create = async (req, res) => {
    const accountOwnerId = req.headers['x-user-id'] || req.user?.id || 'guest-user';
    const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotencyKey;
    const booking = await this.bookingService.createBooking(accountOwnerId, {
      ...req.body,
      idempotencyKey,
    });
    return ApiResponse.created(res, booking, 'Booking created successfully');
  };

  getById = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const userRole = req.headers['x-user-role'] || req.user?.role;
    const booking = await this.bookingService.getById(req.params.id, userId, userRole);
    return ApiResponse.success(res, booking, 'Booking fetched successfully');
  };

  listMyBookings = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const result = await this.bookingService.listUserBookings(userId, req.query);
    return ApiResponse.paginated(res, result.items, result.meta, 'Bookings fetched successfully');
  };

  listAdminBookings = async (req, res) => {
    const result = await this.bookingService.listAdminBookings(req.query);
    return ApiResponse.paginated(res, result.items, result.meta, 'Bookings fetched successfully');
  };

  getBeauticianAssignments = async (req, res) => {
    const beauticianId = req.headers['x-user-id'] || req.user?.id || req.query.beauticianId;
    const result = await this.bookingService.getBeauticianAssignments(beauticianId, req.query);
    return ApiResponse.paginated(res, result.items, result.meta, 'Assigned bookings fetched successfully');
  };

  verifyStartOtp = async (req, res) => {
    const booking = await this.bookingService.verifyStartOtp(req.params.id, req.body.otp);
    return ApiResponse.success(res, booking, 'Start OTP verified. Booking started successfully');
  };

  completeServiceItem = async (req, res) => {
    const beauticianId = req.headers['x-user-id'] || req.user?.id;
    const result = await this.bookingService.completeServiceItem(
      req.params.id,
      req.params.itemId,
      beauticianId,
      req.body.notes,
    );
    return ApiResponse.success(res, result, 'Service item marked as completed');
  };

  verifyEndOtp = async (req, res) => {
    const booking = await this.bookingService.verifyEndOtp(req.params.id, req.body.otp);
    return ApiResponse.success(res, booking, 'End OTP verified. Booking completed successfully');
  };

  cancel = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const booking = await this.bookingService.cancelBooking(req.params.id, userId, req.body);
    return ApiResponse.success(res, booking, 'Booking cancelled successfully');
  };

  adminAssign = async (req, res) => {
    const adminId = req.headers['x-user-id'] || req.user?.id || 'ADMIN';
    const booking = await this.bookingService.adminAssignBeauticians(
      req.params.id,
      req.body.assignments,
      'ADMIN',
      adminId,
    );
    return ApiResponse.success(res, booking, 'Beauticians assigned successfully');
  };

  getDashboardAnalytics = async (req, res) => {
    const data = await BookingAnalyticsService.getDashboardMetrics(req.query);
    return ApiResponse.success(res, data, 'Dashboard analytics retrieved successfully');
  };

  getLiveOperations = async (_req, res) => {
    const data = await BookingAnalyticsService.getLiveOperationsSnapshot();
    return ApiResponse.success(res, data, 'Live operations snapshot retrieved successfully');
  };

  getSettings = async (_req, res) => {
    const settings = await getOrCreateBookingSettings();
    return ApiResponse.success(res, settings, 'Booking settings fetched successfully');
  };

  updateSettings = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const settings = await BookingSettingsModel.findOneAndUpdate(
      { key: 'default' },
      { $set: { ...req.body, updatedBy: userId } },
      { new: true, upsert: true },
    );
    invalidateSettingsCache();
    return ApiResponse.success(res, settings, 'Booking settings updated successfully');
  };

  listReports = async (req, res) => {
    const reports = [
      { id: 'REP-001', name: 'Daily Revenue & Booking Report', period: 'Today', status: 'READY', format: 'CSV' },
      { id: 'REP-002', name: 'Weekly Partner Payouts & Commission', period: 'Last 7 Days', status: 'READY', format: 'XLSX' },
      { id: 'REP-003', name: 'Monthly Tax & GST Breakdown', period: 'This Month', status: 'READY', format: 'PDF' },
      { id: 'REP-004', name: 'Customer Retention & Loyalty Report', period: 'Last 30 Days', status: 'READY', format: 'CSV' },
      { id: 'REP-005', name: 'Cancellation & SLA Audit Trail', period: 'This Month', status: 'READY', format: 'PDF' },
    ];
    return ApiResponse.paginated(
      res,
      reports,
      { page: 1, limit: 25, total: reports.length, totalPages: 1 },
      'Reports fetched successfully',
    );
  };
}
