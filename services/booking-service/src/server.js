import http from 'http';
import { logger } from '@getready/logger';
import { RabbitMQConnection, EventPublisher, EventConsumer } from '@getready/rabbitmq';
import { config } from './config/index.js';
import { mongooseConnection } from './database/index.js';
import { BookingConsumer } from './events/booking.consumer.js';
import { createApp } from './app.js';

let server;
let rabbitConnection;

async function bootstrap() {
  try {
    await mongooseConnection.connect(config.mongoUri);

    let eventPublisher = null;
    let bookingConsumer = null;

    try {
      rabbitConnection = new RabbitMQConnection(config.rabbitmqUrl, 'booking-service');
      await rabbitConnection.connect();
      eventPublisher = new EventPublisher(rabbitConnection, 'booking-service');
      const eventConsumer = new EventConsumer(rabbitConnection, 'booking-service');

      const { app, bookingService } = createApp({ eventPublisher });
      bookingConsumer = new BookingConsumer(eventConsumer, bookingService);
      await bookingConsumer.start();

      server = http.createServer(app);
    } catch (rabbitErr) {
      logger.warn({ err: rabbitErr }, 'RabbitMQ connection failed on booking-service startup; continuing with degraded messaging');
      const { app } = createApp();
      server = http.createServer(app);
    }

    server.listen(config.port, () => {
      logger.info(
        { port: config.port, service: 'booking-service' },
        `Booking Service running on port ${config.port}`,
      );
    });
  } catch (err) {
    logger.error(err, 'Booking Service startup failed');
    process.exit(1);
  }
}

async function shutdown() {
  logger.info('Booking Service shutting down gracefully...');
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (rabbitConnection) {
    await rabbitConnection.close();
  }
  await mongooseConnection.disconnect();
  logger.info('Booking Service stopped');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

bootstrap();
