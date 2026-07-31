import { slugify } from '../../common/utils/slug.util.js';
import { BaseService } from '../../common/base/BaseService.js';
import { AppError } from '../../common/errors/AppError.js';
import { NotFoundError } from '../../common/errors/NotFoundError.js';
import { ForbiddenError } from '../../common/errors/ForbiddenError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import { buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { parseListQuery } from '../../common/helpers/list-query.helper.js';
import { TtlMemoryCache } from '../../core/cache/ttl-memory-cache.js';
import {
  PackageStatus,
  PackageChangeRequestStatus,
} from './package.enum.js';

const publicLocalCache = new TtlMemoryCache();
const SERVICE_PUBLIC_CACHE_TTL_SECONDS = 120;
const PUBLIC_CACHE_PREFIX = 'packages:public:v1:';

const DIFF_FIELD_META = {
  name: 'Package Name',
  shortDescription: 'Short Description',
  description: 'Full Description',
  badgeTag: 'Badge Tag',
  packageType: 'Package Type',
  minSelectCount: 'Min Select Count',
  maxSelectCount: 'Max Select Count',
  approxPrice: 'Approximate Price (Beautician)',
  price: 'Actual Selling Price',
  discountType: 'Discount Type',
  discountValue: 'Discount Value',
  gender: 'Gender',
  isActive: 'Active Status',
  isHomeServiceAvailable: 'Home Visit Availability',
};

export class PackageService extends BaseService {
  constructor(packageRepository, categoryRepository, eventBus = null, cacheService = null) {
    super(eventBus, cacheService);
    this.packageRepository = packageRepository;
    this.categoryRepository = categoryRepository;
  }

  #generateSlug(name) {
    return slugify(name);
  }

  async #ensureUniqueSlug(slug, excludeId = null) {
    let candidate = slug;
    let counter = 1;
    while (true) {
      const existing = await this.packageRepository.findOne({ slug: candidate });
      if (!existing || (excludeId && existing._id.toString() === excludeId.toString())) {
        return candidate;
      }
      candidate = `${slug}-${counter}`;
      counter += 1;
    }
  }

  #publicListCacheKey(query) {
    const sorted = Object.keys(query)
      .sort()
      .reduce((acc, k) => {
        if (query[k] !== undefined && query[k] !== '') {
          acc[k] = query[k];
        }
        return acc;
      }, {});
    return `${PUBLIC_CACHE_PREFIX}${JSON.stringify(sorted)}`;
  }

  async invalidatePublicCache() {
    for (const key of [...publicLocalCache.store.keys()]) {
      if (key.startsWith(PUBLIC_CACHE_PREFIX)) publicLocalCache.delSync(key);
    }
  }

  buildDiff(oldDoc, changes) {
    const diff = [];
    for (const key of Object.keys(changes)) {
      if (DIFF_FIELD_META[key]) {
        const oldVal = oldDoc[key];
        const newVal = changes[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          diff.push({
            field: key,
            label: DIFF_FIELD_META[key],
            oldValue: oldVal,
            newValue: newVal,
          });
        }
      }
    }
    return diff;
  }

  async createPackage(payload, user) {
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const isBeautician = user.role === 'beautician';

    if (!isAdmin && !isBeautician) {
      throw new ForbiddenError('Only Admin or Beautician can create packages');
    }

    const baseSlug = payload.slug
      ? this.#generateSlug(payload.slug)
      : this.#generateSlug(payload.name);

    const slug = await this.#ensureUniqueSlug(baseSlug);

    const packageData = {
      ...payload,
      slug,
      createdBy: user.id || user._id,
    };

    if (isAdmin) {
      packageData.status = PackageStatus.APPROVED;
      if (payload.price === undefined || payload.price === null) {
        packageData.price = payload.approxPrice || payload.originalPrice || 0;
      }
    } else {
      packageData.status = PackageStatus.PENDING_APPROVAL;
      packageData.approxPrice = payload.approxPrice ?? payload.price ?? 0;
      packageData.price = null;
    }

    const doc = await this.packageRepository.create(packageData);
    await this.invalidatePublicCache();
    return doc;
  }

  async updatePackage(id, payload, user) {
    const doc = await this.packageRepository.findById(id);
    if (!doc || doc.deletedAt) {
      throw new NotFoundError('Package not found');
    }

    const isAdmin = user.role === 'admin' || user.role === 'super_admin';

    if (isAdmin) {
      if (payload.name && payload.name !== doc.name && !payload.slug) {
        const baseSlug = this.#generateSlug(payload.name);
        payload.slug = await this.#ensureUniqueSlug(baseSlug, id);
      }
      const updated = await this.packageRepository.updateById(id, payload);
      await this.invalidatePublicCache();
      return { live: updated, isChangeRequest: false };
    }

    // Beautician update generates Change Request
    const diff = this.buildDiff(doc, payload);
    if (diff.length === 0) {
      throw new AppError('No changes detected', HttpStatus.BAD_REQUEST);
    }

    const changeRequest = await this.packageRepository.createChangeRequest({
      packageId: id,
      requestedBy: user.id || user._id,
      changes: payload,
      diff,
      status: PackageChangeRequestStatus.PENDING,
    });

    return { changeRequest, isChangeRequest: true, liveUnchanged: true };
  }

  async approvePackage(id, { price, discountType, discountValue }, adminUser) {
    const doc = await this.packageRepository.findById(id);
    if (!doc || doc.deletedAt) {
      throw new NotFoundError('Package not found');
    }

    const updateFields = {
      status: PackageStatus.APPROVED,
      price,
      rejectionReason: null,
    };
    if (discountType) updateFields.discountType = discountType;
    if (discountValue !== undefined) updateFields.discountValue = discountValue;

    const updated = await this.packageRepository.updateById(id, updateFields);
    await this.invalidatePublicCache();
    return updated;
  }

  async rejectPackage(id, { rejectionReason }, adminUser) {
    const doc = await this.packageRepository.findById(id);
    if (!doc || doc.deletedAt) {
      throw new NotFoundError('Package not found');
    }

    const updated = await this.packageRepository.updateById(id, {
      status: PackageStatus.REJECTED,
      rejectionReason,
    });
    await this.invalidatePublicCache();
    return updated;
  }

  async approveChangeRequest(changeRequestId, adminUser) {
    const cr = await this.packageRepository.findChangeRequestById(changeRequestId);
    if (!cr) {
      throw new NotFoundError('Change request not found');
    }
    if (cr.status !== PackageChangeRequestStatus.PENDING) {
      throw new AppError('Change request is already processed', HttpStatus.BAD_REQUEST);
    }

    const liveUpdated = await this.packageRepository.updateById(cr.packageId._id, cr.changes);
    await this.packageRepository.updateChangeRequestStatus(changeRequestId, PackageChangeRequestStatus.APPROVED, {
      reviewedBy: adminUser.id || adminUser._id,
      reviewedAt: new Date(),
    });

    await this.invalidatePublicCache();
    return { package: liveUpdated, changeRequestStatus: PackageChangeRequestStatus.APPROVED };
  }

  async rejectChangeRequest(changeRequestId, { rejectionReason }, adminUser) {
    const cr = await this.packageRepository.findChangeRequestById(changeRequestId);
    if (!cr) {
      throw new NotFoundError('Change request not found');
    }
    if (cr.status !== PackageChangeRequestStatus.PENDING) {
      throw new AppError('Change request is already processed', HttpStatus.BAD_REQUEST);
    }

    const updatedCr = await this.packageRepository.updateChangeRequestStatus(
      changeRequestId,
      PackageChangeRequestStatus.REJECTED,
      {
        rejectionReason,
        reviewedBy: adminUser.id || adminUser._id,
        reviewedAt: new Date(),
      },
    );

    return updatedCr;
  }

  async listPublic(query = {}) {
    const activeQuery = { ...query };

    if (activeQuery.categorySlug && !activeQuery.categoryId) {
      const cat = await this.categoryRepository.findBySlug(activeQuery.categorySlug);
      if (cat) {
        activeQuery.categoryId = cat._id.toString();
      } else {
        return { items: [], meta: buildPaginationMeta(0, parseListQuery(activeQuery)) };
      }
    }

    const pagination = parseListQuery(activeQuery, { defaultLimit: 10, maxLimit: 100 });
    const cacheKey = this.#publicListCacheKey(activeQuery);

    const memCached = publicLocalCache.getSync(cacheKey);
    if (memCached) return memCached;

    if (this.cacheService) {
      const cached = await this.getCached(cacheKey);
      if (cached) {
        publicLocalCache.setSync(cacheKey, cached, SERVICE_PUBLIC_CACHE_TTL_SECONDS);
        return cached;
      }
    }

    const res = await this.packageRepository.listPublicSlim(activeQuery, {
      skip: pagination.skip,
      limit: pagination.limit,
      sort: activeQuery.sort || 'displayOrder',
    });

    const result = {
      items: res.items || [],
      meta: buildPaginationMeta(res.total || 0, pagination),
    };

    if (cacheKey) {
      publicLocalCache.setSync(cacheKey, result, SERVICE_PUBLIC_CACHE_TTL_SECONDS);
      if (this.cacheService) {
        await this.setCached(cacheKey, result, SERVICE_PUBLIC_CACHE_TTL_SECONDS);
      }
    }

    return result;
  }

  async getPublicBySlug(slug) {
    const pkg = await this.packageRepository.findPublicBySlug(slug);
    if (!pkg) {
      throw new NotFoundError('Package not found');
    }
    return pkg;
  }

  async getPublicById(id) {
    const pkg = await this.packageRepository.findPublicById(id);
    if (!pkg) {
      throw new NotFoundError('Package not found');
    }
    return pkg;
  }

  async listAdmin(query = {}) {
    const pagination = parseListQuery(query);
    const { items, total } = await this.packageRepository.listAdmin(query, {
      skip: pagination.skip,
      limit: pagination.limit,
      sort: query.sort || '-createdAt',
    });

    return {
      items,
      meta: buildPaginationMeta(total, pagination),
    };
  }

  async listChangeRequests(query = {}) {
    const pagination = parseListQuery(query);
    const { items, total } = await this.packageRepository.listChangeRequests(query, {
      skip: pagination.skip,
      limit: pagination.limit,
    });

    return {
      items,
      meta: buildPaginationMeta(total, pagination),
    };
  }

  async softDelete(id, user) {
    const doc = await this.packageRepository.findById(id);
    if (!doc || doc.deletedAt) {
      throw new NotFoundError('Package not found');
    }

    await this.packageRepository.updateById(id, {
      deletedAt: new Date(),
      isActive: false,
    });
    await this.invalidatePublicCache();
    return { message: 'Package soft-deleted successfully' };
  }
}
