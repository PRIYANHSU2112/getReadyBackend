import { ApiResponse } from '@getready/errors';
import { beauticianHomeService } from '../services/beautician-home.service.js';

export class BeauticianHomeController {
  constructor(homeService = beauticianHomeService) {
    this.homeService = homeService;
  }

  getSummary = async (req, res) => {
    const beauticianId = req.headers['x-user-id'] || req.user?.id || req.query.beauticianId;
    const summary = await this.homeService.getSummary(beauticianId);
    return ApiResponse.success(res, summary, 'Beautician home summary retrieved successfully');
  };

  getServices = async (req, res) => {
    const beauticianId = req.headers['x-user-id'] || req.user?.id || req.query.beauticianId;
    const { limit = 4 } = req.query;
    const result = await this.homeService.getServices(beauticianId, {
      limit: Number(limit) || 4,
    });
    return ApiResponse.success(res, result.services, 'Beautician active services retrieved successfully', 200, {
      total: result.total,
      limit: result.meta.limit,
    });
  };

  updateDuty = async (req, res) => {
    const beauticianId = req.headers['x-user-id'] || req.user?.id || req.body.beauticianId;
    const { dutyStatus, isAvailable } = req.body;
    const result = await this.homeService.updateDutyStatus(beauticianId, {
      dutyStatus,
      isAvailable,
    });
    return ApiResponse.success(res, result, 'Beautician duty status updated successfully');
  };
}

export const beauticianHomeController = new BeauticianHomeController();
export default beauticianHomeController;
