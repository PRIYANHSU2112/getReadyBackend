import { Router } from 'express';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { walletValidator } from './wallet.validation.js';

/**
 * Wallet routes
 * @param {import('./wallet.controller.js').WalletController} walletController
 * @param {{ authenticate: Function }} guards
 */
export function createWalletRoutes(walletController, guards = {}) {
  const router = Router();

  // Public loyalty rules read (used by client cart / promo tooltips)
  router.get('/loyalty-rules', asyncHandler(walletController.getLoyaltyRules));

  // Admin loyalty rules update
  router.put(
    '/loyalty-rules',
    guards.authenticate,
    guards.checkPermission || ((req, res, next) => next()),
    validate(walletValidator, 'updateLoyaltyRules'),
    asyncHandler(walletController.updateLoyaltyRules),
  );


  // Public webhook route
  router.post(
    '/webhook/razorpay',
    asyncHandler(walletController.handleRazorpayWebhook),
  );

  // Authenticated routes
  router.use(guards.authenticate);


  router.get('/me', asyncHandler(walletController.getWallet));

  router.post(
    '/topup/create-order',
    validate(walletValidator, 'createTopupOrder'),
    asyncHandler(walletController.createTopupOrder),
  );

  router.post(
    '/topup/verify',
    validate(walletValidator, 'verifyTopupPayment'),
    asyncHandler(walletController.verifyTopupPayment),
  );

  router.get(
    '/transactions',
    validate(walletValidator, 'listTransactionsQuery', 'query'),
    asyncHandler(walletController.listTransactions),
  );

  router.post(
    '/points/add',
    validate(walletValidator, 'addPoints'),
    asyncHandler(walletController.addPoints),
  );

  router.post(
    '/points/deduct',
    validate(walletValidator, 'deductPoints'),
    asyncHandler(walletController.deductPoints),
  );

  return router;
}
