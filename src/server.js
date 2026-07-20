import http from 'http';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import config from './core/config/index.js';
import { logger } from './core/logger/pino.logger.js';
import { mongooseConnection } from './core/database/index.js';
import { RedisClient } from './core/redis/RedisClient.js';
import { createApp } from './app.js';
import { createShared } from './core/shared.js';

let server;

// Security Middleware
function applySecurityMiddleware(app) {
  app.use(helmet());

  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    }),
  );

  app.use(compression());

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per IP
    }),
  );
}

// Start Server
async function bootstrap() {
  try {
    // Connect Database
    await mongooseConnection.connect(config.mongodbUri);

    // Connect Redis
    await RedisClient.getInstance().connect();

    // Create Express App
    const app = createApp({
      shared: createShared(),
      applyMiddleware: applySecurityMiddleware,
    });

    server = http.createServer(app);

    server.listen(config.port, () => {
      logger.info(`${config.appName} running on port ${config.port}`);
    });
  } catch (err) {
    logger.error(err, 'Server startup failed');
    process.exit(1);
  }
}

// Graceful Shutdown
async function shutdown() {
  logger.info('Shutting down...');

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await RedisClient.getInstance().disconnect();
  await mongooseConnection.disconnect();

  logger.info('Server stopped');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

bootstrap();
