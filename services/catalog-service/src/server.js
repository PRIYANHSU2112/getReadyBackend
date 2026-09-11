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
    await mongooseConnection.connect(config.mongoUri);

    let eventPublisher = null;
    try {
      rabbitConnection = new RabbitMQConnection(config.rabbitmqUrl, 'catalog-service');
      await rabbitConnection.connect();
      eventPublisher = new EventPublisher(rabbitConnection, 'catalog-service');
    } catch (rabbitErr) {
      logger.warn({ err: rabbitErr }, 'RabbitMQ connection failed on catalog-service startup; continuing with degraded messaging');
    }

    const app = createApp({ eventPublisher });
    server = http.createServer(app);

    server.listen(config.port, () => {
      logger.info(
        { port: config.port, service: 'catalog-service' },
        `Catalog Service running on port ${config.port}`,
      );
    });
  } catch (err) {
    logger.error(err, 'Catalog Service startup failed');
    process.exit(1);
  }
}

async function shutdown() {
  logger.info('Catalog Service shutting down gracefully...');
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (rabbitConnection) {
    await rabbitConnection.close();
  }
  await mongooseConnection.disconnect();
  logger.info('Catalog Service stopped');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

bootstrap();
