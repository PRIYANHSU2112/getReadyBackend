import { logger } from '@getready/logger';
import { indexerService } from '../services/indexer.service.js';

export class SearchSyncConsumer {
  constructor(rabbitmqConnection, indexer = indexerService) {
    this.rmq = rabbitmqConnection;
    this.indexer = indexer;
    this.channel = null;
    this.queueName = 'search-service.sync-queue';
  }

  async start() {
    if (!this.rmq) {
      logger.warn('RabbitMQ connection not available for SearchSyncConsumer');
      return;
    }

    try {
      this.channel = await this.rmq.createChannel();
      await this.channel.assertQueue(this.queueName, { durable: true });

      const routingKeys = [
        'beautician.*',
        'catalog.service.*',
        'catalog.category.*',
      ];

      for (const key of routingKeys) {
        await this.channel.bindQueue(this.queueName, 'amq.topic', key);
      }

      await this.channel.consume(this.queueName, async (msg) => {
        if (!msg) return;

        const routingKey = msg.fields.routingKey;
        try {
          const payload = JSON.parse(msg.content.toString());
          logger.debug({ routingKey, payloadId: payload.id || payload._id }, 'Search consumer received event');

          await this.handleEvent(routingKey, payload);
          this.channel.ack(msg);
        } catch (err) {
          logger.error({ err, routingKey }, 'Failed to process search sync event');
          // Nack without requeue to avoid poison message loop, can route to DLQ
          this.channel.nack(msg, false, false);
        }
      });

      logger.info({ queue: this.queueName }, 'SearchSyncConsumer successfully started and listening');
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to start SearchSyncConsumer');
    }
  }

  async handleEvent(routingKey, payload) {
    const doc = payload.data || payload;
    const docId = doc.id || doc._id;

    if (routingKey.startsWith('beautician.')) {
      if (routingKey.endsWith('.deleted')) {
        await this.indexer.deleteBeautician(docId);
      } else {
        await this.indexer.indexBeautician({
          id: docId,
          userId: doc.userId || docId,
          name: doc.name || doc.fullName,
          bio: doc.bio,
          services: doc.skills,
          rating: doc.ratingAvg,
          ratingCount: doc.ratingCount,
          price: 499,
          location: doc.location || { lat: 23.2599, lon: 77.4126 },
          city: doc.city || doc.address?.city,
          address: doc.address?.line1 || '',
          operationalStatus: doc.operationalStatus || 'ONLINE',
          isAvailable: doc.isAvailable !== false,
          isActive: doc.isActive !== false,
          experienceYears: doc.experienceYears,
          avatarUrl: doc.profilePhoto?.url,
        });
      }
    } else if (routingKey.startsWith('catalog.service.')) {
      if (routingKey.endsWith('.deleted')) {
        await this.indexer.deleteService(docId);
      } else {
        await this.indexer.indexService({
          id: docId,
          name: doc.name,
          category: doc.categoryName || 'Salon Service',
          categoryId: doc.categoryId,
          description: doc.description,
          price: doc.price,
          discountedPrice: doc.discountedPrice || doc.price,
          duration: doc.durationMinMinutes || 45,
          rating: doc.ratingAvg || 4.8,
          ratingCount: doc.ratingCount || 0,
          isActive: doc.isActive !== false,
          status: doc.status || 'APPROVED',
          gender: doc.gender || 'all',
          bestseller: (doc.ratingAvg || 0) >= 4.8,
          imageUrl: doc.thumbnail?.url,
          badges: doc.badges || [],
        });
      }
    }
  }

  async stop() {
    if (this.channel) {
      try {
        await this.channel.close();
      } catch (err) {
        logger.warn({ err: err.message }, 'Error closing search consumer channel');
      }
    }
  }
}
