import { ApiResponse } from '@getready/errors';
import { bookingHomeService } from '../services/booking-home.service.js';

export class BookingHomeController {
  constructor(homeService = bookingHomeService) {
    this.homeService = homeService;
  }

  getUserSummary = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id || req.query.userId;
    const summary = await this.homeService.getUserHomeSummary(userId);
    return ApiResponse.success(res, summary, 'User home summary retrieved successfully');
  };

  getBeauticianUpcoming = async (req, res) => {
    const beauticianId =
      req.headers['x-user-id'] || req.user?.id || req.query.beauticianId;
    const { limit = 2 } = req.query;

    const data = await this.homeService.getBeauticianUpcomingBookings(beauticianId, {
      limit: Number(limit) || 2,
    });
    return ApiResponse.success(res, data.bookings, 'Upcoming bookings retrieved successfully', 200, {
      total: data.total,
      limit: data.meta.limit,
    });
  };
}

export const bookingHomeController = new BookingHomeController();
export default bookingHomeController;
