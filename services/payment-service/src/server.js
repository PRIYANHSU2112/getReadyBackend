import http from 'http';
import { logger } from '@getready/logger';
import { RabbitMQConnection, EventPublisher } from '@getready/rabbitmq';
import { config } from './config/index.js';
import { connectDatabase } from './database/index.js';
import { createApp } from './app.js';

async function startServer() {
  try {
    await connectDatabase(config.database.uri);

    let publisher = null;
    let rmqConnection = null;

    try {
      rmqConnection = new RabbitMQConnection(config.rabbitmq.url, 'payment-service');
      await rmqConnection.connect();
      publisher = new EventPublisher(rmqConnection, 'payment-service');
    } catch (err) {
      logger.warn({ err }, 'RabbitMQ connection deferred or unavailable at startup');
    }

    const { app } = createApp(publisher);
    app.locals.dbConnected = true;

    const server = http.createServer(app);

    server.listen(config.port, () => {
      logger.info({ port: config.port, service: 'payment-service' }, 'Payment Service listening on port ' + config.port);
    });

    const shutdown = async (signal) => {
      logger.info({ signal }, 'Shutting down Payment Service...');
      server.close(async () => {
        if (rmqConnection) await rmqConnection.close();
        logger.info('HTTP server and RabbitMQ closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ error }, 'Failed to start Payment Service');
    process.exit(1);
  }
}

startServer();
