import { logger } from '@getready/logger';

export class HomeFeedPrecomputeJob {
  constructor(catalogClient = null, redisClient = null) {
    this.catalogClient = catalogClient;
    this.redis = redisClient;
    this.timer = null;
  }

  start(intervalMs = 300000) {
    // Run initial warmup after 5 seconds
    setTimeout(() => {
      this.warmup().catch((err) =>
        logger.warn({ err: err.message }, 'Home feed warmup failed'),
      );
    }, 5000);

    // Periodic refresh every 5 minutes (before 10 min TTL expires)
    this.timer = setInterval(async () => {
      try {
        await this.warmup();
      } catch (err) {
        logger.error({ err }, 'Error running HomeFeedPrecomputeJob');
      }
    }, intervalMs);

    logger.info(`HomeFeedPrecomputeJob started with interval ${intervalMs}ms`);
  }

  async warmup() {
    const targetCities = ['all', 'bhopal', 'indore', 'noida', 'delhi'];
    logger.debug({ targetCities }, 'Precomputing Home Feed Materialized Views in worker...');

    for (const city of targetCities) {
      try {
        if (this.catalogClient && typeof this.catalogClient.refreshFeed === 'function') {
          await this.catalogClient.refreshFeed(city);
        }
      } catch (err) {
        logger.warn({ city, err: err.message }, 'Failed to precompute feed for city');
      }
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
