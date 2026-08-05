import { MemberModel } from './member.model.js';
import { MemberRepository } from './member.repository.js';
import { MemberService } from './member.service.js';
import { MemberController } from './member.controller.js';
import { createMemberRoutes } from './member.routes.js';
import { memberDocs } from './member.docs.js';

/**
 * Member module factory — auth-only (no RBAC).
 * @param {{
 *   authenticate: Function,
 *   cacheService?: object|null,
 * }} deps
 */
export function createMemberModule({ authenticate, cacheService = null }) {
  const repository = new MemberRepository(MemberModel);
  const service = new MemberService(repository, cacheService);
  const controller = new MemberController(service);

  return {
    repository,
    service,
    routes: createMemberRoutes(controller, { authenticate }),
    docs: memberDocs,
  };
}

export { memberDocs } from './member.docs.js';
export { memberValidator } from './member.validation.js';
export { MemberModel } from './member.model.js';
