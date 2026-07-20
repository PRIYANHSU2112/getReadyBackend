import { Worker } from 'bullmq';
import { logger } from '../../logger/pino.logger.js';

const workers = [];

/**
 * Register workers (stub — extend per domain job).
 * @param {object} connection
 */
export function startWorkers(connection) {
  const defaultWorker = new Worker(
    'default',
    async (job) => {
      logger.info({ jobId: job.id, name: job.name, data: job.data }, 'Processing job');
      // Domain workers should be registered here or in module-specific files
      return { ok: true };
    },
    { connection },
  );

  defaultWorker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'Job failed');
  });

  workers.push(defaultWorker);
  logger.info('BullMQ workers started');
  return workers;
}

export async function stopWorkers() {
  await Promise.all(workers.map((w) => w.close()));
  workers.length = 0;
}
