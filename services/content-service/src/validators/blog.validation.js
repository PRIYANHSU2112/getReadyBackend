import Joi from 'joi';

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ObjectId');

export const blogValidator = {
  homeBlogsQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(20).default(5),
  }),

  listBlogsQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(50).default(10),
    page: Joi.number().integer().min(1).default(1),
    categoryId: objectId.allow(null, '').optional(),
    sort: Joi.string().valid('latest', 'popular').default('latest'),
  }),

  manageBlogsQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    page: Joi.number().integer().min(1).default(1),
    status: Joi.string().valid('DRAFT', 'PUBLISHED', 'ARCHIVED').optional(),
    categoryId: objectId.allow(null, '').optional(),
  }),

  blogIdParams: Joi.object({
    id: Joi.string().required(),
  }),

  createBlog: Joi.object({
    title: Joi.string().trim().max(300).required(),
    slug: Joi.string().trim().max(300).optional(),
    summary: Joi.string().trim().max(1000).allow('').optional(),
    content: Joi.string().required(),
    coverImageUrl: Joi.string().uri().allow('', null).optional(),
    authorName: Joi.string().trim().max(100).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    categoryId: objectId.allow(null, '').optional(),
    status: Joi.string().valid('DRAFT', 'PUBLISHED', 'ARCHIVED').default('DRAFT'),
    readTimeMinutes: Joi.number().integer().min(1).default(3),
  }),

  updateBlog: Joi.object({
    title: Joi.string().trim().max(300).optional(),
    slug: Joi.string().trim().max(300).optional(),
    summary: Joi.string().trim().max(1000).allow('').optional(),
    content: Joi.string().optional(),
    coverImageUrl: Joi.string().uri().allow('', null).optional(),
    authorName: Joi.string().trim().max(100).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    categoryId: objectId.allow(null, '').optional(),
    status: Joi.string().valid('DRAFT', 'PUBLISHED', 'ARCHIVED').optional(),
    readTimeMinutes: Joi.number().integer().min(1).optional(),
  }),
};
