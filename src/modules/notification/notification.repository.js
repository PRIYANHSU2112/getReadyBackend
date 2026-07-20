import { BaseRepository } from '../../common/base/BaseRepository.js';

export class NotificationRepository extends BaseRepository {
  constructor(notificationModel) {
    super(notificationModel);
  }

  async findByUserId(userId, options = {}) {
    return this.findAll({ userId, deletedAt: null }, options);
  }
}
