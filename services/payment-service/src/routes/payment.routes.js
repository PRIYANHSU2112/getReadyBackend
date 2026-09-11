import { Router } from 'express';
import { validate } from '@getready/validation';
import { paymentValidator } from '../validators/payment.validation.js';

export function createPaymentRoutes(paymentController) {
  const router = Router();

  // Public webhook route
  router.post('/webhook', paymentController.handleWebhook);

  // Admin and list routes
  router.get('/kpis', paymentController.getKpis);
  router.get('/', paymentController.listPayments);
  router.post('/', paymentController.createPayment);

  // Authenticated transactional routes
  router.post('/create-order', validate(paymentValidator.createOrder), paymentController.createOrder);
  router.post('/verify', validate(paymentValidator.verifyPayment), paymentController.verifyPayment);
  router.post('/:id/refund', validate(paymentValidator.refundPayment), paymentController.refundPayment);
  router.get('/:id', paymentController.getPayment);
  router.patch('/:id', paymentController.updatePayment);
  router.put('/:id', paymentController.updatePayment);
  router.delete('/:id', paymentController.deletePayment);

  return router;
}
