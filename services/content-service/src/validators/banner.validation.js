import Joi from 'joi';

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ObjectId');

export const bannerValidator = {
  activeBannersQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(50).default(10),
  }),

  listBannersQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    page: Joi.number().integer().min(1).default(1),
    isActive: Joi.boolean().optional(),
  }),

  bannerIdParams: Joi.object({
    id: objectId.required(),
  }),

  createBanner: Joi.object({
    title: Joi.string().trim().max(200).required(),
    description: Joi.string().trim().max(500).allow('', null).optional(),
    imageUrl: Joi.string().uri().allow('').optional(),
    deepLinkType: Joi.string().valid('NONE', 'CATEGORY', 'SERVICE', 'PACKAGE', 'EXTERNAL_URL').default('NONE'),
    deepLinkId: Joi.string().allow('', null).optional(),
    externalUrl: Joi.string().uri().allow('', null).optional(),
    displayOrder: Joi.number().integer().default(0),
    isActive: Joi.boolean().default(true),
    startDate: Joi.date().iso().allow(null).optional(),
    endDate: Joi.date().iso().allow(null).optional(),
  }),

  updateBanner: Joi.object({
    title: Joi.string().trim().max(200).optional(),
    description: Joi.string().trim().max(500).allow('', null).optional(),
    imageUrl: Joi.string().uri().allow('').optional(),
    deepLinkType: Joi.string().valid('NONE', 'CATEGORY', 'SERVICE', 'PACKAGE', 'EXTERNAL_URL').optional(),
    deepLinkId: Joi.string().allow('', null).optional(),
    externalUrl: Joi.string().uri().allow('', null).optional(),
    displayOrder: Joi.number().integer().optional(),
    isActive: Joi.boolean().optional(),
    startDate: Joi.date().iso().allow(null).optional(),
    endDate: Joi.date().iso().allow(null).optional(),
  }),
};
