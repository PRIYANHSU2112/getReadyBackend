import { logger } from '@getready/logger';
import { rabbitmqPublishedTotal } from '@getready/metrics';
import { EXCHANGES } from './constants.js';
import { createEventEnvelope } from './envelope.js';

export class EventPublisher {
  /**
   * @param {import('./connection.js').RabbitMQConnection} rabbitConnection
   * @param {string} producerName - e.g. "booking-service"
   */
  constructor(rabbitConnection, producerName) {
    this.rabbitConnection = rabbitConnection;
    this.producerName = producerName;
  }

  /**
   * Publish a domain event to the domain events topic exchange.
   *
   * @param {string} routingKey - e.g. "booking.created" or "user.updated"
   * @param {string} eventType - e.g. "BookingCreated"
   * @param {object} data - Payload data
   * @param {object} [options] - aggregateId, correlationId, causationId, eventVersion
   */
  async publish(routingKey, eventType, data, options = {}) {
    const envelope = createEventEnvelope({
      eventType,
      data,
      producer: this.producerName,
      aggregateId: options.aggregateId,
      correlationId: options.correlationId,
      causationId: options.causationId,
      eventVersion: options.eventVersion || 1,
    });

    const channel = this.rabbitConnection.getChannel();
    const content = Buffer.from(JSON.stringify(envelope));

    const publishOptions = {
      persistent: true,
      contentType: 'application/json',
      contentEncoding: 'utf-8',
      messageId: envelope.eventId,
      timestamp: Date.now(),
      type: eventType,
      appId: this.producerName,
      headers: {
        'x-correlation-id': envelope.correlationId,
        'x-causation-id': envelope.causationId,
        'x-event-type': eventType,
        'x-producer': this.producerName,
      },
    };

    try {
      const exchange = options.exchange || EXCHANGES.DOMAIN_EVENTS;
      const success = channel.publish(exchange, routingKey, content, publishOptions);

      rabbitmqPublishedTotal.inc({
        service: this.producerName,
        exchange,
        routing_key: routingKey,
        status: success ? 'success' : 'buffered',
      });

      logger.debug(
        {
          eventId: envelope.eventId,
          eventType,
          routingKey,
          correlationId: envelope.correlationId,
          producer: this.producerName,
        },
        'Domain event published to RabbitMQ',
      );

      return envelope;
    } catch (err) {
      rabbitmqPublishedTotal.inc({
        service: this.producerName,
        exchange: options.exchange || EXCHANGES.DOMAIN_EVENTS,
        routing_key: routingKey,
        status: 'error',
      });
      logger.error(
        {
          err,
          eventType,
          routingKey,
          correlationId: envelope.correlationId,
        },
        'Failed to publish domain event to RabbitMQ',
      );
      throw err;
    }
  }
}
