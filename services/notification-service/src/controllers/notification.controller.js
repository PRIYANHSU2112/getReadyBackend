import { ApiResponse, HttpStatus } from '@getready/errors';

export class NotificationController {
  constructor(notificationService) {
    this.notificationService = notificationService;
  }

  listMine = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const { limit = 20, page = 1 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const result = await this.notificationService.listForUser(userId, {
      limit: Number(limit),
      skip,
    });

    return ApiResponse.success(res, result.notifications, 'Notifications retrieved successfully', HttpStatus.OK, {
      total: result.total,
      page: Number(page),
      limit: Number(limit),
    });
  };

  markAsRead = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;
    const notification = await this.notificationService.markAsRead(id, userId);
    return ApiResponse.success(res, notification, 'Notification marked as read');
  };

  delete = async (req, res) => {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;
    await this.notificationService.delete(id, userId);
    return ApiResponse.success(res, null, 'Notification deleted successfully');
  };

  send = async (req, res) => {
    const notification = await this.notificationService.sendNotification(req.body);
    return ApiResponse.success(res, notification, 'Notification sent successfully', HttpStatus.CREATED);
  };
}
