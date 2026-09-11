import http from 'http';
import { logger } from '@getready/logger';
import { RabbitMQConnection, EventConsumer } from '@getready/rabbitmq';
import { config } from './config/index.js';
import { connectDatabase } from './database/index.js';
import { createApp } from './app.js';
import { NotificationConsumer } from './events/notification.consumer.js';

async function startServer() {
  try {
    await connectDatabase(config.database.uri);

    const { app, notificationService } = createApp();
    app.locals.dbConnected = true;

    let rmqConnection = null;
    try {
      rmqConnection = new RabbitMQConnection(config.rabbitmq.url, 'notification-service');
      await rmqConnection.connect();

      const eventConsumer = new EventConsumer(rmqConnection, 'notification.events.queue', 'notification-service');
      const notificationConsumer = new NotificationConsumer(eventConsumer, notificationService);
      await notificationConsumer.start();
    } catch (err) {
      logger.warn({ err }, 'RabbitMQ connection deferred or unavailable at startup in notification-service');
    }

    const server = http.createServer(app);

    server.listen(config.port, () => {
      logger.info({ port: config.port, service: 'notification-service' }, 'Notification Service listening on port ' + config.port);
    });

    const shutdown = async (signal) => {
      logger.info({ signal }, 'Shutting down Notification Service...');
      server.close(async () => {
        if (rmqConnection) await rmqConnection.close();
        logger.info('HTTP server and RabbitMQ closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ error }, 'Failed to start Notification Service');
    process.exit(1);
  }
}

startServer();
