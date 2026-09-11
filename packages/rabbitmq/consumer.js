import { logger } from '@getready/logger';
import { runWithTraceContext } from '@getready/tracing';
import {
  rabbitmqConsumedTotal,
  rabbitmqConsumerErrorsTotal,
  rabbitmqRetryCountTotal,
  rabbitmqDlqMessagesTotal,
} from '@getready/metrics';
import { EXCHANGES, RETRY_CONFIG } from './constants.js';

export class EventConsumer {
  /**
   * @param {import('./connection.js').RabbitMQConnection} rabbitConnection
   * @param {string} serviceName - e.g. "notification-service"
   * @param {object} [options]
   */
  constructor(rabbitConnection, serviceName, options = {}) {
    this.rabbitConnection = rabbitConnection;
    this.serviceName = serviceName;
    this.prefetch = options.prefetch || 10;
    this.consumers = new Map();
  }

  /**
   * Subscribe a handler to a set of routing keys on the domain events exchange.
   *
   * @param {string} queueName - Unique queue name, e.g. "notification-service.user-events"
   * @param {string[]} routingPatterns - e.g. ["user.created", "booking.#"]
   * @param {(event: object, rawMsg: object) => Promise<void>} handler
   * @param {object} [options]
   */
  async subscribe(queueName, routingPatterns, handler, options = {}) {
    const channel = this.rabbitConnection.getChannel();
    await channel.prefetch(options.prefetch || this.prefetch);

    // 1. Assert main consumer queue with DLX
    const mainQueue = await channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': EXCHANGES.DLX,
        'x-dead-letter-routing-key': queueName,
      },
    });

    // 2. Bind routing patterns to domain events exchange
    for (const pattern of routingPatterns) {
      await channel.bindQueue(queueName, EXCHANGES.DOMAIN_EVENTS, pattern);
      logger.info(
        { service: this.serviceName, queue: queueName, pattern },
        'Bound queue to routing pattern',
      );
    }

    // 3. Setup multi-level Retry Queues
    await this.#setupRetryQueues(channel, queueName);

    // 4. Start consuming
    const { consumerTag } = await channel.consume(
      queueName,
      async (msg) => {
        if (!msg) return;
        await this.#handleMessage(channel, queueName, msg, handler);
      },
      { noAck: false },
    );

    this.consumers.set(queueName, consumerTag);
    logger.info({ service: this.serviceName, queue: queueName, consumerTag }, 'Consumer started');
    return consumerTag;
  }

  async #setupRetryQueues(channel, queueName) {
    for (let i = 0; i < RETRY_CONFIG.DELAYS_MS.length; i += 1) {
      const level = i + 1;
      const retryQueueName = `${queueName}.retry.${level}`;
      const delayMs = RETRY_CONFIG.DELAYS_MS[i];

      // Dead-letter back to main queue once TTL expires
      await channel.assertQueue(retryQueueName, {
        durable: true,
        arguments: {
          'x-message-ttl': delayMs,
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': queueName,
        },
      });

      // Bind to retry exchange with routing key
      await channel.bindQueue(retryQueueName, EXCHANGES.RETRY, `${queueName}.retry.${level}`);
    }
  }

  async #handleMessage(channel, queueName, msg, handler) {
    let envelope;
    try {
      envelope = JSON.parse(msg.content.toString());
    } catch (parseErr) {
      logger.error({ err: parseErr, queue: queueName }, 'Received unparseable message. Routing to DLQ');
      await this.#routeToDlq(channel, queueName, msg, null, 'UNPARSEABLE_JSON', parseErr.message);
      channel.ack(msg);
      return;
    }

    const correlationId =
      envelope.correlationId ||
      msg.properties.headers?.['x-correlation-id'] ||
      'unknown-correlation';

    const eventType = envelope.eventType || msg.properties.type || 'UnknownEvent';

    await runWithTraceContext({ correlationId, eventType, service: this.serviceName }, async () => {
      try {
        await handler(envelope, msg);

        rabbitmqConsumedTotal.inc({
          service: this.serviceName,
          queue: queueName,
          event_type: eventType,
          status: 'success',
        });

        channel.ack(msg);
      } catch (err) {
        rabbitmqConsumedTotal.inc({
          service: this.serviceName,
          queue: queueName,
          event_type: eventType,
          status: 'error',
        });

        rabbitmqConsumerErrorsTotal.inc({
          service: this.serviceName,
          queue: queueName,
          error_type: err.name || 'Error',
        });

        logger.error(
          {
            err,
            service: this.serviceName,
            queue: queueName,
            eventId: envelope.eventId,
            eventType,
            correlationId,
          },
          'Error processing RabbitMQ message',
        );

        await this.#handleFailure(channel, queueName, msg, envelope, err);
      }
    });
  }

  async #handleFailure(channel, queueName, msg, envelope, err) {
    const currentRetries = Number(msg.properties.headers?.['x-retry-count'] || 0);

    if (currentRetries < RETRY_CONFIG.MAX_RETRIES) {
      const nextLevel = currentRetries + 1;
      const retryRoutingKey = `${queueName}.retry.${nextLevel}`;

      rabbitmqRetryCountTotal.inc({
        service: this.serviceName,
        queue: queueName,
        retry_level: String(nextLevel),
      });

      logger.warn(
        {
          service: this.serviceName,
          queue: queueName,
          eventId: envelope.eventId,
          nextLevel,
          maxRetries: RETRY_CONFIG.MAX_RETRIES,
        },
        'Routing message to retry queue',
      );

      channel.publish(
        EXCHANGES.RETRY,
        retryRoutingKey,
        msg.content,
        {
          persistent: true,
          headers: {
            ...msg.properties.headers,
            'x-retry-count': nextLevel,
            'x-last-error': err.message,
            'x-last-error-time': new Date().toISOString(),
          },
        },
      );

      // Safely ACK the original message since it has been routed to the retry queue
      channel.ack(msg);
    } else {
      logger.error(
        {
          service: this.serviceName,
          queue: queueName,
          eventId: envelope.eventId,
          maxRetries: RETRY_CONFIG.MAX_RETRIES,
        },
        'Exceeded maximum retries. Routing message to DLQ',
      );

      await this.#routeToDlq(channel, queueName, msg, envelope, 'MAX_RETRIES_EXCEEDED', err.message);
      channel.ack(msg);
    }
  }

  async #routeToDlq(channel, queueName, msg, envelope, reason, errorMessage) {
    rabbitmqDlqMessagesTotal.inc({
      service: this.serviceName,
      queue: queueName,
      reason,
    });

    const dlqPayload = {
      originalQueue: queueName,
      failedAt: new Date().toISOString(),
      service: this.serviceName,
      reason,
      errorMessage,
      headers: msg.properties.headers || {},
      payload: envelope || msg.content.toString(),
    };

    channel.publish(
      EXCHANGES.DLX,
      queueName,
      Buffer.from(JSON.stringify(dlqPayload)),
      {
        persistent: true,
        headers: {
          'x-dlq-service': this.serviceName,
          'x-dlq-queue': queueName,
          'x-dlq-reason': reason,
        },
      },
    );
  }
}
