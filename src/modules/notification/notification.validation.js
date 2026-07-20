import { BaseValidator } from '../../common/base/BaseValidator.js';

const { Joi } = BaseValidator;

const listQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

export class NotificationValidator extends BaseValidator {
  constructor() {
    super({ listQuery });
  }
}

export const notificationValidator = new NotificationValidator();
