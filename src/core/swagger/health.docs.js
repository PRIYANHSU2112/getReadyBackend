import {
  publicSecurity,
  okResponse,
  withErrors,
  successExample,
} from './swagger.common.js';

export const healthDocs = {
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness probe',
        description: 'No authentication. Returns process liveness.',
        security: publicSecurity,
        responses: {
          ...okResponse(successExample({ status: 'ok' })),
          ...withErrors(500),
        },
      },
    },
    '/ready': {
      get: {
        tags: ['Health'],
        summary: 'Readiness probe',
        description: 'Checks MongoDB (and Redis when enabled). No authentication.',
        security: publicSecurity,
        responses: {
          ...okResponse(
            successExample({
              status: 'ready',
              checks: { mongodb: 'up', redis: 'up' },
            }),
          ),
          503: {
            description: 'Service Unavailable — a dependency is down',
            content: {
              'application/json': {
                example: {
                  success: false,
                  data: {
                    status: 'not_ready',
                    checks: { mongodb: 'down', redis: 'up' },
                  },
                },
              },
            },
          },
          ...withErrors(500),
        },
      },
    },
  },
};
