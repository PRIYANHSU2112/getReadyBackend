import { logger } from '@getready/logger';

export class OutboxPublisher {
  /**
   * @param {import('mongoose').Model} outboxModel
   * @param {import('./publisher.js').EventPublisher} eventPublisher
   * @param {object} [options]
   */
  constructor(outboxModel, eventPublisher, options = {}) {
    this.outboxModel = outboxModel;
    this.eventPublisher = eventPublisher;
    this.batchSize = options.batchSize || 50;
    this.pollIntervalMs = options.pollIntervalMs || 2000;
    this.timer = null;
    this.isRunning = false;
  }

  start() {
    if (this.timer) return;
    this.isRunning = true;
    this.timer = setInterval(() => {
      this.publishPending().catch((err) => {
        logger.error({ err }, 'Error during outbox polling');
      });
    }, this.pollIntervalMs);
    logger.info('OutboxPublisher background polling started');
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logger.info('OutboxPublisher stopped');
  }

  async publishPending() {
    if (!this.outboxModel || !this.eventPublisher) return 0;

    const pending = await this.outboxModel
      .find({ status: 'PENDING', attempts: { $lt: 5 } })
      .sort({ createdAt: 1 })
      .limit(this.batchSize)
      .exec();

    if (!pending.length) return 0;

    let successCount = 0;
    for (const record of pending) {
      try {
        const routingKey = record.routingKey || `${record.aggregateType.toLowerCase()}.${record.eventType.toLowerCase()}`;
        await this.eventPublisher.publish(
          routingKey,
          record.eventType,
          record.payload,
          {
            aggregateId: record.aggregateId,
            correlationId: record.correlationId,
            causationId: record.causationId,
            eventVersion: record.eventVersion || 1,
          },
        );

        record.status = 'PUBLISHED';
        record.publishedAt = new Date();
        await record.save();
        successCount += 1;
      } catch (err) {
        record.attempts = (record.attempts || 0) + 1;
        record.lastError = err.message;
        if (record.attempts >= 5) {
          record.status = 'FAILED';
        }
        await record.save();
        logger.error({ err, outboxId: record._id, eventType: record.eventType }, 'Failed to publish outbox record');
      }
    }

    return successCount;
  }
}
