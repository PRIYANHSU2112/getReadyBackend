import { Router } from 'express';
import { validate } from '@getready/validation';
import { walletValidator } from '../validators/wallet.validation.js';

export function createWalletRoutes(walletController) {
  const router = Router();

  // Public loyalty rules read
  router.get('/loyalty-rules', walletController.getLoyaltyRules);

  // Admin loyalty rules update
  router.put('/loyalty-rules', validate(walletValidator.updateLoyaltyRules), walletController.updateLoyaltyRules);

  // Public webhook route
  router.post('/webhook/razorpay', walletController.handleRazorpayWebhook);

  // Admin and list routes
  router.get('/kpis', walletController.getKpis);
  router.get('/', walletController.listWallets);
  router.post('/', walletController.createWallet);

  // Authenticated routes
  router.get('/me', walletController.getWallet);
  router.post('/topup/create-order', validate(walletValidator.createTopupOrder), walletController.createTopupOrder);
  router.post('/topup/verify', validate(walletValidator.verifyTopupPayment), walletController.verifyTopupPayment);
  router.get('/transactions', validate(walletValidator.listTransactionsQuery, 'query'), walletController.listTransactions);
  router.post('/points/add', validate(walletValidator.addPoints), walletController.addPoints);
  router.post('/points/deduct', validate(walletValidator.deductPoints), walletController.deductPoints);
  router.patch('/:id', walletController.updateWallet);
  router.put('/:id', walletController.updateWallet);
  router.delete('/:id', walletController.deleteWallet);

  return router;
}
