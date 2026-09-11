import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createHttpLogger, logger } from '@getready/logger';
import { correlationMiddleware } from '@getready/tracing';
import { createMetricsMiddleware, register } from '@getready/metrics';
import { AppError, HttpStatus } from '@getready/errors';
import { PaymentRepository } from './repositories/payment.repository.js';
import { PaymentService } from './services/payment.service.js';
import { PaymentController } from './controllers/payment.controller.js';
import { createPaymentRoutes } from './routes/payment.routes.js';

export function createApp(publisher = null) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use(correlationMiddleware);
  app.use(createHttpLogger());
  app.use(createMetricsMiddleware('payment-service'));

  // User identity header propagation middleware
  app.use((req, res, next) => {
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'] || 'USER';
    if (userId) {
      req.user = { id: userId, _id: userId, role: userRole };
    }
    next();
  });

  // Health / Readiness / Metrics
  app.get('/health', (req, res) => {
    res.status(HttpStatus.OK).json({ status: 'UP', timestamp: new Date().toISOString(), service: 'payment-service' });
  });

  app.get('/ready', (req, res) => {
    const isDbConnected = req.app.locals.dbConnected;
    if (isDbConnected) {
      res.status(HttpStatus.OK).json({ status: 'READY', dependencies: { database: 'UP' } });
    } else {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ status: 'NOT_READY', dependencies: { database: 'DOWN' } });
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

  // Wiring dependencies
  const paymentRepository = new PaymentRepository();
  const paymentService = new PaymentService(paymentRepository, publisher);
  const paymentController = new PaymentController(paymentService);

  // Mount routes
  const paymentRoutes = createPaymentRoutes(paymentController);
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/finance', paymentRoutes);

  // Error Handler
  app.use((err, req, res, next) => {
    logger.error({ err, path: req.path }, 'Error handling request');
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
          requestId: req.headers['x-request-id'] || req.id,
        },
      });
    }

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        requestId: req.headers['x-request-id'] || req.id,
      },
    });
  });

  return { app, paymentService };
}
