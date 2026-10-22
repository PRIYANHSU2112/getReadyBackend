import { logger } from '@getready/logger';
import { config } from './config/index.js';
import { mongooseConnection } from './database/index.js';
import { createApp } from './app.js';

async function startServer() {
  try {
    await mongooseConnection();

    const app = createApp();

    const server = app.listen(config.port, () => {
      logger.info(`👑 GetReady Membership Service listening on port ${config.port}`);
    });

    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}. Shutting down Membership Service gracefully...`);
      server.close(async () => {
        logger.info('HTTP server closed.');
        try {
          const mongoose = (await import('mongoose')).default;
          await mongoose.disconnect();
          logger.info('MongoDB disconnected.');
        } catch (err) {
          logger.error({ err }, 'Error during MongoDB disconnect');
        }
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (err) {
    logger.fatal({ err }, 'Failed to start Membership Service');
    process.exit(1);
  }
}

startServer();
