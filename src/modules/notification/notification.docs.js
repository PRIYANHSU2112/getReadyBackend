import {
  bearerSecurity,
  OBJECT_ID,
  paginationMeta,
  okResponse,
  withErrors,
  successExample,
  pageQueryParams,
} from '../../core/swagger/swagger.common.js';

const notificationExample = {
  id: '64f0c2a1b4e1c2d3e4f50607',
  userId: OBJECT_ID,
  title: 'Welcome to GetReady',
  body: 'Your account is ready. Book your first appointment today.',
  read: false,
  createdAt: '2026-07-21T09:31:00.000Z',
  updatedAt: '2026-07-21T09:31:00.000Z',
};

export const notificationDocs = {
  paths: {
    '/api/v1/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List my notifications',
        description: '**Auth:** Bearer JWT required. Returns notifications for the authenticated user only.',
        security: bearerSecurity,
        parameters: pageQueryParams({ page: 1, limit: 10 }),
        responses: {
          ...okResponse(
            successExample([notificationExample], {
              ...paginationMeta,
              total: 1,
            }),
          ),
          ...withErrors(401, 422, 500),
        },
      },
    },
  },
};
