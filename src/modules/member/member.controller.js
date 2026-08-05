import { BaseController } from '../../common/base/BaseController.js';

export class MemberController extends BaseController {
  /**
   * @param {import('./member.service.js').MemberService} memberService
   */
  constructor(memberService) {
    super();
    this.memberService = memberService;
    this.bindMethods(['list', 'getById', 'create', 'update', 'remove']);
  }

  async list(req, res) {
    const { items, meta } = await this.memberService.listMine(req.user.id, req.query);
    return this.ok(res, items, meta);
  }

  async getById(req, res) {
    const member = await this.memberService.getMineById(req.user.id, req.params.id);
    return this.ok(res, member);
  }

  async create(req, res) {
    const member = await this.memberService.createMine(req.user.id, req.body);
    return this.created(res, member);
  }

  async update(req, res) {
    const member = await this.memberService.updateMine(
      req.user.id,
      req.params.id,
      req.body,
    );
    return this.ok(res, member);
  }

  async remove(req, res) {
    await this.memberService.deleteMine(req.user.id, req.params.id);
    return this.noContent(res);
  }
}
