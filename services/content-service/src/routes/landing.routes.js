import { Router } from 'express';

export function createLandingRoutes(controller) {
  const router = Router();
  router.get('/', controller.getLanding);
  router.get('/home', controller.getLanding);
  router.get('/landing', controller.getLanding);
  router.put('/', controller.updateLanding);
  router.put('/landing', controller.updateLanding);
  router.patch('/', controller.updateLanding);
  return router;
}

export function createFaqRoutes(controller) {
  const router = Router();
  router.get('/', controller.listFaqs);
  router.post('/', controller.createFaq);
  router.patch('/:id', controller.updateFaq);
  router.put('/:id', controller.updateFaq);
  router.delete('/:id', controller.deleteFaq);
  return router;
}
