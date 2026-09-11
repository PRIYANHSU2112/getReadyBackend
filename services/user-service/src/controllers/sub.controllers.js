import { ApiResponse } from '@getready/errors';

export class AddressController {
  constructor(addressService) {
    this.addressService = addressService;
  }

  list = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const items = await this.addressService.listForUser(userId);
    return ApiResponse.success(res, items, 'Addresses fetched successfully');
  };

  getById = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const address = await this.addressService.getById(req.params.id, userId);
    return ApiResponse.success(res, address, 'Address fetched successfully');
  };

  create = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const address = await this.addressService.create(userId, req.body);
    return ApiResponse.created(res, address, 'Address created successfully');
  };

  update = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const address = await this.addressService.update(req.params.id, userId, req.body);
    return ApiResponse.success(res, address, 'Address updated successfully');
  };

  remove = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    await this.addressService.remove(req.params.id, userId);
    return ApiResponse.success(res, { id: req.params.id }, 'Address deleted successfully');
  };

  setDefault = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const address = await this.addressService.setDefault(req.params.id, userId);
    return ApiResponse.success(res, address, 'Default address set successfully');
  };
}

export class MemberController {
  constructor(memberService) {
    this.memberService = memberService;
  }

  list = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const result = await this.memberService.listForUser(userId, req.query);
    if (result && result.items) {
      return ApiResponse.paginated(res, result.items, result.meta, 'Members fetched successfully');
    }
    return ApiResponse.success(res, result, 'Members fetched successfully');
  };

  listForAccountOwner = async (req, res) => {
    const ownerId = req.params.userId || req.params.id;
    const items = await this.memberService.listForUser(ownerId);
    return ApiResponse.success(res, items, 'Customer profiles fetched successfully');
  };

  getById = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const member = await this.memberService.getById(req.params.id, userId);
    return ApiResponse.success(res, member, 'Member fetched successfully');
  };

  create = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const member = await this.memberService.create(userId, req.body);
    return ApiResponse.created(res, member, 'Member created successfully');
  };

  update = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const member = await this.memberService.update(req.params.id, userId, req.body);
    return ApiResponse.success(res, member, 'Member updated successfully');
  };

  remove = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    await this.memberService.remove(req.params.id, userId);
    return ApiResponse.success(res, { id: req.params.id }, 'Member deleted successfully');
  };

  getBeautyPassport = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const passport = await this.memberService.getBeautyPassport(req.params.id, userId);
    return ApiResponse.success(res, passport, 'Beauty Passport fetched successfully');
  };

  addBeautyPassportEntry = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const passport = await this.memberService.addBeautyPassportEntry(req.params.id, userId, req.body);
    return ApiResponse.success(res, passport, 'Beauty Passport updated successfully');
  };
}

export class RbacController {
  constructor(rbacService) {
    this.rbacService = rbacService;
  }

  listRoles = async (req, res) => {
    const result = await this.rbacService.listRoles(req.query);
    return ApiResponse.success(res, result.items, 'Roles fetched successfully');
  };

  getRoleById = async (req, res) => {
    const role = await this.rbacService.getRoleById(req.params.id);
    return ApiResponse.success(res, role, 'Role fetched successfully');
  };

  createRole = async (req, res) => {
    const role = await this.rbacService.createRole(req.body);
    return ApiResponse.created(res, role, 'Role created successfully');
  };

  updateRole = async (req, res) => {
    const role = await this.rbacService.updateRole(req.params.id, req.body);
    return ApiResponse.success(res, role, 'Role updated successfully');
  };

  deleteRole = async (req, res) => {
    await this.rbacService.deleteRole(req.params.id);
    return ApiResponse.success(res, { id: req.params.id }, 'Role deleted successfully');
  };

  listPermissions = async (req, res) => {
    const result = await this.rbacService.listPermissions(req.query);
    return ApiResponse.success(res, result.items, 'Permissions fetched successfully');
  };

  syncPermissions = async (_req, res) => {
    await this.rbacService.seedDefaults();
    return ApiResponse.success(res, { synced: true }, 'Permissions synced successfully');
  };
}
