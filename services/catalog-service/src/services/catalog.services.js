import { AppError, HttpStatus, ErrorCodes } from '@getready/errors';
import { EVENT_TYPES } from '@getready/rabbitmq';
import { StorageService } from '@getready/storage';

export { StorageService };

export class CategoryService {
  constructor(categoryRepo, storageService, eventPublisher = null) {
    this.categoryRepo = categoryRepo;
    this.storageService = storageService;
    this.eventPublisher = eventPublisher;
  }

  async listPublic() {
    return this.categoryRepo.findActive();
  }

  async getPublicBySlug(slug) {
    const cat = await this.categoryRepo.findActiveBySlug(slug);
    if (!cat) throw new AppError('Category not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return cat;
  }

  async list(query = {}) {
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '10', 10), 100);
    const skip = (page - 1) * limit;
    const filter = {};
    if (query.isActive !== undefined) filter.isActive = query.isActive === 'true' || query.isActive === true;
    if (query.deleted === 'true') filter.deletedAt = { $ne: null };
    else filter.deletedAt = null;

    const { items, total } = await this.categoryRepo.findAndCount(filter, { skip, limit });
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const cat = await this.categoryRepo.findById(id);
    if (!cat) throw new AppError('Category not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return cat;
  }

  async create(data, file = null) {
    const slug = String(data.slug || data.name || '').trim().toLowerCase().replace(/\s+/g, '-');
    const existing = await this.categoryRepo.findBySlug(slug);
    if (existing) throw new AppError('Category slug already exists', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);

    let image = { url: null, publicId: null };
    if (file) {
      const up = await this.storageService.upload(file, 'categories');
      image = { url: up.url, publicId: up.key };
    }

    const cat = await this.categoryRepo.create({ ...data, slug, image });
    if (this.eventPublisher) {
      this.eventPublisher.publish('category.created', EVENT_TYPES.CATEGORY_CREATED, {
        categoryId: cat._id.toString(),
        name: cat.name,
        slug: cat.slug,
      }).catch(() => {});
    }
    return cat;
  }

  async update(id, data, file = null) {
    const payload = { ...data };
    if (file) {
      const up = await this.storageService.upload(file, 'categories');
      payload.image = { url: up.url, publicId: up.key };
    }
    const updated = await this.categoryRepo.updateById(id, payload);
    if (!updated) throw new AppError('Category not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    if (this.eventPublisher) {
      this.eventPublisher.publish('category.updated', EVENT_TYPES.CATEGORY_UPDATED, {
        categoryId: id,
        name: updated.name,
      }).catch(() => {});
    }
    return updated;
  }

  async remove(id) {
    await this.categoryRepo.deleteById(id);
    return true;
  }

  async restore(id) {
    return this.categoryRepo.restoreById(id);
  }

  async setStatus(id, isActive) {
    return this.categoryRepo.updateById(id, { isActive });
  }

  async reorder(items = []) {
    for (const item of items) {
      if (item.id && item.displayOrder !== undefined) {
        await this.categoryRepo.updateById(item.id, { displayOrder: item.displayOrder });
      }
    }
    return { reordered: true };
  }

  async bulkSetStatus(ids = [], isActive = true) {
    for (const id of ids) {
      await this.categoryRepo.updateById(id, { isActive });
    }
    return { updated: true };
  }

  async bulkDelete(ids = []) {
    for (const id of ids) {
      await this.categoryRepo.deleteById(id);
    }
    return { deleted: true };
  }
}

export class CatalogItemService {
  constructor(serviceRepo, changeRequestRepo, categoryRepo, storageService, eventPublisher = null) {
    this.serviceRepo = serviceRepo;
    this.changeRequestRepo = changeRequestRepo;
    this.categoryRepo = categoryRepo;
    this.storageService = storageService;
    this.eventPublisher = eventPublisher;
  }

  async listPublic() {
    return this.serviceRepo.findActive();
  }

  async listPublicByCategory(categoryId) {
    return this.serviceRepo.findActiveByCategory(categoryId);
  }

  async getPublicBySlug(slug) {
    const service = await this.serviceRepo.findActiveBySlug(slug);
    if (!service) throw new AppError('Service not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return service;
  }

  async list(query = {}) {
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '10', 10), 100);
    const skip = (page - 1) * limit;
    const filter = { deletedAt: null };
    if (query.categoryId) filter.categoryId = query.categoryId;
    if (query.status) filter.status = query.status;

    const { items, total } = await this.serviceRepo.findAndCount(filter, { skip, limit });
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getById(id) {
    const service = await this.serviceRepo.findById(id);
    if (!service) throw new AppError('Service not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return service;
  }

  async create(data, files = {}) {
    const slug = String(data.slug || data.name || '').trim().toLowerCase().replace(/\s+/g, '-');
    let thumbnail = { url: null, publicId: null };
    if (files.thumbnail && files.thumbnail[0]) {
      const up = await this.storageService.upload(files.thumbnail[0], 'services');
      thumbnail = { url: up.url, publicId: up.key };
    }

    const service = await this.serviceRepo.create({ ...data, slug, thumbnail });
    if (this.eventPublisher) {
      this.eventPublisher.publish('service.created', EVENT_TYPES.SERVICE_CREATED, {
        serviceId: service._id.toString(),
        name: service.name,
        price: service.price,
        categoryId: service.categoryId.toString(),
      }).catch(() => {});
    }
    return service;
  }

  async update(id, data, files = {}) {
    const payload = { ...data };
    if (files.thumbnail && files.thumbnail[0]) {
      const up = await this.storageService.upload(files.thumbnail[0], 'services');
      payload.thumbnail = { url: up.url, publicId: up.key };
    }
    const updated = await this.serviceRepo.updateById(id, payload);
    if (!updated) throw new AppError('Service not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    if (this.eventPublisher) {
      this.eventPublisher.publish('service.updated', EVENT_TYPES.SERVICE_UPDATED, {
        serviceId: id,
        name: updated.name,
        price: updated.price,
      }).catch(() => {});
    }
    return updated;
  }

  async remove(id) {
    await this.serviceRepo.deleteById(id);
    if (this.eventPublisher) {
      this.eventPublisher.publish('service.deleted', EVENT_TYPES.SERVICE_DELETED, {
        serviceId: id,
      }).catch(() => {});
    }
    return true;
  }

  async restore(id) {
    return this.serviceRepo.restoreById(id);
  }

  async setStatus(id, isActive) {
    return this.serviceRepo.updateById(id, { isActive });
  }

  async approveCreate(id) {
    return this.serviceRepo.updateById(id, { status: 'APPROVED' });
  }

  async rejectCreate(id, rejectionReason = '') {
    return this.serviceRepo.updateById(id, { status: 'REJECTED', rejectionReason });
  }

  // Change Requests
  async listChangeRequests(query = {}) {
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '10', 10), 100);
    const skip = (page - 1) * limit;
    const filter = {};
    if (query.status) filter.status = query.status;
    const { items, total } = await this.changeRequestRepo.findAndCount(filter, { skip, limit });
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getChangeRequestById(id) {
    const cr = await this.changeRequestRepo.findById(id);
    if (!cr) throw new AppError('Change request not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return cr;
  }

  async approveChangeRequest(id, adminUserId = null) {
    const cr = await this.getChangeRequestById(id);
    await this.serviceRepo.updateById(cr.serviceId._id, cr.changes);
    return this.changeRequestRepo.updateStatus(id, 'APPROVED', { reviewedBy: adminUserId, reviewedAt: new Date() });
  }

  async rejectChangeRequest(id, rejectionReason = '', adminUserId = null) {
    return this.changeRequestRepo.updateStatus(id, 'REJECTED', {
      rejectionReason,
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
    });
  }
}

export class PackageService {
  constructor(packageRepo, storageService, eventPublisher = null) {
    this.packageRepo = packageRepo;
    this.storageService = storageService;
    this.eventPublisher = eventPublisher;
  }

  async listPublic(query = {}) {
    if (query.categoryId) return this.packageRepo.findPublicByCategory(query.categoryId);
    return this.packageRepo.findPublic();
  }

  async getPublicBySlug(slug) {
    const pkg = await this.packageRepo.findPublicBySlug(slug);
    if (!pkg) throw new AppError('Package not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return pkg;
  }

  async getPublicById(id) {
    const pkg = await this.packageRepo.findPublicById(id);
    if (!pkg) throw new AppError('Package not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return pkg;
  }

  async listAdmin(query = {}) {
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '10', 10), 100);
    const skip = (page - 1) * limit;
    const filter = { deletedAt: null };
    const { items, total } = await this.packageRepo.findAndCount(filter, { skip, limit });
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async create(data, files = {}) {
    const slug = String(data.slug || data.name || '').trim().toLowerCase().replace(/\s+/g, '-');
    let thumbnail = { url: null, publicId: null };
    if (files.thumbnail && files.thumbnail[0]) {
      const up = await this.storageService.upload(files.thumbnail[0], 'packages');
      thumbnail = { url: up.url, publicId: up.key };
    }
    const pkg = await this.packageRepo.create({ ...data, slug, thumbnail });
    if (this.eventPublisher) {
      this.eventPublisher.publish('package.created', EVENT_TYPES.PACKAGE_CREATED, {
        packageId: pkg._id.toString(),
        name: pkg.name,
        price: pkg.price,
      }).catch(() => {});
    }
    return pkg;
  }

  async update(id, data, files = {}) {
    const payload = { ...data };
    if (files.thumbnail && files.thumbnail[0]) {
      const up = await this.storageService.upload(files.thumbnail[0], 'packages');
      payload.thumbnail = { url: up.url, publicId: up.key };
    }
    const updated = await this.packageRepo.updateById(id, payload);
    if (!updated) throw new AppError('Package not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return updated;
  }

  async approve(id) {
    return this.packageRepo.updateById(id, { status: 'APPROVED' });
  }

  async reject(id, rejectionReason = '') {
    return this.packageRepo.updateById(id, { status: 'REJECTED', rejectionReason });
  }

  async delete(id) {
    await this.packageRepo.deleteById(id);
    return true;
  }
}

export class FilterService {
  constructor(filterRepo) {
    this.filterRepo = filterRepo;
  }

  async listPublic() {
    const filters = await this.filterRepo.findActive();
    const result = await Promise.all(
      filters.map(async (f) => ({
        ...f,
        values: await this.filterRepo.findValuesByFilterId(f._id),
      })),
    );
    return result;
  }

  async list() {
    return this.filterRepo.findActive();
  }

  async getById(id) {
    const filter = await this.filterRepo.findById(id);
    if (!filter) throw new AppError('Filter not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return filter;
  }

  async create(data) {
    const slug = String(data.slug || data.name || '').trim().toLowerCase().replace(/\s+/g, '-');
    return this.filterRepo.create({ ...data, slug });
  }

  async update(id, data) {
    const updated = await this.filterRepo.updateById(id, data);
    if (!updated) throw new AppError('Filter not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return updated;
  }

  async remove(id) {
    await this.filterRepo.deleteById(id);
    return true;
  }

  async restore(id) {
    return this.filterRepo.restoreById(id);
  }

  // Values
  async listValues(filterId) {
    return this.filterRepo.findValuesByFilterId(filterId);
  }

  async createValue(filterId, data) {
    return this.filterRepo.createValue({ ...data, filterId });
  }

  async updateValue(valueId, data) {
    const updated = await this.filterRepo.updateValueById(valueId, data);
    if (!updated) throw new AppError('Filter value not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return updated;
  }

  async removeValue(valueId) {
    await this.filterRepo.deleteValueById(valueId);
    return true;
  }
}

export class HygieneKitService {
  constructor(hygieneKitRepo, storageService, eventPublisher = null) {
    this.hygieneKitRepo = hygieneKitRepo;
    this.storageService = storageService;
    this.eventPublisher = eventPublisher;
  }

  async getDefaultKit() {
    return this.hygieneKitRepo.findDefault();
  }

  async getActiveKits() {
    return this.hygieneKitRepo.findActive();
  }

  async getById(id) {
    const kit = await this.hygieneKitRepo.findById(id);
    if (!kit) throw new AppError('Hygiene kit not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return kit;
  }

  async list(query = {}) {
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '10', 10), 100);
    const skip = (page - 1) * limit;
    const filter = { deletedAt: null };
    const { items, total } = await this.hygieneKitRepo.findAndCount(filter, { skip, limit });
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async create(data, file = null) {
    let thumbnail = { url: null, publicId: null };
    if (file) {
      const up = await this.storageService.upload(file, 'hygiene-kits');
      thumbnail = { url: up.url, publicId: up.key };
    }
    const kit = await this.hygieneKitRepo.create({ ...data, thumbnail });
    if (this.eventPublisher) {
      this.eventPublisher.publish('hygiene_kit.updated', EVENT_TYPES.HYGIENE_KIT_UPDATED, {
        kitId: kit._id.toString(),
        title: kit.title,
        price: kit.price,
      }).catch(() => {});
    }
    return kit;
  }

  async update(id, data, file = null) {
    const payload = { ...data };
    if (file) {
      const up = await this.storageService.upload(file, 'hygiene-kits');
      payload.thumbnail = { url: up.url, publicId: up.key };
    }
    const updated = await this.hygieneKitRepo.updateById(id, payload);
    if (!updated) throw new AppError('Hygiene kit not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return updated;
  }

  async setDefault(id) {
    return this.hygieneKitRepo.setDefault(id);
  }

  async remove(id) {
    await this.hygieneKitRepo.deleteById(id);
    return true;
  }

  async restore(id) {
    return this.hygieneKitRepo.restoreById(id);
  }
}

export class CouponService {
  constructor(couponRepo, eventPublisher = null) {
    this.couponRepo = couponRepo;
    this.eventPublisher = eventPublisher;
  }

  async list(query = {}) {
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '25', 10), 100);
    const skip = (page - 1) * limit;

    const filter = { deletedAt: null };
    if (query.status && query.status !== 'all' && query.status !== 'ALL') {
      filter.status = query.status.toUpperCase();
    }
    if (query.search && query.search.trim()) {
      filter.code = new RegExp(query.search.trim(), 'i');
    }

    const { items, total } = await this.couponRepo.findAndCount(filter, { skip, limit });
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async getById(id) {
    const coupon = await this.couponRepo.findById(id);
    if (!coupon) throw new AppError('Coupon not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return coupon;
  }

  async create(data) {
    const code = String(data.code || data.name || '').trim().toUpperCase();
    if (!code) throw new AppError('Coupon code is required', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);

    const discountValue = Number(data.discountValue || data.discount || 0);
    const coupon = await this.couponRepo.create({
      ...data,
      code,
      name: data.name || code,
      discountValue: discountValue > 0 ? discountValue : 100,
      discountType: data.discountType || 'FLAT',
      minOrderValue: Number(data.minOrderValue || 0),
      status: (data.status || 'ACTIVE').toUpperCase(),
    });

    return coupon;
  }

  async update(id, data) {
    const payload = { ...data };
    if (payload.code) payload.code = payload.code.trim().toUpperCase();
    if (payload.discountValue) payload.discountValue = Number(payload.discountValue);
    if (payload.discount && !payload.discountValue) {
      const parsed = parseFloat(String(payload.discount).replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed)) payload.discountValue = parsed;
    }

    const updated = await this.couponRepo.updateById(id, payload);
    if (!updated) throw new AppError('Coupon not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return updated;
  }

  async remove(id) {
    await this.couponRepo.deleteById(id);
    return true;
  }

  async validateCoupon(code, orderAmount = 0) {
    const coupon = await this.couponRepo.findByCode(code);
    if (!coupon) {
      throw new AppError('Invalid coupon code', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }
    if (coupon.minOrderValue && orderAmount < coupon.minOrderValue) {
      throw new AppError(`Minimum order value of ₹${coupon.minOrderValue} required for this coupon`, HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
    return coupon;
  }
}
