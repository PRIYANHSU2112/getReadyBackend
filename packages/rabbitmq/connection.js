import amqplib from 'amqplib';
import { logger } from '@getready/logger';
import { EXCHANGES, QUEUES } from './constants.js';

export class RabbitMQConnection {
  /**
   * @param {string} url - AMQP URL
   * @param {string} [serviceName='service']
   */
  constructor(url, serviceName = 'service') {
    this.url = url;
    this.serviceName = serviceName;
    this.connection = null;
    this.channel = null;
    this.isConnecting = false;
    this.isClosing = false;
    this.reconnectAttempts = 0;
  }

  async connect() {
    if (this.connection && this.channel) {
      return { connection: this.connection, channel: this.channel };
    }

    if (this.isConnecting) {
      // Wait if already connecting
      await new Promise((resolve) => setTimeout(resolve, 500));
      return this.connect();
    }

    this.isConnecting = true;
    try {
      logger.info({ service: this.serviceName, url: this.url.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') }, 'Connecting to RabbitMQ...');
      this.connection = await amqplib.connect(this.url);
      this.reconnectAttempts = 0;

      this.connection.on('error', (err) => {
        logger.error({ err, service: this.serviceName }, 'RabbitMQ connection error');
      });

      this.connection.on('close', () => {
        if (!this.isClosing) {
          logger.warn({ service: this.serviceName }, 'RabbitMQ connection closed unexpectedly. Scheduling reconnect...');
          this.connection = null;
          this.channel = null;
          this.#scheduleReconnect();
        }
      });

      this.channel = await this.connection.createChannel();
      this.channel.on('error', (err) => {
        logger.error({ err, service: this.serviceName }, 'RabbitMQ channel error');
      });

      // Assert Base Topology
      await this.#setupBaseTopology(this.channel);

      logger.info({ service: this.serviceName }, 'RabbitMQ connected and base topology asserted');
      this.isConnecting = false;
      return { connection: this.connection, channel: this.channel };
    } catch (err) {
      this.isConnecting = false;
      logger.error({ err, service: this.serviceName }, 'Failed to connect to RabbitMQ');
      this.#scheduleReconnect();
      throw err;
    }
  }

  #scheduleReconnect() {
    this.reconnectAttempts += 1;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    logger.info({ service: this.serviceName, attempt: this.reconnectAttempts, delayMs: delay }, 'Scheduling RabbitMQ reconnect');
    setTimeout(() => {
      if (!this.isClosing) {
        this.connect().catch(() => {});
      }
    }, delay);
  }

  async #setupBaseTopology(channel) {
    // 1. Domain Events Topic Exchange
    await channel.assertExchange(EXCHANGES.DOMAIN_EVENTS, 'topic', { durable: true });

    // 2. Dead Letter Exchange (Fanout or Topic)
    await channel.assertExchange(EXCHANGES.DLX, 'topic', { durable: true });

    // 3. Retry Exchange (Topic)
    await channel.assertExchange(EXCHANGES.RETRY, 'topic', { durable: true });

    // 4. Central Dead Letter Queue
    await channel.assertQueue(QUEUES.DLQ, {
      durable: true,
      arguments: {
        'x-max-length': 100000,
      },
    });
    await channel.bindQueue(QUEUES.DLQ, EXCHANGES.DLX, '#');
  }

  getChannel() {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized. Call connect() first.');
    }
    return this.channel;
  }

  isReady() {
    return Boolean(this.connection && this.channel);
  }

  async close() {
    this.isClosing = true;
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      logger.info({ service: this.serviceName }, 'RabbitMQ connection cleanly closed');
    } catch (err) {
      logger.warn({ err, service: this.serviceName }, 'Error during RabbitMQ connection close');
    } finally {
      this.channel = null;
      this.connection = null;
    }
  }
}
