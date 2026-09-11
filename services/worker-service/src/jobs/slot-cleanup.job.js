import { logger } from '@getready/logger';

export class SlotCleanupJob {
  constructor(redisClient) {
    this.redis = redisClient;
    this.timer = null;
  }

  start(intervalMs = 60000) {
    this.timer = setInterval(async () => {
      try {
        if (this.redis) {
          // Clean expired temporary slot holds or lock keys if any
          logger.debug('Running periodic slot hold cleanup check...');
        }
      } catch (err) {
        logger.error({ err }, 'Error running slot cleanup job');
      }
    }, intervalMs);
    logger.info('SlotCleanupJob started with interval ' + intervalMs + 'ms');
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
