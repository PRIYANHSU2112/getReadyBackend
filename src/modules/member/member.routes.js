import { Router } from 'express';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { memberValidator } from './member.validation.js';

/**
 * Auth-only member routes — no RBAC permission checks.
 *
 * @param {import('./member.controller.js').MemberController} memberController
 * @param {{ authenticate: Function }} guards
 */
export function createMemberRoutes(memberController, guards) {
  const router = Router();

  router.use(guards.authenticate);

  router.get(
    '/',
    validate(memberValidator, 'listMembersQuery', 'query'),
    asyncHandler(memberController.list),
  );

  router.post(
    '/',
    validate(memberValidator, 'createMember'),
    asyncHandler(memberController.create),
  );

  router.get(
    '/:id',
    validate(memberValidator, 'memberIdParams', 'params'),
    asyncHandler(memberController.getById),
  );

  router.patch(
    '/:id',
    validate(memberValidator, 'memberIdParams', 'params'),
    validate(memberValidator, 'updateMember'),
    asyncHandler(memberController.update),
  );

  router.delete(
    '/:id',
    validate(memberValidator, 'memberIdParams', 'params'),
    asyncHandler(memberController.remove),
  );

  return router;
}
