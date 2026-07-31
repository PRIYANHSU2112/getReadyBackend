import { BaseService } from '../../common/base/BaseService.js';
import { AppError } from '../../common/errors/AppError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import {
  SKILL_CACHE_TTL_SECONDS,
  SKILL_SORT_FIELDS,
  DEFAULT_SKILL_SORT,
} from '../../common/constants/skill.js';
import { buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { parseListQuery } from '../../common/helpers/list-query.helper.js';
import { TtlMemoryCache } from '../../core/cache/ttl-memory-cache.js';

const publicLocalCache = new TtlMemoryCache();

export class SkillService extends BaseService {
  /**
   * @param {import('./skill.repository.js').SkillRepository} skillRepository
   * @param {import('../../core/redis/cache.service.js').CacheService|null} cacheService
   */
  constructor(skillRepository, cacheService = null) {
    super(null, cacheService);
    this.skillRepository = skillRepository;
  }

  #sanitize(doc) {
    if (!doc) return doc;
    const obj = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
    if (obj._id) obj.id = obj._id.toString();
    return obj;
  }

  #publicListCacheKey(categoryId) {
    if (categoryId) return this.cacheKey('skill', 'public', 'cat', categoryId);
    return this.cacheKey('skill', 'public', 'all');
  }

  async #invalidatePublicCache() {
    const prefix = this.cacheKey('skill', 'public');
    for (const key of [...publicLocalCache.store.keys()]) {
      if (key.startsWith(prefix)) publicLocalCache.delSync(key);
    }
    if (this.cacheService?.delByPattern) {
      await this.cacheService.delByPattern(`${prefix}*`);
    }
  }

  async #assertNameUnique(name, excludeId = null) {
    const existing = await this.skillRepository.findByName(name, { excludeId });
    if (existing) {
      throw new AppError(
        `Skill "${name}" already exists`,
        HttpStatus.CONFLICT,
        ErrorCodes.CONFLICT,
      );
    }
  }

  /**
   * Public/Beautician — list active skills for selection with L1 (Memory) + L2 (Redis) cache.
   */
  async listActive(query = {}) {
    const categoryId = query.categoryId || null;
    const cacheKey = this.#publicListCacheKey(categoryId);

    // L1 Cache: Fast Memory Cache
    const local = publicLocalCache.getSync(cacheKey);
    if (local) return local;

    // L2 Cache: Redis Cache
    const cached = await this.getCached(cacheKey);
    if (cached) {
      publicLocalCache.setSync(cacheKey, cached, SKILL_CACHE_TTL_SECONDS);
      return cached;
    }

    // L3 Database Fetch
    const items = await this.skillRepository.listPublicSlim({ categoryId });
    const result = { items, total: items.length };

    publicLocalCache.setSync(cacheKey, result, SKILL_CACHE_TTL_SECONDS);
    await this.setCached(cacheKey, result, SKILL_CACHE_TTL_SECONDS);

    return result;
  }

  /**
   * Admin — create a new skill.
   */
  async create(data, actorId = null) {
    const payload = { ...data };
    await this.#assertNameUnique(payload.name);
    if (actorId) {
      payload.createdBy = actorId;
      payload.updatedBy = actorId;
    }
    const created = await this.skillRepository.create(payload);
    await this.#invalidatePublicCache();
    return this.#sanitize(created);
  }

  /**
   * Admin — update a skill.
   */
  async update(id, data, actorId = null) {
    const existing = await this.skillRepository.findById(id);
    this.ensureFound(existing, 'Skill not found');
    if (existing.deletedAt) {
      throw new AppError('Skill is deleted', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    const payload = { ...data };
    if (payload.name) {
      await this.#assertNameUnique(payload.name, id);
    }
    if (actorId) payload.updatedBy = actorId;

    const updated = await this.skillRepository.updateById(id, payload);
    await this.#invalidatePublicCache();
    return this.#sanitize(this.ensureFound(updated, 'Skill not found'));
  }

  /**
   * Admin — soft delete a skill.
   */
  async remove(id) {
    const existing = await this.skillRepository.findById(id);
    this.ensureFound(existing, 'Skill not found');
    await this.skillRepository.softDelete(id);
    await this.#invalidatePublicCache();
    return true;
  }

  /**
   * Admin — list all skills with pagination.
   */
  async list(query = {}) {
    const pagination = parseListQuery(query, {
      allowedSortFields: SKILL_SORT_FIELDS,
      defaultSort: DEFAULT_SKILL_SORT,
    });

    const filter = this.skillRepository.buildAdminFilter(query);

    const { items, total } = await this.skillRepository.listAdmin(filter, {
      skip: pagination.skip,
      limit: pagination.limit,
      sort: pagination.sort,
    });

    return {
      items: items.map((i) => this.#sanitize(i)),
      meta: buildPaginationMeta(total, pagination),
    };
  }

  /**
   * Admin — get a single skill by ID.
   */
  async getById(id) {
    const skill = await this.skillRepository.findById(id);
    return this.#sanitize(this.ensureFound(skill, 'Skill not found'));
  }

  /**
   * Validate that all given skill IDs exist and are active.
   */
  async validateSkillIds(skillIds = []) {
    if (!skillIds.length) return [];
    const skills = await this.skillRepository.findByIds(skillIds);
    const foundIds = new Set(skills.map((s) => s._id.toString()));
    const missing = skillIds.filter((id) => !foundIds.has(id.toString()));
    if (missing.length) {
      throw new AppError(
        `Invalid skill IDs: ${missing.join(', ')}`,
        HttpStatus.BAD_REQUEST,
        ErrorCodes.BAD_REQUEST,
      );
    }
    return skills;
  }
}
