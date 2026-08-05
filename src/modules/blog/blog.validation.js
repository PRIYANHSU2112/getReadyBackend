import { BaseValidator } from '../../common/base/BaseValidator.js';
import { BlogStatus } from '../../common/constants/enums.js';
import {
  MAX_BLOG_TITLE_LENGTH,
  MAX_BLOG_SLUG_LENGTH,
  MAX_BLOG_EXCERPT_LENGTH,
  MAX_BLOG_CONTENT_LENGTH,
  MAX_BLOG_AUTHOR_NAME_LENGTH,
  DEFAULT_POPULAR_LIMIT,
  MAX_POPULAR_LIMIT,
  BLOG_SORT_FIELDS,
  DEFAULT_BLOG_SORT,
} from '../../common/constants/blog.js';

const { Joi } = BaseValidator;

const objectId = Joi.string().hex().length(24);
const boolField = Joi.boolean().truthy('true').falsy('false');
const sortEnum = BLOG_SORT_FIELDS.flatMap((f) => [f, `-${f}`, 'popular', 'latest', '-popular', '-latest']);

const createBlog = Joi.object({
  title: Joi.string().trim().min(2).max(MAX_BLOG_TITLE_LENGTH).required(),
  slug: Joi.string()
    .trim()
    .lowercase()
    .max(MAX_BLOG_SLUG_LENGTH)
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  excerpt: Joi.string().trim().max(MAX_BLOG_EXCERPT_LENGTH).optional().allow(null, ''),
  content: Joi.string().trim().max(MAX_BLOG_CONTENT_LENGTH).optional().allow(''),
  categoryId: objectId.required(),
  status: Joi.string()
    .valid(...Object.values(BlogStatus))
    .default(BlogStatus.DRAFT),
  isFeatured: boolField.default(false),
  publishedAt: Joi.date().iso().optional().allow(null),
  readTimeMin: Joi.number().integer().min(1).max(120).optional(),
  authorName: Joi.string().trim().max(MAX_BLOG_AUTHOR_NAME_LENGTH).optional().allow(null, ''),
  coverImageUrl: Joi.string().uri().optional().allow(null, ''),
  thumbnailUrl: Joi.string().uri().optional().allow(null, ''),
});

const updateBlog = Joi.object({
  title: Joi.string().trim().min(2).max(MAX_BLOG_TITLE_LENGTH),
  slug: Joi.string()
    .trim()
    .lowercase()
    .max(MAX_BLOG_SLUG_LENGTH)
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  excerpt: Joi.string().trim().max(MAX_BLOG_EXCERPT_LENGTH).allow(null, ''),
  content: Joi.string().trim().max(MAX_BLOG_CONTENT_LENGTH).allow(''),
  categoryId: objectId,
  status: Joi.string().valid(...Object.values(BlogStatus)),
  isFeatured: boolField,
  publishedAt: Joi.date().iso().allow(null),
  readTimeMin: Joi.number().integer().min(1).max(120),
  authorName: Joi.string().trim().max(MAX_BLOG_AUTHOR_NAME_LENGTH).allow(null, ''),
  coverImageUrl: Joi.string().uri().optional().allow(null, ''),
  thumbnailUrl: Joi.string().uri().optional().allow(null, ''),
}).min(1);

const blogIdParams = Joi.object({
  id: Joi.string().trim().min(1).max(220).required(),
});

const listBlogsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string()
    .valid(...sortEnum)
    .default('popular'),
  categoryId: objectId.optional(),
  search: Joi.string().trim().max(100).allow(''),
});

const homeBlogsQuery = Joi.object({
  categoryId: objectId.optional(),
  popularLimit: Joi.number()
    .integer()
    .min(1)
    .max(MAX_POPULAR_LIMIT)
    .default(DEFAULT_POPULAR_LIMIT),
  page: Joi.number().integer().min(1).default(1),
});

const manageBlogsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string()
    .valid(...BLOG_SORT_FIELDS.flatMap((f) => [f, `-${f}`]))
    .default(DEFAULT_BLOG_SORT),
  categoryId: objectId.optional(),
  status: Joi.string().valid(...Object.values(BlogStatus)),
  isFeatured: boolField,
  search: Joi.string().trim().max(100).allow(''),
});

export class BlogValidator extends BaseValidator {
  constructor() {
    super({
      createBlog,
      updateBlog,
      blogIdParams,
      listBlogsQuery,
      homeBlogsQuery,
      manageBlogsQuery,
    });
  }
}

export const blogValidator = new BlogValidator();
