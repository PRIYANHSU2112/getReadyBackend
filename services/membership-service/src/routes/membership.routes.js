import { Router } from 'express';
import { validate } from '@getready/validation';
import { membershipValidator } from '../validators/membership.validation.js';

export function createMembershipRoutes(ctrl) {
  const router = Router();

  // Public / Customer App Endpoints
  router.get('/plans', ctrl.listPublicPlans);
  router.get('/my-status', ctrl.getMyStatus);
  router.post('/subscribe', validate(membershipValidator, 'subscribe'), ctrl.subscribe);
  router.post('/calculate-benefits', validate(membershipValidator, 'calculateBenefits'), ctrl.calculateBenefits);
  router.post('/cancel', validate(membershipValidator, 'cancelSubscription'), ctrl.cancel);
  router.post('/family-members', validate(membershipValidator, 'addFamilyMember'), ctrl.addFamilyMember);
  router.post('/claim-entitlement', validate(membershipValidator, 'claimEntitlement'), ctrl.claimEntitlement);

  // Webhook Activation from Payment Service
  router.post('/webhook-activate', ctrl.webhookActivate);

  return router;
}

export function createAdminMembershipRoutes(ctrl) {
  const router = Router();

  // 100% Dynamic Admin Endpoints
  router.get('/plans', ctrl.listPlansAdmin);
  router.post('/plans', validate(membershipValidator, 'adminCreatePlan'), ctrl.createPlanAdmin);
  router.get('/plans/:id', ctrl.getPlanByIdAdmin);
  router.patch('/plans/:id', validate(membershipValidator, 'adminUpdatePlan'), ctrl.updatePlanAdmin);
  router.patch('/plans/:id/status', validate(membershipValidator, 'adminStatusUpdate'), ctrl.setPlanStatusAdmin);

  router.get('/subscriptions', ctrl.searchMembersAdmin);
  router.get('/analytics', ctrl.getAnalyticsAdmin);

  return router;
}

export default { createMembershipRoutes, createAdminMembershipRoutes };
