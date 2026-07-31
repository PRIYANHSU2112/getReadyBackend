import { BaseController } from '../../common/base/BaseController.js';

export class SkillController extends BaseController {
  /**
   * @param {import('./skill.service.js').SkillService} skillService
   */
  constructor(skillService) {
    super();
    this.skillService = skillService;
    this.bindMethods([
      'create',
      'update',
      'remove',
      'list',
      'getById',
      'listActive',
    ]);
  }

  /** Admin — create skill */
  async create(req, res) {
    const skill = await this.skillService.create(req.body, req.user?.id);
    return this.created(res, skill);
  }

  /** Admin — update skill */
  async update(req, res) {
    const skill = await this.skillService.update(req.params.id, req.body, req.user?.id);
    return this.ok(res, skill);
  }

  /** Admin — delete skill */
  async remove(req, res) {
    await this.skillService.remove(req.params.id);
    return this.noContent(res);
  }

  /** Admin — list all skills (paginated) */
  async list(req, res) {
    const { items, meta } = await this.skillService.list(req.query);
    return this.ok(res, items, meta);
  }

  /** Admin — get by ID */
  async getById(req, res) {
    const skill = await this.skillService.getById(req.params.id);
    return this.ok(res, skill);
  }

  /** Public/Beautician — list active skills for selection */
  async listActive(req, res) {
    const data = await this.skillService.listActive(req.query);
    return this.ok(res, data);
  }
}
