import { ApiResponse, HttpStatus } from '@getready/errors';

export class CategoryController {
  constructor(categoryService) {
    this.categoryService = categoryService;
  }

  listPublic = async (_req, res) => {
    const items = await this.categoryService.listPublic();
    return ApiResponse.success(res, items, 'Categories fetched successfully');
  };

  getPublicBySlug = async (req, res) => {
    const item = await this.categoryService.getPublicBySlug(req.params.slug);
    return ApiResponse.success(res, item, 'Category fetched successfully');
  };

  list = async (req, res) => {
    const result = await this.categoryService.list(req.query);
    return ApiResponse.paginated(res, result.items, result.meta, 'Categories fetched successfully');
  };

  getById = async (req, res) => {
    const item = await this.categoryService.getById(req.params.id);
    return ApiResponse.success(res, item, 'Category fetched successfully');
  };

  create = async (req, res) => {
    const item = await this.categoryService.create(req.body, req.file);
    return ApiResponse.created(res, item, 'Category created successfully');
  };

  update = async (req, res) => {
    const item = await this.categoryService.update(req.params.id, req.body, req.file);
    return ApiResponse.success(res, item, 'Category updated successfully');
  };

  remove = async (req, res) => {
    await this.categoryService.remove(req.params.id);
    return ApiResponse.success(res, { id: req.params.id }, 'Category deleted successfully');
  };

  restore = async (req, res) => {
    const item = await this.categoryService.restore(req.params.id);
    return ApiResponse.success(res, item, 'Category restored successfully');
  };

  setStatus = async (req, res) => {
    const item = await this.categoryService.setStatus(req.params.id, req.body.isActive);
    return ApiResponse.success(res, item, 'Category status updated successfully');
  };

  reorder = async (req, res) => {
    const result = await this.categoryService.reorder(req.body.items || []);
    return ApiResponse.success(res, result, 'Categories reordered successfully');
  };

  bulkSetStatus = async (req, res) => {
    const result = await this.categoryService.bulkSetStatus(req.body.ids || [], req.body.isActive);
    return ApiResponse.success(res, result, 'Categories updated successfully');
  };

  bulkDelete = async (req, res) => {
    const result = await this.categoryService.bulkDelete(req.body.ids || []);
    return ApiResponse.success(res, result, 'Categories deleted successfully');
  };
}

export class ServiceController {
  constructor(catalogItemService) {
    this.catalogItemService = catalogItemService;
  }

  listPublic = async (_req, res) => {
    const items = await this.catalogItemService.listPublic();
    return ApiResponse.success(res, items, 'Services fetched successfully');
  };

  listPublicByCategory = async (req, res) => {
    const items = await this.catalogItemService.listPublicByCategory(req.params.categoryId);
    return ApiResponse.success(res, items, 'Category services fetched successfully');
  };

  getPublicBySlug = async (req, res) => {
    const item = await this.catalogItemService.getPublicBySlug(req.params.slug);
    return ApiResponse.success(res, item, 'Service fetched successfully');
  };

  list = async (req, res) => {
    const result = await this.catalogItemService.list(req.query);
    return ApiResponse.paginated(res, result.items, result.meta, 'Services fetched successfully');
  };

  getById = async (req, res) => {
    const item = await this.catalogItemService.getById(req.params.id);
    return ApiResponse.success(res, item, 'Service fetched successfully');
  };

  create = async (req, res) => {
    const item = await this.catalogItemService.create(req.body, req.files || {});
    return ApiResponse.created(res, item, 'Service created successfully');
  };

  update = async (req, res) => {
    const item = await this.catalogItemService.update(req.params.id, req.body, req.files || {});
    return ApiResponse.success(res, item, 'Service updated successfully');
  };

  remove = async (req, res) => {
    await this.catalogItemService.remove(req.params.id);
    return ApiResponse.success(res, { id: req.params.id }, 'Service deleted successfully');
  };

  restore = async (req, res) => {
    const item = await this.catalogItemService.restore(req.params.id);
    return ApiResponse.success(res, item, 'Service restored successfully');
  };

  setStatus = async (req, res) => {
    const item = await this.catalogItemService.setStatus(req.params.id, req.body.isActive);
    return ApiResponse.success(res, item, 'Service status updated successfully');
  };

  approveCreate = async (req, res) => {
    const item = await this.catalogItemService.approveCreate(req.params.id);
    return ApiResponse.success(res, item, 'Service approved successfully');
  };

  rejectCreate = async (req, res) => {
    const item = await this.catalogItemService.rejectCreate(req.params.id, req.body.rejectionReason);
    return ApiResponse.success(res, item, 'Service rejected successfully');
  };

  // Change Requests
  listChangeRequests = async (req, res) => {
    const result = await this.catalogItemService.listChangeRequests(req.query);
    return ApiResponse.paginated(res, result.items, result.meta, 'Change requests fetched successfully');
  };

  getChangeRequestById = async (req, res) => {
    const item = await this.catalogItemService.getChangeRequestById(req.params.id);
    return ApiResponse.success(res, item, 'Change request fetched successfully');
  };

  approveChangeRequest = async (req, res) => {
    const adminId = req.headers['x-user-id'] || req.user?.id;
    const item = await this.catalogItemService.approveChangeRequest(req.params.id, adminId);
    return ApiResponse.success(res, item, 'Change request approved successfully');
  };

  rejectChangeRequest = async (req, res) => {
    const adminId = req.headers['x-user-id'] || req.user?.id;
    const item = await this.catalogItemService.rejectChangeRequest(req.params.id, req.body.rejectionReason, adminId);
    return ApiResponse.success(res, item, 'Change request rejected successfully');
  };
}

export class PackageController {
  constructor(packageService) {
    this.packageService = packageService;
  }

  listPublic = async (req, res) => {
    const items = await this.packageService.listPublic(req.query);
    return ApiResponse.success(res, items, 'Packages fetched successfully');
  };

  getPublicBySlug = async (req, res) => {
    const item = await this.packageService.getPublicBySlug(req.params.slug);
    return ApiResponse.success(res, item, 'Package fetched successfully');
  };

  getPublicById = async (req, res) => {
    const item = await this.packageService.getPublicById(req.params.id);
    return ApiResponse.success(res, item, 'Package fetched successfully');
  };

  listAdmin = async (req, res) => {
    const result = await this.packageService.listAdmin(req.query);
    return ApiResponse.paginated(res, result.items, result.meta, 'Packages fetched successfully');
  };

  create = async (req, res) => {
    const item = await this.packageService.create(req.body, req.files || {});
    return ApiResponse.created(res, item, 'Package created successfully');
  };

  update = async (req, res) => {
    const item = await this.packageService.update(req.params.id, req.body, req.files || {});
    return ApiResponse.success(res, item, 'Package updated successfully');
  };

  approve = async (req, res) => {
    const item = await this.packageService.approve(req.params.id);
    return ApiResponse.success(res, item, 'Package approved successfully');
  };

  reject = async (req, res) => {
    const item = await this.packageService.reject(req.params.id, req.body.rejectionReason);
    return ApiResponse.success(res, item, 'Package rejected successfully');
  };

  delete = async (req, res) => {
    await this.packageService.delete(req.params.id);
    return ApiResponse.success(res, { id: req.params.id }, 'Package deleted successfully');
  };
}

export class FilterController {
  constructor(filterService) {
    this.filterService = filterService;
  }

  listPublic = async (_req, res) => {
    const items = await this.filterService.listPublic();
    return ApiResponse.success(res, items, 'Public filters fetched successfully');
  };

  list = async (_req, res) => {
    const items = await this.filterService.list();
    return ApiResponse.success(res, items, 'Filters fetched successfully');
  };

  getById = async (req, res) => {
    const item = await this.filterService.getById(req.params.id);
    return ApiResponse.success(res, item, 'Filter fetched successfully');
  };

  create = async (req, res) => {
    const item = await this.filterService.create(req.body);
    return ApiResponse.created(res, item, 'Filter created successfully');
  };

  update = async (req, res) => {
    const item = await this.filterService.update(req.params.id, req.body);
    return ApiResponse.success(res, item, 'Filter updated successfully');
  };

  remove = async (req, res) => {
    await this.filterService.remove(req.params.id);
    return ApiResponse.success(res, { id: req.params.id }, 'Filter deleted successfully');
  };

  restore = async (req, res) => {
    const item = await this.filterService.restore(req.params.id);
    return ApiResponse.success(res, item, 'Filter restored successfully');
  };

  listValues = async (req, res) => {
    const items = await this.filterService.listValues(req.params.filterId);
    return ApiResponse.success(res, items, 'Filter values fetched successfully');
  };

  createValue = async (req, res) => {
    const item = await this.filterService.createValue(req.params.filterId, req.body);
    return ApiResponse.created(res, item, 'Filter value created successfully');
  };

  updateValue = async (req, res) => {
    const item = await this.filterService.updateValue(req.params.valueId, req.body);
    return ApiResponse.success(res, item, 'Filter value updated successfully');
  };

  removeValue = async (req, res) => {
    await this.filterService.removeValue(req.params.valueId);
    return ApiResponse.success(res, { id: req.params.valueId }, 'Filter value deleted successfully');
  };
}

export class HygieneKitController {
  constructor(hygieneKitService) {
    this.hygieneKitService = hygieneKitService;
  }

  getDefault = async (_req, res) => {
    const item = await this.hygieneKitService.getDefaultKit();
    return ApiResponse.success(res, item, 'Default hygiene kit fetched successfully');
  };

  getActive = async (_req, res) => {
    const items = await this.hygieneKitService.getActiveKits();
    return ApiResponse.success(res, items, 'Active hygiene kits fetched successfully');
  };

  getById = async (req, res) => {
    const item = await this.hygieneKitService.getById(req.params.id);
    return ApiResponse.success(res, item, 'Hygiene kit fetched successfully');
  };

  list = async (req, res) => {
    const result = await this.hygieneKitService.list(req.query);
    return ApiResponse.paginated(res, result.items, result.meta, 'Hygiene kits fetched successfully');
  };

  create = async (req, res) => {
    const item = await this.hygieneKitService.create(req.body, req.file);
    return ApiResponse.created(res, item, 'Hygiene kit created successfully');
  };

  update = async (req, res) => {
    const item = await this.hygieneKitService.update(req.params.id, req.body, req.file);
    return ApiResponse.success(res, item, 'Hygiene kit updated successfully');
  };

  setDefault = async (req, res) => {
    const item = await this.hygieneKitService.setDefault(req.params.id);
    return ApiResponse.success(res, item, 'Default hygiene kit set successfully');
  };

  remove = async (req, res) => {
    await this.hygieneKitService.remove(req.params.id);
    return ApiResponse.success(res, { id: req.params.id }, 'Hygiene kit deleted successfully');
  };

  restore = async (req, res) => {
    const item = await this.hygieneKitService.restore(req.params.id);
    return ApiResponse.success(res, item, 'Hygiene kit restored successfully');
  };
}

export class CouponController {
  constructor(couponService) {
    this.couponService = couponService;
  }

  list = async (req, res) => {
    const result = await this.couponService.list(req.query);
    return ApiResponse.paginated(res, result.items, result.meta, 'Coupons fetched successfully');
  };

  getById = async (req, res) => {
    const item = await this.couponService.getById(req.params.id);
    return ApiResponse.success(res, item, 'Coupon fetched successfully');
  };

  create = async (req, res) => {
    const item = await this.couponService.create(req.body);
    return ApiResponse.created(res, item, 'Coupon created successfully');
  };

  update = async (req, res) => {
    const item = await this.couponService.update(req.params.id, req.body);
    return ApiResponse.success(res, item, 'Coupon updated successfully');
  };

  remove = async (req, res) => {
    await this.couponService.remove(req.params.id);
    return ApiResponse.success(res, { id: req.params.id }, 'Coupon deleted successfully');
  };

  validate = async (req, res) => {
    const { code, amount } = req.body;
    const item = await this.couponService.validateCoupon(code, amount);
    return ApiResponse.success(res, item, 'Coupon is valid');
  };
}
