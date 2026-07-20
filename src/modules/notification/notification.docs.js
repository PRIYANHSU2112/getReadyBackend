export const notificationDocs = {
  paths: {
    '/api/v1/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List my notifications (stub)',
        responses: { 200: { description: 'Notification list' } },
      },
    },
  },
};
