import { Router } from 'express';

export function createReportsRoutes(ctrl) {
  const router = Router();

  router.get('/', ctrl.listReports);
  router.get('/data', ctrl.getReportData);
  router.post('/generate', ctrl.generateReport);
  router.get('/:id', ctrl.getReportById);
  router.get('/:id/download', ctrl.downloadReport);
  router.delete('/:id', ctrl.deleteReport);

  return router;
}

export default createReportsRoutes;
