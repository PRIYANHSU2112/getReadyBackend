import http from 'http';
import { logger } from '@getready/logger';
import { RabbitMQConnection } from '@getready/rabbitmq';
import { config } from './config/index.js';
import { createApp } from './app.js';
import { DlqMonitorJob } from './jobs/dlq-monitor.job.js';
import { SlotCleanupJob } from './jobs/slot-cleanup.job.js';

async function startServer() {
  try {
    const app = createApp();

    let rmqConnection = null;
    let dlqJob = null;
    let cleanupJob = null;

    try {
      rmqConnection = new RabbitMQConnection(config.rabbitmq.url, 'worker-service');
      await rmqConnection.connect();
      app.locals.rmqConnected = true;

      dlqJob = new DlqMonitorJob(rmqConnection);
      await dlqJob.start();
    } catch (err) {
      logger.warn({ err }, 'RabbitMQ connection deferred in worker-service');
    }

    cleanupJob = new SlotCleanupJob(null);
    cleanupJob.start(60000);

    const server = http.createServer(app);

    server.listen(config.port, () => {
      logger.info({ port: config.port, service: 'worker-service' }, 'Worker Service listening on port ' + config.port);
    });

    const shutdown = async (signal) => {
      logger.info({ signal }, 'Shutting down Worker Service...');
      if (cleanupJob) cleanupJob.stop();
      server.close(async () => {
        if (rmqConnection) await rmqConnection.close();
        logger.info('Worker HTTP server and RabbitMQ closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ error }, 'Failed to start Worker Service');
    process.exit(1);
  }
}

startServer();
