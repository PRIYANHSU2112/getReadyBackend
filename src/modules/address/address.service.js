import { BaseService } from '../../common/base/BaseService.js';
import { AppError } from '../../common/errors/AppError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import {
  MAX_ADDRESSES_PER_USER,
  ADDRESS_LIST_CACHE_TTL_SECONDS,
  ADDRESS_SORT_FIELDS,
  DEFAULT_ADDRESS_SORT,
  GeoJsonType,
} from '../../common/constants/address.js';
import { buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { parseListQuery } from '../../common/helpers/list-query.helper.js';
import { TtlMemoryCache } from '../../core/cache/ttl-memory-cache.js';

/** Process-local list cache — invalidated on write. */
const listLocalCache = new TtlMemoryCache();

export class AddressService extends BaseService {
  /**
   * @param {import('./address.repository.js').AddressRepository} addressRepository
   * @param {import('../../core/redis/cache.service.js').CacheService|null} cacheService
   */
  constructor(addressRepository, cacheService = null) {
    super(null, cacheService);
    this.addressRepository = addressRepository;
  }

  #sanitize(address) {
    if (!address) return address;
    const obj = typeof address.toJSON === 'function' ? address.toJSON() : { ...address };
    if (obj._id) obj.id = obj._id.toString();
    if (obj.userId) obj.userId = obj.userId.toString();
    return obj;
  }

  #listCacheKey(userId, page, limit, sort) {
    return this.cacheKey('address', 'list', userId, page, limit, sort);
  }

  async #invalidateListCache(userId) {
    // Clear process TTL entries for this user (prefix scan)
    const prefix = this.cacheKey('address', 'list', userId);
    for (const key of [...listLocalCache.store.keys()]) {
      if (key.startsWith(prefix)) listLocalCache.delSync(key);
    }
    if (this.cacheService?.delByPattern) {
      await this.cacheService.delByPattern(`${prefix}*`);
    }
  }

  #toLocation(lat, lng) {
    if (lat === undefined || lng === undefined || lat === null || lng === null) {
      return undefined;
    }
    return { type: GeoJsonType.POINT, coordinates: [Number(lng), Number(lat)] };
  }

  #normalizePayload(data = {}) {
    const payload = { ...data };
    if (payload.line2 === '') payload.line2 = null;
    if (payload.landmark === '') payload.landmark = null;

    const location = this.#toLocation(payload.lat, payload.lng);
    delete payload.lat;
    delete payload.lng;
    if (location) payload.location = location;

    return payload;
  }

  async listMine(userId, query = {}) {
    const pagination = parseListQuery(query, {
      allowedSortFields: [...ADDRESS_SORT_FIELDS],
      defaultSort: DEFAULT_ADDRESS_SORT,
    });
    const cacheKey = this.#listCacheKey(
      userId,
      pagination.page,
      pagination.limit,
      pagination.sort,
    );

    const local = listLocalCache.getSync(cacheKey);
    if (local) return local;

    const cached = await this.getCached(cacheKey);
    if (cached) {
      listLocalCache.setSync(cacheKey, cached, ADDRESS_LIST_CACHE_TTL_SECONDS);
      return cached;
    }

    const { items, total } = await this.addressRepository.listByUser(userId, {
      skip: pagination.skip,
      limit: pagination.limit,
      sort: pagination.sort,
    });

    const result = {
      items: items.map((a) => this.#sanitize(a)),
      meta: buildPaginationMeta(total, pagination),
    };

    listLocalCache.setSync(cacheKey, result, ADDRESS_LIST_CACHE_TTL_SECONDS);
    await this.setCached(cacheKey, result, ADDRESS_LIST_CACHE_TTL_SECONDS);
    return result;
  }

  async getMineById(userId, id) {
    const address = await this.addressRepository.findActiveByIdForUser(id, userId);
    return this.#sanitize(this.ensureFound(address, 'Address not found'));
  }

  async createMine(userId, data) {
    const count = await this.addressRepository.countActiveByUser(userId);
    if (count >= MAX_ADDRESSES_PER_USER) {
      throw new AppError(
        `Maximum of ${MAX_ADDRESSES_PER_USER} addresses allowed`,
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const payload = this.#normalizePayload(data);
    const makeDefault = count === 0 || payload.isDefault === true;

    if (makeDefault) {
      await this.addressRepository.clearDefaultForUser(userId);
    }

    const created = await this.addressRepository.create({
      ...payload,
      userId,
      isDefault: makeDefault,
    });

    await this.#invalidateListCache(userId);
    return this.#sanitize(created);
  }

  async updateMine(userId, id, data = {}) {
    const existing = await this.addressRepository.findActiveByIdForUser(id, userId);
    this.ensureFound(existing, 'Address not found');

    const payload = this.#normalizePayload(data);
    if (!Object.keys(payload).length) {
      throw new AppError(
        'No fields to update',
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    if (payload.isDefault === true) {
      await this.addressRepository.clearDefaultForUser(userId);
    }

    const updated = await this.addressRepository.updateById(id, payload);
    await this.#invalidateListCache(userId);
    return this.#sanitize(this.ensureFound(updated, 'Address not found'));
  }

  async setDefaultMine(userId, id) {
    const existing = await this.addressRepository.findActiveByIdForUser(id, userId);
    this.ensureFound(existing, 'Address not found');

    await this.addressRepository.clearDefaultForUser(userId);
    const updated = await this.addressRepository.updateById(id, { isDefault: true });
    await this.#invalidateListCache(userId);
    return this.#sanitize(this.ensureFound(updated, 'Address not found'));
  }

  async deleteMine(userId, id) {
    const existing = await this.addressRepository.findActiveByIdForUser(id, userId);
    this.ensureFound(existing, 'Address not found');

    const wasDefault = existing.isDefault === true;
    await this.addressRepository.softDeleteForUser(id, userId);

    if (wasDefault) {
      const next = await this.addressRepository.findLatestActiveForUser(userId);
      if (next) {
        await this.addressRepository.updateById(next._id.toString(), { isDefault: true });
      }
    }

    await this.#invalidateListCache(userId);
    return true;
  }
}
