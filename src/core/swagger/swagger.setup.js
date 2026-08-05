import path from 'path';
import { fileURLToPath } from 'url';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import config from '../config/index.js';
import { swaggerDocs } from './docs.registry.js';
import { openApiComponents } from './swagger.common.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Mount Swagger UI. Docs come from the central registry by default.
 * @param {import('express').Express} app
 * @param {object[]} [moduleDocs]
 */
export function setupSwagger(app, moduleDocs = swaggerDocs) {
  if (!config.swaggerEnabled) return;

  // Auto token capture + refresh helper for Try it out
  app.get('/swagger-assets/auth-helper.js', (_req, res) => {
    res.type('application/javascript');
    res.sendFile(path.join(__dirname, 'swagger-auth-helper.js'));
  });

  const options = {
    definition: {
      openapi: '3.0.3',
      info: {
        title: `${config.appName} API`,
        version: '1.0.0',
        description: [
          'Salon modular monolith API.',
          '',
          '### How to use Try it out (auto token refresh)',
          '1. Call **Auth - Admin → Admin login** or **Auth - Mobile → Verify OTP**.',
          '2. Tokens are **auto-saved** from `data.accessToken` + `data.refreshToken` — no need to paste manually.',
          '3. Protected calls use the saved access token. On **401**, Swagger auto-calls `POST /api/v1/auth/refresh` and retries once.',
          '4. Optional: click **Authorize** only if you want to paste a token by hand.',
          '5. Hard-refresh the docs page if you logged out / cleared storage.',
          '',
          '### JSON tips',
          '- Use double quotes only.',
          '- Do **not** leave trailing commas in request bodies.',
        ].join('\n'),
      },
      // Relative "/" keeps Try it out on the same host as /api-docs (avoids silent empty responses)
      servers: [
        { url: '/', description: 'Same origin as this Swagger page (recommended)' },
        { url: config.appUrl, description: 'Configured APP_URL' },
        { url: 'http://localhost:5000', description: 'Local default' },
        { url: 'http://localhost:3000', description: 'Local port 3000' },
      ],
      components: openApiComponents,
      // Default security; public routes override with security: []
      security: [{ bearerAuth: [] }],
      tags: [
        { name: 'Health', description: 'Liveness and readiness' },
        { name: 'Auth - Admin', description: 'Admin / Super Admin password auth (public)' },
        { name: 'Auth - Mobile', description: 'Customer / Beautician OTP auth (public)' },
        { name: 'Auth', description: 'Authenticated auth helpers' },
        { name: 'Cart', description: 'Customer cart — Bearer auth only (items, benefits, pricing, book-for-others)' },
        { name: 'Members', description: 'Family & friends profiles — Bearer auth only (book-for-others)' },
        {
          name: 'Slots',
          description:
            'Admin-created bookable windows + public available-by-date. Soft-hold/confirm happens in Booking + payment (later).',
        },
        {
          name: 'Blogs',
          description:
            'CMS blogs — public home/list/detail; auth like; admin CRUD (`blogs.*`). Categories reuse existing Categories module.',
        },
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
        {
          name: 'Categories',
          description: 'Service categories.',
        },
        {
          name: 'Services',
          description: 'Salon services.',
        },
        {
          name: 'Service Change Requests',
          description: 'Admin panel review queue for beautician service updates.',
        },
        {
          name: 'Skills',
          description: 'Admin-managed skills master list + public beautician selection (`GET /skills/active`).',
        },
        {
          name: 'Beautician Profile',
          description: 'Beautician profile management, selfie KYC upload, submission, and admin review queue.',
        },
        {
          name: 'Beautician Work History',
          description: 'Beautician salon work experience history.',
        },
        {
          name: 'Beautician Certificates',
          description: 'Beautician uploaded qualification certificates.',
        },
        {
          name: 'Bank Details',
          description: 'Beautician payout bank account details, passbook image, and admin verification.',
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
      customJs: '/swagger-assets/auth-helper.js',
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
