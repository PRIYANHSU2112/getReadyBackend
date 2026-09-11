import Joi from 'joi';

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ObjectId');

export const notificationValidator = {
  listQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    page: Joi.number().integer().min(1).default(1),
  }),

  sendNotification: Joi.object({
    userId: objectId.required(),
    title: Joi.string().max(255).required(),
    body: Joi.string().max(1000).allow('').optional(),
    channel: Joi.string().valid('IN_APP', 'PUSH', 'SMS', 'EMAIL').default('IN_APP'),
    data: Joi.object().optional(),
  }),
};
