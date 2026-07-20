import { BaseController } from '../../common/base/BaseController.js';

export class NotificationController extends BaseController {
  /**
   * @param {import('./notification.service.js').NotificationService} notificationService
   */
  constructor(notificationService) {
    super();
    this.notificationService = notificationService;
    this.bindMethods(['listMine']);
  }

  async listMine(req, res) {
    const items = await this.notificationService.listForUser(req.user.id, {
      limit: Number(req.query.limit) || 10,
      skip: ((Number(req.query.page) || 1) - 1) * (Number(req.query.limit) || 10),
    });
    return this.ok(res, items);
  }
}
