import { logger } from '@getready/logger';

/**
 * Idempotency Helper to prevent duplicate processing of RabbitMQ events.
 */
export class IdempotencyService {
  /**
   * @param {import('mongoose').Model} idempotencyModel
   * @param {string} serviceName
   */
  constructor(idempotencyModel, serviceName) {
    this.model = idempotencyModel;
    this.serviceName = serviceName;
  }

  /**
   * Execute an event handler with idempotency guarantee.
   *
   * @param {string} eventId - Unique event UUID
   * @param {string} eventType - e.g. "PaymentSucceeded"
   * @param {() => Promise<any>} handlerFn - Business processing function
   * @returns {Promise<{ processed: boolean, result?: any, reason?: string }>}
   */
  async process(eventId, eventType, handlerFn) {
    if (!this.model) {
      // Fallback if no idempotency model provided
      const result = await handlerFn();
      return { processed: true, result };
    }

    // 1. Check if already processed
    const existing = await this.model.findOne({ eventId });
    if (existing) {
      logger.info(
        { service: this.serviceName, eventId, eventType, processedAt: existing.createdAt },
        'Duplicate event ignored by IdempotencyService',
      );
      return { processed: false, reason: 'DUPLICATE_EVENT' };
    }

    // 2. Process the event
    const result = await handlerFn();

    // 3. Mark as processed
    try {
      await this.model.create({
        eventId,
        eventType,
        service: this.serviceName,
        processedAt: new Date(),
      });
    } catch (err) {
      // If duplicate key error on eventId, means concurrent worker processed it
      if (err.code === 11000) {
        logger.warn(
          { service: this.serviceName, eventId },
          'Concurrent duplicate event race detected in IdempotencyService',
        );
        return { processed: false, reason: 'CONCURRENT_DUPLICATE' };
      }
      throw err;
    }

    return { processed: true, result };
  }
}
