import {
  bearerSecurity,
  publicSecurity,
  OBJECT_ID,
  jsonBody,
  okResponse,
  createdResponse,
  noContentResponse,
  withErrors,
  successExample,
  objectIdParam,
  pageQueryParams,
} from '../../core/swagger/swagger.common.js';

const skillExample = {
  id: '64f0c2a1b4e1c2d3e4f50770',
  name: 'Hair Coloring',
  categoryId: '64f0c2a1b4e1c2d3e4f50660',
  icon: 'https://cdn.example.com/icons/hair-color.png',
  displayOrder: 1,
  isActive: true,
  createdAt: '2026-07-27T10:00:00.000Z',
  updatedAt: '2026-07-27T10:00:00.000Z',
};

export const skillDocs = {
  paths: {
    '/api/v1/skills/active': {
      get: {
        tags: ['Skills'],
        summary: 'List active skills (Public / Beautician selection)',
        description: 'Fetch slim list of active skills for beauticians to select from. Cached in memory.',
        security: publicSecurity,
        parameters: [
          {
            name: 'categoryId',
            in: 'query',
            schema: { type: 'string', pattern: OBJECT_ID },
            description: 'Filter skills by service category ID',
          },
        ],
        responses: {
          200: okResponse(
            'Active skills list',
            successExample({
              items: [skillExample],
              total: 1,
            }),
          ),
        },
      },
    },
    '/api/v1/skills': {
      get: {
        tags: ['Skills'],
        summary: 'List all skills (Admin)',
        description: 'Admin endpoint to list all skills with pagination and filters.',
        security: bearerSecurity,
        parameters: [
          ...pageQueryParams(),
          {
            name: 'search',
            in: 'query',
            schema: { type: 'string' },
            description: 'Search skill by name',
          },
          {
            name: 'categoryId',
            in: 'query',
            schema: { type: 'string', pattern: OBJECT_ID },
          },
          {
            name: 'isActive',
            in: 'query',
            schema: { type: 'boolean' },
          },
        ],
        responses: {
          200: okResponse('Skills list', successExample([skillExample])),
        },
      },
      post: {
        tags: ['Skills'],
        summary: 'Create skill (Admin)',
        description: 'Create a new admin-managed master skill.',
        security: bearerSecurity,
        requestBody: jsonBody({
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', example: 'Hair Coloring' },
            categoryId: { type: 'string', example: skillExample.categoryId },
            icon: { type: 'string', example: skillExample.icon },
            isActive: { type: 'boolean', example: true },
            displayOrder: { type: 'number', example: 1 },
          },
        }),
        responses: {
          201: createdResponse(successExample(skillExample)),
          ...withErrors(400, 409, 422),
        },
      },
    },
    '/api/v1/skills/{id}': {
      get: {
        tags: ['Skills'],
        summary: 'Get skill by ID (Admin)',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Skill ID')],
        responses: {
          200: okResponse('Skill details', successExample(skillExample)),
          ...withErrors(404),
        },
      },
      patch: {
        tags: ['Skills'],
        summary: 'Update skill (Admin)',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Skill ID')],
        requestBody: jsonBody({
          type: 'object',
          properties: {
            name: { type: 'string' },
            categoryId: { type: 'string' },
            icon: { type: 'string' },
            isActive: { type: 'boolean' },
            displayOrder: { type: 'number' },
          },
        }),
        responses: {
          200: okResponse('Skill updated', successExample(skillExample)),
          ...withErrors(400, 404, 409),
        },
      },
      delete: {
        tags: ['Skills'],
        summary: 'Soft delete skill (Admin)',
        security: bearerSecurity,
        parameters: [objectIdParam('id', 'Skill ID')],
        responses: {
          204: noContentResponse(),
          ...withErrors(404),
        },
      },
    },
  },
};
