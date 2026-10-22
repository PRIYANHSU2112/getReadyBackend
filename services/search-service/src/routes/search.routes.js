import { Router } from 'express';

export function createSearchRoutes(searchController) {
  const router = Router();

  router.get('/', searchController.search);
  router.get('/autocomplete', searchController.autocomplete);
  router.post('/admin/reindex', searchController.reindex);
  router.get('/health', searchController.health);

  return router;
}

export default createSearchRoutes;
