import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import config from '../config/index.js';
import { swaggerDocs } from './docs.registry.js';
import { openApiComponents } from './swagger.common.js';

/**
 * Mount Swagger UI. Docs come from the central registry by default.
 * @param {import('express').Express} app
 * @param {object[]} [moduleDocs]
 */
export function setupSwagger(app, moduleDocs = swaggerDocs) {
  if (!config.swaggerEnabled) return;

  const options = {
    definition: {
      openapi: '3.0.3',
      info: {
        title: `${config.appName} API`,
        version: '1.0.0',
        description: [
          'Salon modular monolith API.',
          '',
          '### How to use Try it out',
          '1. Call **Auth - Admin → Admin / Super Admin login** with seeded credentials (e.g. `superadmin@salon.com` / `SuperAdmin@123`).',
          '2. Copy `data.token` from the response.',
          '3. Click **Authorize**, paste the token (without the word `Bearer`), then Authorize.',
          '4. Call protected endpoints. Staff APIs require role permissions from the RBAC registry.',
          '',
          '### JSON tips',
          '- Use double quotes only.',
          '- Do **not** leave trailing commas in request bodies.',
        ].join('\n'),
      },
      servers: [
        { url: config.appUrl, description: 'Current environment' },
        { url: 'http://localhost:5000', description: 'Local default' },
      ],
      components: openApiComponents,
      // Default security; public routes override with security: []
      security: [{ bearerAuth: [] }],
      tags: [
        { name: 'Health', description: 'Liveness and readiness' },
        { name: 'Auth - Admin', description: 'Admin / Super Admin password auth (public)' },
        { name: 'Auth - Mobile', description: 'Customer / Beautician OTP auth (public)' },
        { name: 'Auth', description: 'Authenticated auth helpers' },
        { name: 'Users - Self', description: 'Own profile — any authenticated user' },
        {
          name: 'Users - Admin / Beautician',
          description: 'Staff read (`users.read`). Default: Admin + Beautician',
        },
        {
          name: 'Users - Admin',
          description: 'User management (`users.create` / `users.update` / `users.delete`)',
        },
        {
          name: 'RBAC',
          description:
            'Roles & permissions — Admin (`roles.*` / `permissions.*`). Super Admin bypasses.',
        },
        { name: 'Notifications', description: 'Current user notifications' },
        {
          name: 'Addresses',
          description: 'Own addresses — Bearer auth only (no RBAC permission keys)',
        },
        {
          name: 'Banners',
          description:
            'CMS banners — public GET /active; admin CRUD (`banners.*`). Super Admin bypasses.',
        },
        {
          name: 'Filters',
          description:
            'Generic filter groups/values — public slim GET /public; admin CRUD (`filters.*`).',
        },
      ],
      paths: Object.assign({}, ...moduleDocs.map((d) => d.paths || {})),
    },
    apis: [],
  };

  const spec = swaggerJsdoc(options);
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: `${config.appName} API Docs`,
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'list',
        filter: true,
        tryItOutEnabled: true,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    }),
  );
}
