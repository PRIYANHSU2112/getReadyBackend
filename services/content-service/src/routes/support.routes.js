import { Router } from 'express';

export function createSupportRoutes(controller) {
  const router = Router();
  router.get('/', controller.list);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.patch('/:id', controller.update);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.delete);
  return router;
}
