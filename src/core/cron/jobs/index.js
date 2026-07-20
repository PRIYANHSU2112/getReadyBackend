import { schedule } from '../cron.scheduler.js';
import { logger } from '../../logger/pino.logger.js';

/**
 * Register application cron jobs (stubs — replace with real domain jobs).
 */
export function registerCronJobs() {
  // Example: every day at midnight
  schedule(
    '0 0 * * *',
    async () => {
      logger.info('Running daily maintenance cron (stub)');
    },
    'daily-maintenance',
  );
}
