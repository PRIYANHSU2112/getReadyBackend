import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import path from 'path';
import { validate } from '@getready/validation';
import { bannerValidator } from '../validators/banner.validation.js';

const upload = multer({ dest: path.join(os.tmpdir(), 'getready-uploads') });

export function createBannerRoutes(bannerController) {
  const router = Router();

  router.get('/active', validate(bannerValidator.activeBannersQuery, 'query'), bannerController.listActive);
  router.get('/', validate(bannerValidator.listBannersQuery, 'query'), bannerController.list);
  router.post('/', upload.single('file'), validate(bannerValidator.createBanner), bannerController.create);
  router.get('/:id', validate(bannerValidator.bannerIdParams, 'params'), bannerController.getById);
  router.patch('/:id', validate(bannerValidator.bannerIdParams, 'params'), upload.single('file'), validate(bannerValidator.updateBanner), bannerController.update);
  router.delete('/:id', validate(bannerValidator.bannerIdParams, 'params'), bannerController.remove);

  return router;
}
