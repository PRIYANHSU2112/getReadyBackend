import http from 'http';
import { logger } from '@getready/logger';
import { RabbitMQConnection, EventPublisher, EventConsumer } from '@getready/rabbitmq';
import { config } from './config/index.js';
import { connectDatabase } from './database/index.js';
import { createApp } from './app.js';
import { WalletConsumer } from './events/wallet.consumer.js';

async function startServer() {
  try {
    await connectDatabase(config.database.uri);

    let publisher = null;
    let rmqConnection = null;

    try {
      rmqConnection = new RabbitMQConnection(config.rabbitmq.url, 'wallet-service');
      await rmqConnection.connect();
      publisher = new EventPublisher(rmqConnection, 'wallet-service');
    } catch (err) {
      logger.warn({ err }, 'RabbitMQ connection deferred or unavailable at startup');
    }

    const { app, walletService } = createApp(publisher);
    app.locals.dbConnected = true;

    if (rmqConnection) {
      const eventConsumer = new EventConsumer(rmqConnection, 'wallet-service');
      const walletConsumer = new WalletConsumer(eventConsumer, walletService);
      await walletConsumer.start();
    }

    const server = http.createServer(app);

    server.listen(config.port, () => {
      logger.info({ port: config.port, service: 'wallet-service' }, 'Wallet Service listening on port ' + config.port);
    });

    const shutdown = async (signal) => {
      logger.info({ signal }, 'Shutting down Wallet Service...');
      server.close(async () => {
        if (rmqConnection) await rmqConnection.close();
        logger.info('HTTP server and RabbitMQ closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ error }, 'Failed to start Wallet Service');
    process.exit(1);
  }
}

startServer();
