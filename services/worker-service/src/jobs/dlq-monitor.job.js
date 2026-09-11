import { logger } from '@getready/logger';
import { rabbitmqDlqMessagesTotal } from '@getready/metrics';
import { QUEUES } from '@getready/rabbitmq';

export class DlqMonitorJob {
  constructor(rmqConnection) {
    this.rmqConnection = rmqConnection;
    this.isRunning = false;
  }

  async start() {
    this.isRunning = true;
    try {
      const channel = await this.rmqConnection.getChannel();
      await channel.assertQueue(QUEUES.DLQ, { durable: true });

      // Consume dead-letter messages for observability and alerting
      channel.consume(QUEUES.DLQ, (msg) => {
        if (!msg) return;
        try {
          const content = JSON.parse(msg.content.toString());
          const headers = msg.properties.headers || {};
          const death = headers['x-death'] || [];

          rabbitmqDlqMessagesTotal.inc({ service: headers['x-origin-service'] || 'unknown', queue: QUEUES.DLQ });

          logger.error(
            {
              payload: content,
              deathCount: headers['x-retry-count'] || death[0]?.count || 1,
              originalQueue: death[0]?.queue || 'unknown',
              reason: headers['x-error-message'] || 'Dead lettered after max retries',
            },
            'DLQ Message Received for Inspection',
          );

          // Acknowledge from DLQ once logged/stored
          channel.ack(msg);
        } catch (err) {
          logger.error({ err }, 'Error processing DLQ message');
          channel.nack(msg, false, false);
        }
      });

      logger.info('DLQ Monitor active and consuming DLQ messages');
    } catch (err) {
      logger.error({ err }, 'Failed to start DLQ Monitor Job');
    }
  }
}
