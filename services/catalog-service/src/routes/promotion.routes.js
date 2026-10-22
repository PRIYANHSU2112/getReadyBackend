import { Router } from 'express';
import { validate } from '@getready/validation';
import { promotionValidator } from '../validators/promotion.validation.js';

export function createOfferRoutes(ctrl) {
  const router = Router();

  // Public / User App endpoints
  router.get('/eligible', ctrl.getEligible);
  router.post('/quote', validate(promotionValidator, 'quoteOffer'), ctrl.quote);
  router.post('/reservations', validate(promotionValidator, 'createReservation'), ctrl.createReservation);
  router.post('/reservations/:id/confirm', validate(promotionValidator, 'confirmReservation'), ctrl.confirmReservation);
  router.post('/reservations/:id/release', validate(promotionValidator, 'releaseReservation'), ctrl.releaseReservation);
  router.get('/history', ctrl.getUserHistory);

  return router;
}

export function createAdminPromotionRoutes(ctrl) {
  const router = Router();

  // Admin Dashboard Campaign Management endpoints
  router.get('/admin/stats', ctrl.getAdminStats);
  router.get('/stats', ctrl.getAdminStats);
  router.get('/', ctrl.listAdmin);
  router.post('/', validate(promotionValidator, 'adminCreatePromotion'), ctrl.createAdmin);
  router.get('/:id', ctrl.getByIdAdmin);
  router.patch('/:id', validate(promotionValidator, 'adminUpdatePromotion'), ctrl.updateAdmin);
  router.patch('/:id/status', validate(promotionValidator, 'adminStatusUpdate'), ctrl.setStatusAdmin);
  router.get('/:id/analytics', ctrl.getAnalyticsAdmin);
  router.get('/:id/report', ctrl.getAnalyticsAdmin);

  return router;
}

export default { createOfferRoutes, createAdminPromotionRoutes };
