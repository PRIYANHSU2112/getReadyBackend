import { logger } from '../logger/pino.logger.js';

export class PubSubService {
  /**
   * @param {import('ioredis').Redis} publisher
   * @param {import('ioredis').Redis} subscriber
   */
  constructor(publisher, subscriber) {
    this.publisher = publisher;
    this.subscriber = subscriber;
    this.handlers = new Map();

    this.subscriber.on('message', (channel, message) => {
      const handler = this.handlers.get(channel);
      if (!handler) return;
      try {
        const data = JSON.parse(message);
        handler(data);
      } catch (err) {
        logger.error({ err, channel }, 'PubSub message handler error');
      }
    });
  }

  async publish(channel, payload) {
    await this.publisher.publish(channel, JSON.stringify(payload));
  }

  async subscribe(channel, handler) {
    this.handlers.set(channel, handler);
    await this.subscriber.subscribe(channel);
  }

  async unsubscribe(channel) {
    this.handlers.delete(channel);
    await this.subscriber.unsubscribe(channel);
  }
}
