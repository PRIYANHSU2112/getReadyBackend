import { Router } from 'express';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { skillValidator } from './skill.validation.js';

/**
 * Skill routes — public active list + admin CRUD.
 *
 * @param {import('./skill.controller.js').SkillController} skillController
 * @param {{ authenticate?: Function, checkPermission?: Function }} [guards]
 */
export function createSkillRoutes(skillController, guards = {}) {
  const router = Router();
  const authenticate = guards.authenticate || ((_req, _res, next) => next());
  const checkPermission =
    guards.checkPermission || ((_req, _res, next) => next());

  // Public — beauticians select from these
  router.get(
    '/active',
    validate(skillValidator, 'listSkillsQuery', 'query'),
    asyncHandler(skillController.listActive),
  );

  // Admin routes below
  router.use(authenticate, checkPermission);

  router.get(
    '/',
    validate(skillValidator, 'listSkillsQuery', 'query'),
    asyncHandler(skillController.list),
  );

  router.post(
    '/',
    validate(skillValidator, 'createSkill'),
    asyncHandler(skillController.create),
  );

  router.get(
    '/:id',
    validate(skillValidator, 'skillIdParams', 'params'),
    asyncHandler(skillController.getById),
  );

  router.patch(
    '/:id',
    validate(skillValidator, 'skillIdParams', 'params'),
    validate(skillValidator, 'updateSkill'),
    asyncHandler(skillController.update),
  );

  router.delete(
    '/:id',
    validate(skillValidator, 'skillIdParams', 'params'),
    asyncHandler(skillController.remove),
  );

  return router;
}
