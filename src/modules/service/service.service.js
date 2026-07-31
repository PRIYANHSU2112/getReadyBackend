import { BaseService } from '../../common/base/BaseService.js';
import { AppError } from '../../common/errors/AppError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import {
  UserRole,
  ServiceStatus,
  ServiceDiscountType,
  ServiceChangeRequestStatus,
} from '../../common/constants/enums.js';
import {
  SERVICE_PUBLIC_CACHE_TTL_SECONDS,
  SERVICE_SORT_FIELDS,
  DEFAULT_SERVICE_SORT,
  SERVICE_CHANGE_DIFFABLE_FIELDS,
  SERVICE_ADMIN_ONLY_PRICE_FIELDS,
  SERVICE_DIFF_FIELD_META,
} from '../../common/constants/service.js';
import { buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { parseListQuery } from '../../common/helpers/list-query.helper.js';
import { slugify } from '../../common/utils/slug.util.js';
import { TtlMemoryCache } from '../../core/cache/ttl-memory-cache.js';

const publicLocalCache = new TtlMemoryCache();

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function normalizeComparable(value) {
  if (value === undefined) return null;
  if (value && typeof value === 'object' && value._id) {
    return value._id.toString();
  }
  if (value && typeof value === 'object' && value.toString && value._bsontype === 'ObjectID') {
    return value.toString();
  }
  return value;
}

export class ServiceService extends BaseService {
  /**
   * @param {import('./service.repository.js').ServiceRepository} serviceRepository
   * @param {import('./service-change-request.repository.js').ServiceChangeRequestRepository} changeRequestRepository
   * @param {import('../category/category.repository.js').CategoryRepository|null} categoryRepository
   * @param {import('../../core/redis/cache.service.js').CacheService|null} cacheService
   * @param {import('../../core/storage/StorageService.js').StorageService|null} storageService
   */
  constructor(
    serviceRepository,
    changeRequestRepository,
    categoryRepository = null,
    cacheService = null,
    storageService = null,
  ) {
    super(null, cacheService);
    this.serviceRepository = serviceRepository;
    this.changeRequestRepository = changeRequestRepository;
    this.categoryRepository = categoryRepository;
    this.storageService = storageService;
  }

  #isAdmin(actor) {
    return (
      actor?.role === UserRole.ADMIN || actor?.role === UserRole.SUPER_ADMIN
    );
  }

  #isBeautician(actor) {
    return actor?.role === UserRole.BEAUTICIAN;
  }

  #sanitize(doc) {
    if (!doc) return doc;
    const obj = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
    if (obj._id) obj.id = obj._id.toString();
    if (obj.categoryId) obj.categoryId = obj.categoryId.toString();
    if (obj.createdBy) obj.createdBy = obj.createdBy.toString();
    if (obj.updatedBy) obj.updatedBy = obj.updatedBy.toString();
    if (obj.approvedBy) obj.approvedBy = obj.approvedBy.toString();
    if (obj.rejectedBy) obj.rejectedBy = obj.rejectedBy.toString();
    if (obj.requestedBy) obj.requestedBy = obj.requestedBy.toString();
    if (obj.serviceId) obj.serviceId = obj.serviceId.toString();
    return obj;
  }

  #stripBeauticianPriceFields(payload = {}) {
    const out = { ...payload };
    for (const key of SERVICE_ADMIN_ONLY_PRICE_FIELDS) {
      delete out[key];
    }
    return out;
  }

  #normalizePayload(payload = {}) {
    const out = { ...payload };
    delete out.file;
    delete out.files;
    delete out.imageUrl;

    for (const key of ['shortDescription', 'description']) {
      if (out[key] === '') out[key] = null;
    }

    for (const key of [
      'isPopular',
      'isTrending',
      'isFeatured',
      'isActive',
      'isHomeServiceAvailable',
    ]) {
      if (out[key] === 'true') out[key] = true;
      if (out[key] === 'false') out[key] = false;
    }

    if (typeof out.metadata === 'string') {
      try {
        out.metadata = JSON.parse(out.metadata);
      } catch {
        out.metadata = {};
      }
    }

    for (const key of ['images', 'inclusions', 'badges', 'tags', 'thumbnail', 'video']) {
      if (typeof out[key] === 'string') {
        try {
          out[key] = JSON.parse(out[key]);
        } catch {
          // leave as-is; validation should catch
        }
      }
    }

    return out;
  }

  computeDiscountedPrice(price, discountType, discountValue = 0) {
    if (price == null) return null;
    const type = discountType || ServiceDiscountType.NONE;
    const value = Number(discountValue) || 0;
    if (type === ServiceDiscountType.NONE || value === 0) return price;
    if (type === ServiceDiscountType.PERCENTAGE) {
      if (value > 100) {
        throw new AppError(
          'discountValue percent cannot exceed 100',
          HttpStatus.UNPROCESSABLE,
          ErrorCodes.VALIDATION_ERROR,
        );
      }
      return Math.max(0, Math.round(price * (1 - value / 100) * 100) / 100);
    }
    if (type === ServiceDiscountType.FIXED) {
      if (value > price) {
        throw new AppError(
          'discountValue cannot exceed price',
          HttpStatus.UNPROCESSABLE,
          ErrorCodes.VALIDATION_ERROR,
        );
      }
      return Math.max(0, Math.round((price - value) * 100) / 100);
    }
    return price;
  }

  #applyPricingFields(payload) {
    if (payload.price === undefined && payload.discountType === undefined) {
      return payload;
    }
    const price = payload.price;
    const discountType = payload.discountType ?? ServiceDiscountType.NONE;
    const discountValue =
      discountType === ServiceDiscountType.NONE
        ? 0
        : payload.discountValue ?? 0;
    payload.discountType = discountType;
    payload.discountValue = discountValue;
    if (price != null) {
      payload.discountedPrice = this.computeDiscountedPrice(
        price,
        discountType,
        discountValue,
      );
    }
    return payload;
  }

  async #uploadFile(file) {
    if (!this.storageService) {
      throw new AppError(
        'Storage service is not configured',
        HttpStatus.INTERNAL_ERROR,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
    const uploaded = await this.storageService.upload(file);
    return { url: uploaded.url, publicId: uploaded.key };
  }

  async #attachUploadedMedia(payload, files = [], thumbnailFile = null) {
    const out = { ...payload };
    if (files?.length) {
      const uploaded = [];
      for (let i = 0; i < files.length; i += 1) {
        const media = await this.#uploadFile(files[i]);
        uploaded.push({
          ...media,
          isPrimary: i === 0,
          displayOrder: i,
        });
      }
      out.images = uploaded;
    }
    if (thumbnailFile) {
      out.thumbnail = await this.#uploadFile(thumbnailFile);
    }
    return out;
  }

  #resolveSlug(name, slug) {
    const resolved = slugify(slug || name);
    if (!resolved) {
      throw new AppError(
        'Unable to generate a valid slug',
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.VALIDATION_ERROR,
      );
    }
    return resolved;
  }

  async #assertSlugUnique(slug, excludeId = null) {
    const existing = await this.serviceRepository.findBySlug(slug, { excludeId });
    if (existing) {
      throw new AppError(
        `Service slug "${slug}" already exists`,
        HttpStatus.CONFLICT,
        ErrorCodes.CONFLICT,
      );
    }
  }

  async #assertCategory(categoryId) {
    if (!this.categoryRepository) return;
    const category = await this.categoryRepository.findActiveById(categoryId);
    if (!category || category.isActive === false) {
      throw new AppError(
        'Category not found or inactive',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }
  }

  #assertCanAccessService(service, actor) {
    if (this.#isAdmin(actor)) return;
    if (
      this.#isBeautician(actor) &&
      service.createdBy?.toString() === actor.id
    ) {
      return;
    }
    throw new AppError(
      'Forbidden',
      HttpStatus.FORBIDDEN,
      ErrorCodes.FORBIDDEN,
    );
  }

  async #invalidatePublicCache() {
    const prefix = this.cacheKey('service', 'public');
    for (const key of [...publicLocalCache.store.keys()]) {
      if (key.startsWith(prefix)) publicLocalCache.delSync(key);
    }
    if (this.cacheService?.delByPattern) {
      await this.cacheService.delByPattern(`${prefix}*`);
    }
  }

  #publicListCacheKey(query, pagination) {
    const keyParts = [
      'public',
      query.categoryId || 'all',
      query.gender || 'all',
      query.search || query.q || 'none',
      query.minPrice ?? 'none',
      query.maxPrice ?? 'none',
      query.minRating ?? 'none',
      query.sort || 'default',
      query.featured ? 'f' : '0',
      query.popular ? 'p' : '0',
      query.trending ? 't' : '0',
      query.isHomeServiceAvailable ? 'h' : '0',
      query.tag || 'none',
      pagination.page,
      pagination.limit,
    ];
    return this.cacheKey('service', ...keyParts);
  }

  buildDiff(previousValues = {}, changes = {}) {
    return Object.keys(changes).map((field) => {
      const meta = SERVICE_DIFF_FIELD_META[field] || {
        label: field,
        type: 'object',
      };
      return {
        field,
        label: meta.label,
        previousValue: previousValues[field] ?? null,
        newValue: changes[field],
        type: meta.type,
      };
    });
  }

  #buildChangeDiff(live, payload) {
    const changes = {};
    const previousValues = {};
    for (const field of SERVICE_CHANGE_DIFFABLE_FIELDS) {
      if (payload[field] === undefined) continue;
      let nextVal = payload[field];
      let prevVal = live[field];
      if (field === 'categoryId') {
        nextVal = nextVal?.toString?.() || nextVal;
        prevVal = prevVal?.toString?.() || prevVal;
      }
      if (!deepEqual(normalizeComparable(prevVal), normalizeComparable(nextVal))) {
        changes[field] = nextVal;
        previousValues[field] =
          field === 'categoryId' ? prevVal?.toString?.() || prevVal : prevVal;
      }
    }
    return { changes, previousValues, changedFields: Object.keys(changes) };
  }

  async listPublic(query = {}) {
    let activeQuery = { ...query };
    if (!activeQuery.categoryId && activeQuery.categorySlug && this.categoryRepository) {
      const category = await this.categoryRepository.findBySlug(activeQuery.categorySlug);
      if (!category) {
        return {
          items: [],
          meta: buildPaginationMeta(0, { page: 1, limit: 20 }),
        };
      }
      activeQuery.categoryId = category._id.toString();
    }

    const pagination = parseListQuery(
      { ...activeQuery, limit: activeQuery.limit || 20 },
      {
        allowedSortFields: [...SERVICE_SORT_FIELDS],
        defaultSort: DEFAULT_SERVICE_SORT,
      },
    );
    if (pagination.limit > 100) pagination.limit = 100;
    pagination.skip = (pagination.page - 1) * pagination.limit;
    const cacheKey = this.#publicListCacheKey(activeQuery, pagination);

    if (cacheKey) {
      const local = publicLocalCache.getSync(cacheKey);
      if (local) return local;
      const cached = await this.getCached(cacheKey);
      if (cached) {
        publicLocalCache.setSync(cacheKey, cached, SERVICE_PUBLIC_CACHE_TTL_SECONDS);
        return cached;
      }
    }

    let items = [];
    let total = 0;
    const res = await this.serviceRepository.listPublicSlim(activeQuery, {
      skip: pagination.skip,
      limit: pagination.limit,
    });

    if (Array.isArray(res)) {
      items = res;
      total = await this.serviceRepository.countPublic(activeQuery);
    } else if (res && typeof res === 'object') {
      items = res.items || [];
      total = res.total ?? (await this.serviceRepository.countPublic(activeQuery));
    }

    const result = {
      items,
      meta: buildPaginationMeta(total, pagination),
    };

    if (cacheKey) {
      publicLocalCache.setSync(cacheKey, result, SERVICE_PUBLIC_CACHE_TTL_SECONDS);
      await this.setCached(cacheKey, result, SERVICE_PUBLIC_CACHE_TTL_SECONDS);
    }
    return result;
  }

  async getPublicBySlug(slug) {
    const cacheKey = this.cacheKey('service', 'public', 'slug', slug);
    const local = publicLocalCache.getSync(cacheKey);
    if (local) return local;
    const cached = await this.getCached(cacheKey);
    if (cached) {
      publicLocalCache.setSync(cacheKey, cached, SERVICE_PUBLIC_CACHE_TTL_SECONDS);
      return cached;
    }
    const data = await this.serviceRepository.findPublicBySlug(slug);
    this.ensureFound(data, 'Service not found');
    publicLocalCache.setSync(cacheKey, data, SERVICE_PUBLIC_CACHE_TTL_SECONDS);
    await this.setCached(cacheKey, data, SERVICE_PUBLIC_CACHE_TTL_SECONDS);
    return data;
  }

  async list(query = {}, actor = null) {
    const pagination = parseListQuery(query, {
      allowedSortFields: [...SERVICE_SORT_FIELDS],
      defaultSort: DEFAULT_SERVICE_SORT,
    });
    const createdBy =
      this.#isBeautician(actor) && !this.#isAdmin(actor) ? actor.id : null;
    const filter = this.serviceRepository.buildAdminFilter(query, { createdBy });
    const { items, total } = await this.serviceRepository.listAdmin(filter, {
      skip: pagination.skip,
      limit: pagination.limit,
      sort: pagination.sort,
    });
    return {
      items: items.map((i) => this.#sanitize(i)),
      meta: buildPaginationMeta(total, pagination),
    };
  }

  async getById(id, actor = null) {
    const service = await this.serviceRepository.findActiveById(id);
    this.ensureFound(service, 'Service not found');
    this.#assertCanAccessService(service, actor);
    return this.#sanitize(service);
  }

  async create(data, actor, files = [], thumbnailFile = null) {
    let payload = this.#normalizePayload(data);
    if (this.#isBeautician(actor)) {
      payload = this.#stripBeauticianPriceFields(payload);
    }
    payload = await this.#attachUploadedMedia(payload, files, thumbnailFile);
    payload.slug = this.#resolveSlug(payload.name, payload.slug);
    await this.#assertSlugUnique(payload.slug);
    await this.#assertCategory(payload.categoryId);

    if (this.#isAdmin(actor) && payload.price != null) {
      payload = this.#applyPricingFields(payload);
      payload.status = ServiceStatus.APPROVED;
      payload.approvedBy = actor.id;
      payload.approvedAt = new Date();
    } else {
      payload.status = ServiceStatus.PENDING_APPROVAL;
      payload.price = null;
      payload.discountedPrice = null;
      payload.discountType = ServiceDiscountType.NONE;
      payload.discountValue = 0;
    }

    if (actor?.id) {
      payload.createdBy = actor.id;
      payload.updatedBy = actor.id;
    }

    const created = await this.serviceRepository.create(payload);
    if (created.status === ServiceStatus.APPROVED) {
      await this.#invalidatePublicCache();
    }
    return this.#sanitize(created);
  }

  async update(id, data = {}, actor, files = [], thumbnailFile = null) {
    const existing = await this.serviceRepository.findActiveById(id);
    this.ensureFound(existing, 'Service not found');
    this.#assertCanAccessService(existing, actor);

    let payload = this.#normalizePayload(data);
    if (!Object.keys(payload).length && !files?.length && !thumbnailFile) {
      throw new AppError(
        'No fields to update',
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    if (this.#isBeautician(actor) && !this.#isAdmin(actor)) {
      payload = this.#stripBeauticianPriceFields(payload);
      payload = await this.#attachUploadedMedia(payload, files, thumbnailFile);
      return this.#submitChangeRequest(existing, payload, actor);
    }

    // Admin direct update
    payload = await this.#attachUploadedMedia(payload, files, thumbnailFile);
    if (payload.slug || payload.name) {
      payload.slug = this.#resolveSlug(payload.name || existing.name, payload.slug);
      await this.#assertSlugUnique(payload.slug, id);
    }
    if (payload.categoryId) await this.#assertCategory(payload.categoryId);
    payload = this.#applyPricingFields({
      price: payload.price !== undefined ? payload.price : existing.price,
      discountType:
        payload.discountType !== undefined
          ? payload.discountType
          : existing.discountType,
      discountValue:
        payload.discountValue !== undefined
          ? payload.discountValue
          : existing.discountValue,
      ...payload,
    });
    if (actor?.id) payload.updatedBy = actor.id;

    const updated = await this.serviceRepository.updateById(id, payload);
    await this.#invalidatePublicCache();
    return this.#sanitize(this.ensureFound(updated, 'Service not found'));
  }

  async #submitChangeRequest(live, payload, actor) {
    if (payload.slug || payload.name) {
      payload.slug = this.#resolveSlug(payload.name || live.name, payload.slug);
      await this.#assertSlugUnique(payload.slug, live._id || live.id);
    }
    if (payload.categoryId) await this.#assertCategory(payload.categoryId);

    const { changes, previousValues, changedFields } = this.#buildChangeDiff(
      live,
      payload,
    );
    if (!changedFields.length) {
      throw new AppError(
        'No changes detected',
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const serviceId = live._id || live.id;
    const pending = await this.changeRequestRepository.findPendingByServiceId(
      serviceId,
    );

    if (pending) {
      if (pending.requestedBy?.toString() !== actor.id) {
        throw new AppError(
          'A pending change request already exists for this service',
          HttpStatus.CONFLICT,
          ErrorCodes.CONFLICT,
        );
      }
      const updated = await this.changeRequestRepository.updateById(pending._id, {
        changes,
        previousValues,
        changedFields,
        status: ServiceChangeRequestStatus.PENDING,
        rejectedReason: null,
        rejectedBy: null,
        rejectedAt: null,
      });
      return {
        changeRequest: this.#sanitizeChangeRequest(updated),
        liveUnchanged: true,
      };
    }

    const created = await this.changeRequestRepository.create({
      serviceId,
      requestedBy: actor.id,
      status: ServiceChangeRequestStatus.PENDING,
      changes,
      previousValues,
      changedFields,
    });
    return {
      changeRequest: this.#sanitizeChangeRequest(created),
      liveUnchanged: true,
    };
  }

  #sanitizeChangeRequest(doc) {
    const sanitized = this.#sanitize(doc);
    sanitized.diff = this.buildDiff(
      sanitized.previousValues || {},
      sanitized.changes || {},
    );
    return sanitized;
  }

  async approveCreate(id, body, actor) {
    if (!this.#isAdmin(actor)) {
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }
    const existing = await this.serviceRepository.findActiveById(id);
    this.ensureFound(existing, 'Service not found');
    if (existing.status === ServiceStatus.APPROVED) {
      throw new AppError(
        'Service is already approved',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.BAD_REQUEST,
      );
    }

    const pricing = this.#applyPricingFields({
      price: body.price,
      discountType: body.discountType,
      discountValue: body.discountValue,
    });

    const updated = await this.serviceRepository.updateById(id, {
      ...pricing,
      status: ServiceStatus.APPROVED,
      approvedBy: actor.id,
      approvedAt: new Date(),
      rejectionReason: null,
      rejectedBy: null,
      rejectedAt: null,
      updatedBy: actor.id,
      isActive: true,
    });
    await this.#invalidatePublicCache();
    return this.#sanitize(updated);
  }

  async rejectCreate(id, body, actor) {
    if (!this.#isAdmin(actor)) {
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }
    const existing = await this.serviceRepository.findActiveById(id);
    this.ensureFound(existing, 'Service not found');

    const updated = await this.serviceRepository.updateById(id, {
      status: ServiceStatus.REJECTED,
      rejectionReason: body.rejectionReason,
      rejectedBy: actor.id,
      rejectedAt: new Date(),
      updatedBy: actor.id,
      isActive: false,
    });
    await this.#invalidatePublicCache();
    return this.#sanitize(updated);
  }

  async listChangeRequests(query = {}, actor = null) {
    const pagination = parseListQuery(query, {
      allowedSortFields: ['createdAt', 'updatedAt', 'status'],
      defaultSort: '-createdAt',
    });
    let requestedBy = null;
    if (this.#isBeautician(actor) && !this.#isAdmin(actor)) {
      requestedBy = actor.id;
    } else if (query.mine === true && actor?.id) {
      requestedBy = actor.id;
    }
    const filter = this.changeRequestRepository.buildListFilter(query, {
      requestedBy,
    });
    const { items, total } = await this.changeRequestRepository.list(filter, {
      skip: pagination.skip,
      limit: pagination.limit,
      sort: pagination.sort,
    });
    return {
      items: items.map((i) => this.#sanitizeChangeRequest(i)),
      meta: buildPaginationMeta(total, pagination),
    };
  }

  async getChangeRequestById(id, actor = null) {
    const cr = await this.changeRequestRepository.findByIdAny(id);
    this.ensureFound(cr, 'Change request not found');
    if (
      this.#isBeautician(actor) &&
      !this.#isAdmin(actor) &&
      cr.requestedBy?.toString() !== actor.id
    ) {
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }
    return this.#sanitizeChangeRequest(cr);
  }

  async approveChangeRequest(id, body = {}, actor) {
    if (!this.#isAdmin(actor)) {
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    const cr = await this.changeRequestRepository.model.findOne({
      _id: id,
      status: ServiceChangeRequestStatus.PENDING,
    });
    if (!cr) {
      throw new AppError(
        'Pending change request not found',
        HttpStatus.CONFLICT,
        ErrorCodes.CONFLICT,
      );
    }

    const service = await this.serviceRepository.model.findOne({
      _id: cr.serviceId,
      deletedAt: null,
    });
    if (!service) {
      throw new AppError(
        'Service not found',
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
      );
    }

    const applyPayload = { ...(cr.changes || {}) };
    if (body.price !== undefined) {
      Object.assign(
        applyPayload,
        this.#applyPricingFields({
          price: body.price,
          discountType: body.discountType ?? service.discountType,
          discountValue: body.discountValue ?? service.discountValue,
        }),
      );
    }
    applyPayload.updatedBy = actor.id;

    await this.serviceRepository.model.updateOne(
      { _id: service._id },
      { $set: applyPayload },
    );

    cr.status = ServiceChangeRequestStatus.APPROVED;
    cr.approvedBy = actor.id;
    cr.approvedAt = new Date();
    cr.reviewedNote = body.reviewedNote || null;
    cr.rejectedReason = null;
    cr.rejectedBy = null;
    cr.rejectedAt = null;
    await cr.save();

    await this.#invalidatePublicCache();
    const updatedService = await this.serviceRepository.findActiveById(service._id);
    return {
      changeRequest: this.#sanitizeChangeRequest(cr.toObject()),
      service: this.#sanitize(updatedService),
    };
  }

  async rejectChangeRequest(id, body, actor) {
    if (!this.#isAdmin(actor)) {
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }
    const cr = await this.changeRequestRepository.findByIdAny(id);
    this.ensureFound(cr, 'Change request not found');
    if (cr.status !== ServiceChangeRequestStatus.PENDING) {
      throw new AppError(
        'Only pending change requests can be rejected',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.BAD_REQUEST,
      );
    }

    const updated = await this.changeRequestRepository.updateById(id, {
      status: ServiceChangeRequestStatus.REJECTED,
      rejectedReason: body.rejectedReason,
      rejectedBy: actor.id,
      rejectedAt: new Date(),
    });
    return this.#sanitizeChangeRequest(updated);
  }

  async remove(id, actor) {
    if (!this.#isAdmin(actor)) {
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }
    const existing = await this.serviceRepository.findActiveById(id);
    this.ensureFound(existing, 'Service not found');
    await this.serviceRepository.softDelete(id);
    await this.#invalidatePublicCache();
    return true;
  }

  async restore(id, actor) {
    if (!this.#isAdmin(actor)) {
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }
    const existing = await this.serviceRepository.findByIdAny(id);
    this.ensureFound(existing, 'Service not found');
    if (!existing.deletedAt) {
      throw new AppError(
        'Service is not deleted',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.BAD_REQUEST,
      );
    }
    await this.#assertSlugUnique(existing.slug, id);
    const restored = await this.serviceRepository.restore(id);
    await this.#invalidatePublicCache();
    return this.#sanitize(restored);
  }

  async setStatus(id, isActive, actor) {
    const existing = await this.serviceRepository.findActiveById(id);
    this.ensureFound(existing, 'Service not found');
    this.#assertCanAccessService(existing, actor);

    const updated = await this.serviceRepository.updateById(id, {
      isActive,
      updatedBy: actor?.id,
    });
    await this.#invalidatePublicCache();
    return this.#sanitize(updated);
  }

  async reorder(items, actor) {
    if (!this.#isAdmin(actor)) {
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }
    await this.serviceRepository.reorder(items);
    await this.#invalidatePublicCache();
    return true;
  }

  async bulkSetStatus(ids, isActive, actor) {
    if (!this.#isAdmin(actor)) {
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }
    await this.serviceRepository.bulkSetActive(ids, isActive);
    await this.#invalidatePublicCache();
    return true;
  }

  async bulkDelete(ids, actor) {
    if (!this.#isAdmin(actor)) {
      throw new AppError('Forbidden', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }
    await this.serviceRepository.softDeleteMany(ids);
    await this.#invalidatePublicCache();
    return true;
  }
}
