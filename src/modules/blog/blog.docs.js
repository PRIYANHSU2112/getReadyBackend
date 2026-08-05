import {
  bearerSecurity,
  publicSecurity,
  OBJECT_ID,
  jsonBody,
  okResponse,
  createdResponse,
  withErrors,
  successExample,
  pageQueryParams,
  paginationMeta,
} from '../../core/swagger/swagger.common.js';
import { BlogStatus } from '../../common/constants/enums.js';

const adminOnly = '**Auth:** Bearer JWT + RBAC `blogs.*`. Categories come from existing Categories module.';

const blogCardExample = {
  id: '64f0c2a1b4e1c2d3e4f50a01',
  title: '5 Facial Routines for Glowing Skin This Monsoon',
  slug: '5-facial-routines-for-glowing-skin-this-monsoon',
  excerpt: 'Keep your skin hydrated and radiant during the humid season with these expert-backed tips...',
  categoryId: OBJECT_ID,
  categoryName: 'Skin Care',
  categorySlug: 'skin-care',
  coverImage: { url: 'https://cdn.example.com/blogs/cover.jpg', publicId: 'blogs/cover' },
  thumbnail: { url: 'https://cdn.example.com/blogs/cover.jpg', publicId: 'blogs/cover' },
  coverImageUrl: 'https://cdn.example.com/blogs/cover.jpg',
  status: BlogStatus.PUBLISHED,
  isFeatured: true,
  publishedAt: '2026-07-12T10:00:00.000Z',
  readTimeMin: 4,
  likesCount: 234,
  viewCount: 1200,
  authorName: 'Rebecca',
  createdAt: '2026-07-12T10:00:00.000Z',
  updatedAt: '2026-07-12T10:00:00.000Z',
};

const blogDetailExample = {
  ...blogCardExample,
  content:
    '<h2>Eat to sleep better</h2><p>Nutrition tips for glowing skin...</p><h2>Movement and mindfulness</h2><p>...</p>',
};

const createExample = {
  title: '5 Facial Routines for Glowing Skin This Monsoon',
  slug: '5-facial-routines-for-glowing-skin-this-monsoon',
  excerpt: 'Keep your skin hydrated and radiant during the humid season...',
  content: '<p>Full blog HTML content</p>',
  categoryId: OBJECT_ID,
  status: BlogStatus.PUBLISHED,
  isFeatured: true,
  authorName: 'Rebecca',
  coverImageUrl: 'https://cdn.example.com/blogs/cover.jpg',
};

export const blogDocs = {
  paths: {
    '/api/v1/blogs/home': {
      get: {
        tags: ['Blogs'],
        summary: 'Blogs home (categories + latest + popular)',
        description:
          '**Public.** One-shot payload for the Blogs screen. Categories are active service categories. Client adds "All". Cached ~30s.',
        security: publicSecurity,
        parameters: [
          {
            name: 'categoryId',
            in: 'query',
            schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
          {
            name: 'popularLimit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', minimum: 1, default: 1 },
          },
        ],
        responses: {
          ...okResponse(
            successExample({
              categories: [{ id: OBJECT_ID, name: 'Skin Care', slug: 'skin-care' }],
              latest: blogCardExample,
              popular: {
                items: [blogCardExample],
                meta: { ...paginationMeta, total: 1 },
              },
            }),
          ),
          ...withErrors(422, 500),
        },
      },
    },
    '/api/v1/blogs': {
      get: {
        tags: ['Blogs'],
        summary: 'List published blogs',
        description: '**Public.** Slim cards (no content). `sort=popular` or `latest`. Cached ~30s.',
        security: publicSecurity,
        parameters: [
          ...pageQueryParams({ page: 1, limit: 10 }),
          {
            name: 'categoryId',
            in: 'query',
            schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
          {
            name: 'sort',
            in: 'query',
            schema: { type: 'string', enum: ['popular', 'latest', '-likesCount', '-publishedAt'], default: 'popular' },
          },
        ],
        responses: {
          ...okResponse(successExample([blogCardExample], { ...paginationMeta, total: 1 })),
          ...withErrors(422, 500),
        },
      },
      post: {
        tags: ['Blogs'],
        summary: 'Admin create blog',
        description: `${adminOnly}\n\nOptional multipart \`file\` for cover image. \`categoryId\` must be an existing Category.`,
        security: bearerSecurity,
        requestBody: jsonBody(
          {
            type: 'object',
            required: ['title', 'categoryId'],
            properties: {
              title: { type: 'string' },
              slug: { type: 'string' },
              excerpt: { type: 'string' },
              content: { type: 'string' },
              categoryId: { type: 'string' },
              status: { type: 'string', enum: Object.values(BlogStatus) },
              isFeatured: { type: 'boolean' },
              authorName: { type: 'string' },
              coverImageUrl: { type: 'string', format: 'uri' },
            },
          },
          createExample,
        ),
        responses: {
          ...createdResponse(successExample(blogDetailExample)),
          ...withErrors(400, 401, 403, 409, 422, 500),
        },
      },
    },
    '/api/v1/blogs/manage': {
      get: {
        tags: ['Blogs'],
        summary: 'Admin list blogs (all statuses)',
        description: adminOnly,
        security: bearerSecurity,
        parameters: [
          ...pageQueryParams({ page: 1, limit: 10 }),
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: Object.values(BlogStatus) },
          },
          {
            name: 'categoryId',
            in: 'query',
            schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
        ],
        responses: {
          ...okResponse(successExample([blogCardExample], { ...paginationMeta, total: 1 })),
          ...withErrors(401, 403, 422, 500),
        },
      },
    },
    '/api/v1/blogs/manage/{id}': {
      get: {
        tags: ['Blogs'],
        summary: 'Admin get blog by id (includes drafts)',
        description: adminOnly,
        security: bearerSecurity,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
        ],
        responses: {
          ...okResponse(successExample(blogDetailExample)),
          ...withErrors(401, 403, 404, 500),
        },
      },
    },
    '/api/v1/blogs/{id}': {
      get: {
        tags: ['Blogs'],
        summary: 'Get published blog detail',
        description: '**Public.** Accepts Mongo id or slug. Includes `content`. Cached ~30s.',
        security: publicSecurity,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Blog id or slug',
          },
        ],
        responses: {
          ...okResponse(successExample(blogDetailExample)),
          ...withErrors(404, 500),
        },
      },
      patch: {
        tags: ['Blogs'],
        summary: 'Admin update blog',
        description: adminOnly,
        security: bearerSecurity,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
        ],
        requestBody: jsonBody({
          type: 'object',
          minProperties: 1,
          properties: {
            title: { type: 'string' },
            status: { type: 'string', enum: Object.values(BlogStatus) },
            isFeatured: { type: 'boolean' },
            content: { type: 'string' },
            categoryId: { type: 'string' },
          },
        }),
        responses: {
          ...okResponse(successExample(blogDetailExample)),
          ...withErrors(400, 401, 403, 404, 422, 500),
        },
      },
      delete: {
        tags: ['Blogs'],
        summary: 'Admin soft-delete blog',
        description: adminOnly,
        security: bearerSecurity,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
          },
        ],
        responses: {
          ...okResponse(successExample({ ...blogCardExample, status: BlogStatus.ARCHIVED })),
          ...withErrors(401, 403, 404, 500),
        },
      },
    },
    '/api/v1/blogs/{id}/like': {
      post: {
        tags: ['Blogs'],
        summary: 'Like a published blog',
        description: '**Auth:** Bearer JWT. Idempotent — second like does not increase count.',
        security: bearerSecurity,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          ...okResponse(
            successExample({
              liked: true,
              alreadyLiked: false,
              likesCount: 235,
              blog: { ...blogCardExample, likesCount: 235 },
            }),
          ),
          ...withErrors(401, 404, 500),
        },
      },
    },
  },
};
