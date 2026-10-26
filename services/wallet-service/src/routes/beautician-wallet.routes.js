import { Router } from 'express';

export function createBeauticianWalletRoutes(beauticianWalletController) {
  const router = Router();

  // Beautician App endpoints
  router.get('/dashboard', beauticianWalletController.getDashboard);
  router.get('/transactions', beauticianWalletController.getTransactions);
  router.get('/transactions/:id', beauticianWalletController.getTransactionDetails);
  router.post('/payout-request', beauticianWalletController.requestPayout);
  router.get('/payout-config', beauticianWalletController.getPayoutConfig);

  // Admin Payouts & Commission Config endpoints
  router.get('/admin/payouts/stats', beauticianWalletController.getAdminPayoutStats);
  router.get('/admin/payouts/config', beauticianWalletController.getPayoutConfig);
  router.put('/admin/payouts/config', beauticianWalletController.updatePayoutConfig);
  router.get('/admin/payouts', beauticianWalletController.listAdminPayouts);
  router.patch('/admin/payouts/:id/process', beauticianWalletController.processAdminPayout);

  return router;
}
