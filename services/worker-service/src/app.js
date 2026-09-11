import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createHttpLogger, logger } from '@getready/logger';
import { correlationMiddleware } from '@getready/tracing';
import { createMetricsMiddleware, register } from '@getready/metrics';
import { HttpStatus } from '@getready/errors';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(correlationMiddleware);
  app.use(createHttpLogger());
  app.use(createMetricsMiddleware('worker-service'));

  // Health / Readiness / Metrics
  app.get('/health', (req, res) => {
    res.status(HttpStatus.OK).json({ status: 'UP', timestamp: new Date().toISOString(), service: 'worker-service' });
  });

  app.get('/ready', (req, res) => {
    const isRmqConnected = req.app.locals.rmqConnected;
    if (isRmqConnected) {
      res.status(HttpStatus.OK).json({ status: 'READY', dependencies: { rabbitmq: 'UP' } });
    } else {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ status: 'NOT_READY', dependencies: { rabbitmq: 'DOWN' } });
    }
  });

  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (err) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).end(err);
    }
  });

  return app;
}
