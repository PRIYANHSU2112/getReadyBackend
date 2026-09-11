import http from 'http';
import { logger } from '@getready/logger';
import { RabbitMQConnection, EventPublisher } from '@getready/rabbitmq';
import { config } from './config/index.js';
import { mongooseConnection } from './database/index.js';
import { createApp } from './app.js';

let server;
let rabbitConnection;

async function bootstrap() {
  try {
    // 1. Connect MongoDB
    await mongooseConnection.connect(config.mongoUri);

    // 2. Connect RabbitMQ
    let eventPublisher = null;
    try {
      rabbitConnection = new RabbitMQConnection(config.rabbitmqUrl, 'user-service');
      await rabbitConnection.connect();
      eventPublisher = new EventPublisher(rabbitConnection, 'user-service');
    } catch (rabbitErr) {
      logger.warn({ err: rabbitErr }, 'RabbitMQ connection failed on user-service startup; continuing with degraded messaging');
    }

    // 3. Create Express App
    const { app, rbacService } = createApp({ eventPublisher });

    // Seed RBAC defaults
    await rbacService.seedDefaults().catch((err) => {
      logger.warn({ err }, 'RBAC seed failed on boot');
    });

    server = http.createServer(app);

    server.listen(config.port, () => {
      logger.info(
        { port: config.port, service: 'user-service' },
        `User Service running on port ${config.port}`,
      );
    });
  } catch (err) {
    logger.error(err, 'User Service startup failed');
    process.exit(1);
  }
}

async function shutdown() {
  logger.info('User Service shutting down gracefully...');
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (rabbitConnection) {
    await rabbitConnection.close();
  }
  await mongooseConnection.disconnect();
  logger.info('User Service stopped');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

bootstrap();
