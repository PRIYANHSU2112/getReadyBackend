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
      rabbitConnection = new RabbitMQConnection(config.rabbitmqUrl, 'auth-service');
      await rabbitConnection.connect();
      eventPublisher = new EventPublisher(rabbitConnection, 'auth-service');
    } catch (rabbitErr) {
      logger.warn({ err: rabbitErr }, 'RabbitMQ connection failed on auth-service startup; continuing with degraded messaging');
    }

    // 3. Create Express App
    const app = createApp({ eventPublisher });
    server = http.createServer(app);

    server.listen(config.port, () => {
      logger.info(
        { port: config.port, service: 'auth-service' },
        `Auth Service running on port ${config.port}`,
      );
    });
  } catch (err) {
    logger.error(err, 'Auth Service startup failed');
    process.exit(1);
  }
}

async function shutdown() {
  logger.info('Auth Service shutting down gracefully...');
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (rabbitConnection) {
    await rabbitConnection.close();
  }
  await mongooseConnection.disconnect();
  logger.info('Auth Service stopped');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

bootstrap();
