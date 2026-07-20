import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import config from '../config/index.js';
import { swaggerDocs } from './docs.registry.js';

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
        description: 'MVRSC Modular Monolith API',
      },
      servers: [{ url: config.appUrl, description: config.env }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
      paths: Object.assign({}, ...moduleDocs.map((d) => d.paths || {})),
    },
    apis: [],
  };

  const spec = swaggerJsdoc(options);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
}
