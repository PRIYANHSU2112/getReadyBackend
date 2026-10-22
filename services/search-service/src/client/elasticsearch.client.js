import { Client } from '@elastic/elasticsearch';
import { logger } from '@getready/logger';
import { config } from '../config/index.js';

class ElasticsearchClientWrapper {
  constructor() {
    this.client = null;
    this.connected = false;
    this.init();
  }

  init() {
    const opts = {
      node: config.elasticsearch.node,
      maxRetries: config.elasticsearch.maxRetries,
      requestTimeout: config.elasticsearch.requestTimeout,
    };

    if (config.elasticsearch.username && config.elasticsearch.password) {
      opts.auth = {
        username: config.elasticsearch.username,
        password: config.elasticsearch.password,
      };
    }

    try {
      this.client = new Client(opts);
      logger.info({ node: config.elasticsearch.node }, 'Elasticsearch client initialized');
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to initialize Elasticsearch client');
    }
  }

  async checkHealth() {
    if (!this.client) return false;
    try {
      const health = await this.client.cluster.health({ timeout: '3s' });
      this.connected = health && ['green', 'yellow'].includes(health.status);
      return this.connected;
    } catch (err) {
      this.connected = false;
      logger.warn({ err: err.message }, 'Elasticsearch cluster health check failed');
      return false;
    }
  }

  getClient() {
    return this.client;
  }
}

export const esWrapper = new ElasticsearchClientWrapper();
export const esClient = esWrapper.getClient();
export default esWrapper;
