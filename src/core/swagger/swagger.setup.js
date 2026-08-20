import path from 'path';
import { fileURLToPath } from 'url';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import config from '../config/index.js';
import { swaggerDocs } from './docs.registry.js';
import { openApiComponents } from './swagger.common.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function generateSwaggerSpec(moduleDocs = swaggerDocs) {
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
      servers: [
        { url: '/', description: 'Same origin as this Swagger page (recommended)' },
        { url: config.appUrl, description: 'Configured APP_URL' },
        { url: 'http://localhost:5000', description: 'Local default' },
        { url: 'http://localhost:3000', description: 'Local port 3000' },
      ],
      components: openApiComponents,
      security: [{ bearerAuth: [] }],
      tags: [
        { name: 'Health', description: 'Liveness and readiness' },
        { name: 'Auth - Admin', description: 'Admin / Super Admin password auth (public)' },
        { name: 'Auth - Mobile', description: 'Customer / Beautician OTP auth (public)' },
        { name: 'Auth', description: 'Authenticated auth helpers' },
        { name: 'Users', description: 'User profile, preferences, addresses, and admin CRUD' },
        { name: 'Addresses', description: 'Customer saved delivery/service addresses' },
        { name: 'Notifications', description: 'In-app notification inbox, unread counts, and push preferences' },
        { name: 'RBAC', description: 'Roles and permissions management (Super Admin only)' },
        { name: 'Banners', description: 'App home banners (carousel, promo cards)' },
        { name: 'Filters', description: 'Quick-filter pills and search facets' },
        { name: 'Categories', description: 'Service catalog categories and nested hierarchies' },
        { name: 'Services', description: 'Salon services, pricing, variants, and admin approval workflows' },
        { name: 'Packages', description: 'Curated service bundles and discount packages' },
        { name: 'Skills', description: 'Beautician skills taxonomy and service mappings' },
        {
          name: 'Beautician Profiles',
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
        {
          name: 'Wallet',
          description: 'Customer wallet balance, top-up, Razorpay payments, and loyalty rules.',
        },
        {
          name: 'Cart',
          description: 'Shopping cart, item quantities, mandatory hygiene kit, coupons, and points redemption.',
        },
        {
          name: 'Hygiene Kits',
          description: 'Safety & hygiene kit options, pricing, and included items.',
        },
      ],
      paths: Object.assign({}, ...moduleDocs.map((d) => d.paths || {})),
    },
    apis: [],
  };

  return swaggerJsdoc(options);
}

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

  const spec = generateSwaggerSpec(moduleDocs);

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
