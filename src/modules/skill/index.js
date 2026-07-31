import { SkillModel } from './skill.model.js';
import { SkillRepository } from './skill.repository.js';
import { SkillService } from './skill.service.js';
import { SkillController } from './skill.controller.js';
import { createSkillRoutes } from './skill.routes.js';
import { skillDocs } from './skill.docs.js';

/**
 * Skill module factory — admin CRUD + public active list for beautician selection.
 * @param {{
 *   authenticate: Function,
 *   checkPermission: Function,
 *   cacheService?: object|null,
 * }} deps
 */
export function createSkillModule({
  authenticate,
  checkPermission,
  cacheService = null,
}) {
  const repository = new SkillRepository(SkillModel);
  const service = new SkillService(repository, cacheService);
  const controller = new SkillController(service);

  return {
    repository,
    service,
    routes: createSkillRoutes(controller, { authenticate, checkPermission }),
    docs: skillDocs,
  };
}

export { skillDocs } from './skill.docs.js';
export { SkillModel } from './skill.model.js';
export { SkillRepository } from './skill.repository.js';
export { skillValidator } from './skill.validation.js';
