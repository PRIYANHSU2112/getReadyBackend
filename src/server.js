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

    // Align indexes (partial unique + sort helpers)
    try {
      const { UserModel } = await import('./modules/user/user.model.js');
      const { RoleModel } = await import('./modules/rbac/role.model.js');
      const { PermissionModel } = await import('./modules/rbac/permission.model.js');
      const { NotificationModel } = await import('./modules/notification/notification.model.js');
      const { AddressModel } = await import('./modules/address/address.model.js');
      const { BannerModel } = await import('./modules/banner/banner.model.js');
      const { FilterModel } = await import('./modules/filter/filter.model.js');
      const { FilterValueModel } = await import('./modules/filter/filter-value.model.js');
      await Promise.all([
        UserModel.syncIndexes(),
        RoleModel.syncIndexes(),
        PermissionModel.syncIndexes(),
        NotificationModel.syncIndexes(),
        AddressModel.syncIndexes(),
        BannerModel.syncIndexes(),
        FilterModel.syncIndexes(),
        FilterValueModel.syncIndexes(),
      ]);
      logger.info('Mongo indexes synced');
    } catch (indexErr) {
      logger.warn({ err: indexErr }, 'Index sync failed — uniqueness/sort may be wrong until fixed');
    }

    // Connect Redis (optional — fall back to in-memory cache via createShared)
    if (config.redis.enabled) {
      try {
        await RedisClient.getInstance().connect();
        const ok = await RedisClient.getInstance().ping();
        if (!ok) {
          throw new Error('Redis ping failed');
        }
      } catch (redisErr) {
        logger.warn(
          { err: redisErr },
          '[Redis] Unavailable — using in-memory cache. Start Redis or set REDIS_ENABLED=false.',
        );
        try {
          await RedisClient.getInstance().disconnect();
        } catch {
          // ignore cleanup errors
        }
      }
    } else {
      logger.warn('[Redis] Disabled — using in-memory cache (set REDIS_ENABLED=true to enable Redis)');
    }

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

  if (config.redis.enabled) {
    await RedisClient.getInstance().disconnect();
  }
  await mongooseConnection.disconnect();

  logger.info('Server stopped');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

bootstrap();
