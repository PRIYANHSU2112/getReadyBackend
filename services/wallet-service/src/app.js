import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createHttpLogger, logger } from '@getready/logger';
import { correlationMiddleware } from '@getready/tracing';
import { createMetricsMiddleware, register } from '@getready/metrics';
import { AppError, HttpStatus } from '@getready/errors';
import {
  WalletRepository,
  WalletTransactionRepository,
  LoyaltyRuleRepository,
  PayoutRequestRepository,
  PayoutConfigRepository,
} from './repositories/wallet.repository.js';
import { WalletService } from './services/wallet.service.js';
import { BeauticianWalletService } from './services/beautician-wallet.service.js';
import { WalletController } from './controllers/wallet.controller.js';
import { BeauticianWalletController } from './controllers/beautician-wallet.controller.js';
import { createWalletRoutes } from './routes/wallet.routes.js';
import { createBeauticianWalletRoutes } from './routes/beautician-wallet.routes.js';

export function createApp(publisher = null) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use(correlationMiddleware);
  app.use(createHttpLogger());
  app.use(createMetricsMiddleware('wallet-service'));

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
    res.status(HttpStatus.OK).json({ status: 'UP', timestamp: new Date().toISOString(), service: 'wallet-service' });
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
  const walletRepository = new WalletRepository();
  const transactionRepository = new WalletTransactionRepository();
  const loyaltyRuleRepository = new LoyaltyRuleRepository();
  const payoutRepository = new PayoutRequestRepository();
  const payoutConfigRepository = new PayoutConfigRepository();

  const walletService = new WalletService(walletRepository, transactionRepository, loyaltyRuleRepository, publisher);
  const beauticianWalletService = new BeauticianWalletService(
    walletRepository,
    transactionRepository,
    payoutRepository,
    payoutConfigRepository,
    publisher,
  );

  const walletController = new WalletController(walletService);
  const beauticianWalletController = new BeauticianWalletController(beauticianWalletService, payoutRepository);

  // Mount Customer Wallet routes
  const walletRoutes = createWalletRoutes(walletController);
  app.use('/api/v1/wallet', walletRoutes);
  app.use('/api/v1/wallets', walletRoutes);

  // Mount Beautician Wallet routes
  const beauticianWalletRoutes = createBeauticianWalletRoutes(beauticianWalletController);
  app.use('/api/v1/beautician/wallet', beauticianWalletRoutes);
  app.use('/api/v1/wallet/beautician', beauticianWalletRoutes);

  // Mount Admin Payouts & Commission Config
  const adminPayoutRoutes = express.Router();
  adminPayoutRoutes.get('/stats', beauticianWalletController.getAdminPayoutStats);
  adminPayoutRoutes.get('/config', beauticianWalletController.getPayoutConfig);
  adminPayoutRoutes.put('/config', beauticianWalletController.updatePayoutConfig);
  adminPayoutRoutes.get('/', beauticianWalletController.listAdminPayouts);
  adminPayoutRoutes.patch('/:id/process', beauticianWalletController.processAdminPayout);
  app.use('/api/v1/admin/payouts', adminPayoutRoutes);
  app.use('/admin/payouts', adminPayoutRoutes);

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

  return { app, walletService, beauticianWalletService };
}

