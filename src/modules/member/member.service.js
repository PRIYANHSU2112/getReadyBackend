import { BaseService } from '../../common/base/BaseService.js';
import { AppError } from '../../common/errors/AppError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import {
  MAX_MEMBERS_PER_USER,
  MEMBER_LIST_CACHE_TTL_SECONDS,
  MEMBER_SORT_FIELDS,
  DEFAULT_MEMBER_SORT,
} from '../../common/constants/member.js';
import { buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { parseListQuery } from '../../common/helpers/list-query.helper.js';

export class MemberService extends BaseService {
  /**
   * @param {import('./member.repository.js').MemberRepository} memberRepository
   * @param {import('../../core/redis/cache.service.js').CacheService|null} cacheService
   */
  constructor(memberRepository, cacheService = null) {
    super(null, cacheService);
    this.memberRepository = memberRepository;
  }

  #sanitize(member) {
    if (!member) return member;
    const obj = typeof member.toJSON === 'function' ? member.toJSON() : { ...member };
    if (obj._id) obj.id = obj._id.toString();
    if (obj.userId) obj.userId = obj.userId.toString();
    delete obj.__v;
    return obj;
  }

  #listCacheKey(userId, page, limit, sort) {
    return this.cacheKey('member', 'list', userId, page, limit, sort);
  }

  async #invalidateListCache(userId) {
    const prefix = this.cacheKey('member', 'list', userId);
    if (this.cacheService?.delByPattern) {
      await this.cacheService.delByPattern(`${prefix}*`);
    }
  }

  #normalizePayload(data = {}) {
    const payload = { ...data };
    if (payload.phone === '') payload.phone = null;
    if (payload.avatarUrl === '') payload.avatarUrl = null;
    if (payload.skinType === '') payload.skinType = null;
    if (payload.medicalNotes === '') payload.medicalNotes = null;
    if (payload.age === undefined) delete payload.age;
    return payload;
  }

  async listMine(userId, query = {}) {
    const pagination = parseListQuery(query, {
      allowedSortFields: [...MEMBER_SORT_FIELDS],
      defaultSort: DEFAULT_MEMBER_SORT,
    });
    const cacheKey = this.#listCacheKey(
      userId,
      pagination.page,
      pagination.limit,
      pagination.sort,
    );

    const cached = await this.getCached(cacheKey);
    if (cached) return cached;

    const { items, total } = await this.memberRepository.listByUser(userId, {
      skip: pagination.skip,
      limit: pagination.limit,
      sort: pagination.sort,
    });

    const result = {
      items: items.map((m) => this.#sanitize(m)),
      meta: buildPaginationMeta(total, pagination),
    };

    await this.setCached(cacheKey, result, MEMBER_LIST_CACHE_TTL_SECONDS);
    return result;
  }

  async getMineById(userId, id) {
    const member = await this.memberRepository.findActiveByIdForUser(id, userId);
    if (!member) {
      throw new AppError('Member not found', HttpStatus.NOT_FOUND, ErrorCodes.MEMBER_NOT_FOUND);
    }
    return this.#sanitize(member);
  }

  /**
   * Used by cart — returns lean member or null.
   */
  async findActiveForUser(userId, id) {
    return this.memberRepository.findActiveByIdForUser(id, userId);
  }

  async createMine(userId, data) {
    const count = await this.memberRepository.countActiveByUser(userId);
    if (count >= MAX_MEMBERS_PER_USER) {
      throw new AppError(
        `Maximum of ${MAX_MEMBERS_PER_USER} members allowed`,
        HttpStatus.BAD_REQUEST,
        ErrorCodes.MEMBER_LIMIT,
      );
    }

    const payload = this.#normalizePayload(data);
    const created = await this.memberRepository.create({
      ...payload,
      userId,
    });

    await this.#invalidateListCache(userId);
    return this.#sanitize(created);
  }

  async updateMine(userId, id, data = {}) {
    const existing = await this.memberRepository.findActiveByIdForUser(id, userId);
    if (!existing) {
      throw new AppError('Member not found', HttpStatus.NOT_FOUND, ErrorCodes.MEMBER_NOT_FOUND);
    }

    const payload = this.#normalizePayload(data);
    if (!Object.keys(payload).length) {
      throw new AppError(
        'No fields to update',
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const updated = await this.memberRepository.updateById(id, payload);
    await this.#invalidateListCache(userId);
    if (!updated) {
      throw new AppError('Member not found', HttpStatus.NOT_FOUND, ErrorCodes.MEMBER_NOT_FOUND);
    }
    return this.#sanitize(updated);
  }

  async deleteMine(userId, id) {
    const existing = await this.memberRepository.findActiveByIdForUser(id, userId);
    if (!existing) {
      throw new AppError('Member not found', HttpStatus.NOT_FOUND, ErrorCodes.MEMBER_NOT_FOUND);
    }

    await this.memberRepository.softDeleteForUser(id, userId);
    await this.#invalidateListCache(userId);
    return true;
  }
}
