import { AppError, HttpStatus, ErrorCodes } from '@getready/errors';
import { EVENT_TYPES } from '@getready/rabbitmq';

export class MemberService {
  constructor(memberRepository, eventPublisher = null) {
    this.memberRepository = memberRepository;
    this.eventPublisher = eventPublisher;
  }

  async listForUser(userId, query = {}) {
    if (userId) {
      return this.memberRepository.findActiveByUserId(userId);
    }
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '25', 10), 100);
    const skip = (page - 1) * limit;
    const filter = {};
    if (query.status && query.status !== 'all' && query.status !== 'ALL') {
      filter.status = query.status.toUpperCase();
    }
    const { items, total } = await this.memberRepository.findAndCount(filter, { skip, limit });
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async getById(id, userId) {
    const member = await this.memberRepository.findActiveByIdForUser(id, userId);
    if (!member) throw new AppError('Member not found', HttpStatus.NOT_FOUND, ErrorCodes.MEMBER_NOT_FOUND);
    return member;
  }

  async create(userId, data) {
    const created = await this.memberRepository.create({ ...data, userId });
    if (this.eventPublisher) {
      this.eventPublisher.publish('member.created', EVENT_TYPES.MEMBER_CREATED, {
        memberId: created._id.toString(),
        userId,
        name: created.name,
      }).catch(() => {});
    }
    return created;
  }

  async update(id, userId, data) {
    const updated = await this.memberRepository.updateById(id, userId, data);
    if (!updated) throw new AppError('Member not found', HttpStatus.NOT_FOUND, ErrorCodes.MEMBER_NOT_FOUND);
    return updated;
  }

  async remove(id, userId) {
    const deleted = await this.memberRepository.softDelete(id, userId);
    if (!deleted) throw new AppError('Member not found', HttpStatus.NOT_FOUND, ErrorCodes.MEMBER_NOT_FOUND);
    return true;
  }

  async getBeautyPassport(id, userId) {
    const profile = await this.getById(id, userId);
    return {
      profileId: profile.id || profile._id,
      name: profile.name,
      relationship: profile.relationship,
      skinType: profile.skinType,
      hairType: profile.hairType,
      allergies: profile.allergies || [],
      beautyPassport: profile.beautyPassport || { serviceHistory: [], skinConcerns: [], hairConcerns: [] },
    };
  }

  async addBeautyPassportEntry(id, userId, entry) {
    const profile = await this.getById(id, userId);
    if (!profile.beautyPassport) {
      profile.beautyPassport = { serviceHistory: [] };
    }
    profile.beautyPassport.serviceHistory.push(entry);
    await profile.save();
    return profile.beautyPassport;
  }
}
