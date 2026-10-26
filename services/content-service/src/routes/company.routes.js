import { Router } from 'express';

export function createCompanyRoutes(controller) {
  const router = Router();
  router.get('/', controller.getProfile);
  router.put('/', controller.updateProfile);
  router.patch('/', controller.updateProfile);
  router.get('/policies/:type', controller.getPolicy);
  return router;
}
