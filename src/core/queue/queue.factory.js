import { Queue } from 'bullmq';
import { logger } from '../logger/pino.logger.js';

const queues = new Map();

/**
 * Factory for named BullMQ queues.
 * @param {string} name
 * @param {object} connection
 * @param {object} [defaultJobOptions]
 */
export function createQueue(name, connection, defaultJobOptions = {}) {
  if (queues.has(name)) return queues.get(name);

  const queue = new Queue(name, {
    connection,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      ...defaultJobOptions,
    },
  });

  queues.set(name, queue);
  logger.info({ queue: name }, 'BullMQ queue created');
  return queue;
}

export function getQueue(name) {
  return queues.get(name) || null;
}

export async function closeAllQueues() {
  await Promise.all([...queues.values()].map((q) => q.close()));
  queues.clear();
}
