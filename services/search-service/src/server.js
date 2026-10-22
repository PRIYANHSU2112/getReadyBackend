import http from 'http';
import mongoose from 'mongoose';
import { logger } from '@getready/logger';
import { RabbitMQConnection } from '@getready/rabbitmq';
import { config } from './config/index.js';
import { createApp } from './app.js';
import { indexerService } from './services/indexer.service.js';
import { SearchSyncConsumer } from './events/search.consumer.js';

async function startServer() {
  try {
    const app = createApp();

    // 1. MongoDB Connection
    try {
      if (config.mongoUri) {
        await mongoose.connect(config.mongoUri, {
          family: 4,
          serverSelectionTimeoutMS: 15000,
        });
        logger.info('Search Service connected to MongoDB');
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'MongoDB connection deferred in Search Service');
    }

    // 2. Ensure Elasticsearch Indices exist
    await indexerService.ensureIndices();

    // 3. RabbitMQ Sync Consumer
    let rmqConnection = null;
    let syncConsumer = null;

    try {
      rmqConnection = new RabbitMQConnection(config.rabbitmq.url, 'search-service');
      await rmqConnection.connect();
      syncConsumer = new SearchSyncConsumer(rmqConnection);
      await syncConsumer.start();
    } catch (err) {
      logger.warn({ err: err.message }, 'RabbitMQ connection deferred in Search Service');
    }

    const server = http.createServer(app);

    server.listen(config.port, () => {
      logger.info({ port: config.port, service: 'search-service' }, `Search Service running on port ${config.port}`);
    });

    const shutdown = async (signal) => {
      logger.info({ signal }, 'Shutting down Search Service...');
      if (syncConsumer) await syncConsumer.stop();
      server.close(async () => {
        if (rmqConnection) await rmqConnection.close();
        if (mongoose.connection.readyState === 1) await mongoose.disconnect();
        logger.info('Search Service terminated gracefully.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ error }, 'Failed to start Search Service');
    process.exit(1);
  }
}

startServer();
