import { ApiResponse } from '@getready/errors';

export class CalendarController {
  /**
   * @param {import('../services/calendar.service.js').CalendarService} calendarService
   */
  constructor(calendarService) {
    this.calendarService = calendarService;
  }

  getCalendar = async (req, res) => {
    const data = await this.calendarService.getCalendar(req.query);
    return ApiResponse.success(res, data, 'Calendar appointments fetched successfully');
  };

  getTodayAppointments = async (req, res) => {
    const data = await this.calendarService.getTodayAppointments(req.query);
    return ApiResponse.success(res, data, "Today's appointments fetched successfully");
  };

  getSummary = async (req, res) => {
    const data = await this.calendarService.getSummary(req.query);
    return ApiResponse.success(res, data, 'Calendar summary metrics fetched successfully');
  };

  getAvailability = async (req, res) => {
    const data = await this.calendarService.getAvailability(req.query);
    return ApiResponse.success(res, data, 'Beautician availability fetched successfully');
  };

  getConflicts = async (req, res) => {
    const data = await this.calendarService.getConflicts(req.query);
    return ApiResponse.success(res, data, 'Calendar conflicts fetched successfully');
  };

  reschedule = async (req, res) => {
    const adminId = req.headers['x-user-id'] || req.user?.id || 'ADMIN';
    const updated = await this.calendarService.rescheduleBooking(req.params.id, req.body, adminId);
    return ApiResponse.success(res, updated, 'Booking rescheduled successfully');
  };

  complete = async (req, res) => {
    const adminId = req.headers['x-user-id'] || req.user?.id || 'ADMIN';
    const completed = await this.calendarService.completeBooking(req.params.id, req.body, adminId);
    return ApiResponse.success(res, completed, 'Booking marked as completed successfully');
  };
}
