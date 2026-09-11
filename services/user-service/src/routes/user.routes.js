import { Router } from 'express';
import multer from 'multer';
import { validate } from '@getready/validation';
import { userValidator } from '../validators/user.validation.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export function createUserRoutes(controller) {
  const router = Router();

  // Internal APIs for Auth Service & inter-service calls
  router.post('/internal/auth-lookup-email', controller.internalAuthLookupEmail);
  router.post('/internal/find-or-create-mobile', controller.internalFindOrCreateMobile);
  router.patch('/internal/:id/last-login', controller.internalUpdateLastLogin);
  router.patch('/internal/set-password-by-email', controller.internalSetPasswordByEmail);

  // Self routes
  router.get('/me', controller.getMe);
  router.patch('/me', upload.single('profileImage'), validate(userValidator, 'updateUser'), controller.updateMe);

  // Admin / General User routes
  router.get('/', controller.list);
  router.post('/', validate(userValidator, 'createUser'), controller.create);
  router.get('/:id', controller.getById);
  router.patch('/:id', upload.single('profileImage'), validate(userValidator, 'updateUser'), controller.update);
  router.delete('/:id', controller.remove);

  return router;
}
