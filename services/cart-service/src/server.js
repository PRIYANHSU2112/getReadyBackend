import http from 'http';
import { logger } from '@getready/logger';
import { config } from './config/index.js';
import { connectDatabase } from './database/index.js';
import { createApp } from './app.js';

async function startServer() {
  try {
    await connectDatabase(config.database.uri);

    const app = createApp();
    app.locals.dbConnected = true;

    const server = http.createServer(app);

    server.listen(config.port, () => {
      logger.info({ port: config.port, service: 'cart-service' }, 'Cart Service listening on port ' + config.port);
    });

    const shutdown = async (signal) => {
      logger.info({ signal }, 'Shutting down Cart Service...');
      server.close(async () => {
        logger.info('HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ error }, 'Failed to start Cart Service');
    process.exit(1);
  }
}

startServer();
