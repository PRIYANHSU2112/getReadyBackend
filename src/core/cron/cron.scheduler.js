import cron from 'node-cron';
import { logger } from '../logger/pino.logger.js';

const tasks = [];

/**
 * Register a cron expression with a handler.
 * @param {string} expression
 * @param {() => void|Promise<void>} handler
 * @param {string} [name]
 */
export function schedule(expression, handler, name = 'unnamed') {
  if (!cron.validate(expression)) {
    throw new Error(`Invalid cron expression: ${expression}`);
  }

  const task = cron.schedule(expression, async () => {
    try {
      logger.debug({ name }, 'Cron job started');
      await handler();
    } catch (err) {
      logger.error({ err, name }, 'Cron job failed');
    }
  });

  tasks.push({ name, task });
  logger.info({ name, expression }, 'Cron job scheduled');
  return task;
}

export function stopAllCronJobs() {
  tasks.forEach(({ task, name }) => {
    task.stop();
    logger.info({ name }, 'Cron job stopped');
  });
  tasks.length = 0;
}
