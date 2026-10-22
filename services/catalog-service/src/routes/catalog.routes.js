import { Router } from 'express';
import multer from 'multer';
import { validate } from '@getready/validation';
import { catalogValidator } from '../validators/catalog.validation.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const serviceUpload = upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'images', maxCount: 5 },
]);

export function createCategoryRoutes(ctrl) {
  const router = Router();
  router.get('/public', ctrl.listPublic);
  router.get('/public/:slug', ctrl.getPublicBySlug);
  router.patch('/reorder', ctrl.reorder);
  router.patch('/bulk/status', ctrl.bulkSetStatus);
  router.post('/bulk/delete', ctrl.bulkDelete);
  router.get('/admin/stats', ctrl.getAdminStats);
  router.get('/', ctrl.list);
  router.post('/', upload.single('file'), validate(catalogValidator, 'createCategory'), ctrl.create);
  router.get('/:id', ctrl.getById);
  router.patch('/:id', upload.single('file'), validate(catalogValidator, 'updateCategory'), ctrl.update);
  router.delete('/:id', ctrl.remove);
  router.post('/:id/restore', ctrl.restore);
  router.patch('/:id/status', ctrl.setStatus);
  return router;
}

export function createServiceRoutes(ctrl) {
  const router = Router();
  router.get('/public', ctrl.listPublic);
  router.get('/public/category/:categoryId', ctrl.listPublicByCategory);
  router.get('/public/:slug', ctrl.getPublicBySlug);
  router.patch('/reorder', ctrl.list);
  router.get('/admin/stats', ctrl.getAdminStats);
  router.get('/', ctrl.list);
  router.post('/', serviceUpload, validate(catalogValidator, 'createService'), ctrl.create);
  router.get('/:id', ctrl.getById);
  router.patch('/:id', serviceUpload, validate(catalogValidator, 'updateService'), ctrl.update);
  router.delete('/:id', ctrl.remove);
  router.post('/:id/restore', ctrl.restore);
  router.patch('/:id/status', ctrl.setStatus);
  router.post('/:id/approve', ctrl.approveCreate);
  router.post('/:id/reject', ctrl.rejectCreate);
  return router;
}

export function createServiceChangeRequestRoutes(ctrl) {
  const router = Router();
  router.get('/', ctrl.listChangeRequests);
  router.get('/:id', ctrl.getChangeRequestById);
  router.post('/:id/approve', ctrl.approveChangeRequest);
  router.post('/:id/reject', ctrl.rejectChangeRequest);
  return router;
}

export function createPackageRoutes(ctrl) {
  const router = Router();
  router.get('/public', ctrl.listPublic);
  router.get('/public/slug/:slug', ctrl.getPublicBySlug);
  router.get('/public/:id', ctrl.getPublicById);
  router.get('/admin/stats', ctrl.getAdminStats);
  router.get('/', ctrl.listAdmin);
  router.post('/', serviceUpload, validate(catalogValidator, 'createPackage'), ctrl.create);
  router.patch('/:id', serviceUpload, ctrl.update);
  router.post('/:id/approve', ctrl.approve);
  router.post('/:id/reject', ctrl.reject);
  router.delete('/:id', ctrl.delete);
  return router;
}

export function createFilterRoutes(ctrl) {
  const router = Router();
  router.get('/admin/stats', ctrl.getAdminStats);
  router.get('/public', ctrl.listPublic);
  router.get('/', ctrl.list);
  router.post('/', validate(catalogValidator, 'createFilter'), ctrl.create);
  router.get('/:id', ctrl.getById);
  router.patch('/:id', ctrl.update);
  router.delete('/:id', ctrl.remove);
  router.post('/:id/restore', ctrl.restore);
  router.get('/:filterId/values', ctrl.listValues);
  router.post('/:filterId/values', validate(catalogValidator, 'createFilterValue'), ctrl.createValue);
  router.patch('/:filterId/values/:valueId', ctrl.updateValue);
  router.delete('/:filterId/values/:valueId', ctrl.removeValue);
  return router;
}

export function createHygieneKitRoutes(ctrl) {
  const router = Router();
  router.get('/admin/stats', ctrl.getAdminStats);
  router.get('/default', ctrl.getDefault);
  router.get('/active', ctrl.getActive);
  router.get('/:id', ctrl.getById);
  router.get('/', ctrl.list);
  router.post('/', upload.single('file'), validate(catalogValidator, 'createHygieneKit'), ctrl.create);
  router.patch('/:id', upload.single('file'), ctrl.update);
  router.patch('/:id/default', ctrl.setDefault);
  router.delete('/:id', ctrl.remove);
  router.post('/:id/restore', ctrl.restore);
  return router;
}

export function createCouponRoutes(ctrl) {
  const router = Router();
  router.get('/admin/stats', ctrl.getAdminStats);
  router.post('/validate', validate(catalogValidator, 'validateCoupon'), ctrl.validate);
  router.post('/redeem', validate(catalogValidator, 'redeemCoupon'), ctrl.redeem);
  router.post('/release', validate(catalogValidator, 'releaseCoupon'), ctrl.release);
  router.get('/', ctrl.list);
  router.get('/:id', ctrl.getById);
  router.post('/', validate(catalogValidator, 'createCoupon'), ctrl.create);
  router.put('/:id', ctrl.update);
  router.patch('/:id', ctrl.update);
  router.delete('/:id', ctrl.remove);
  return router;
}
