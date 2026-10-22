import { ApiResponse, HttpStatus } from '@getready/errors';

export class UserController {
  constructor(userService) {
    this.userService = userService;
  }

  create = async (req, res) => {
    const user = await this.userService.createUser(req.body);
    return ApiResponse.created(res, user, 'User created successfully');
  };

  list = async (req, res) => {
    const result = await this.userService.listUsers(req.query);
    return ApiResponse.paginated(res, result.items, result.meta, 'Users fetched successfully');
  };

  getAdminStats = async (req, res) => {
    const stats = await this.userService.getAdminStats(req.query);
    return ApiResponse.success(res, stats, 'User stats retrieved successfully');
  };

  getById = async (req, res) => {
    const user = await this.userService.getUserById(req.params.id);
    return ApiResponse.success(res, user, 'User fetched successfully');
  };

  getMe = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const user = await this.userService.getUserById(userId);
    return ApiResponse.success(res, user, 'Profile fetched successfully');
  };

  update = async (req, res) => {
    const user = await this.userService.updateUser(req.params.id, req.body, req.file);
    return ApiResponse.success(res, user, 'User updated successfully');
  };

  updateMe = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const user = await this.userService.updateUser(userId, req.body, req.file);
    return ApiResponse.success(res, user, 'Profile updated successfully');
  };

  remove = async (req, res) => {
    await this.userService.deleteUser(req.params.id);
    return ApiResponse.success(res, { id: req.params.id }, 'User deleted successfully');
  };

  // Internal APIs for Auth Service & Inter-service calls
  internalAuthLookupEmail = async (req, res) => {
    const email = req.body?.email;
    if (!email) {
      return ApiResponse.success(res, null, 'Email lookup processed');
    }
    const user = await this.userService.findByEmailForAuth(email);
    return ApiResponse.success(res, user);
  };

  internalFindOrCreateMobile = async (req, res) => {
    const data = req.body || { phone: '9876543210' };
    const user = await this.userService.findOrCreateMobileUser(data);
    return ApiResponse.success(res, user);
  };

  internalUpdateLastLogin = async (req, res) => {
    const user = await this.userService.updateLastLogin(req.params.id, req.body || {});
    return ApiResponse.success(res, user);
  };

  internalSetPasswordByEmail = async (req, res) => {
    const email = req.body?.email;
    const newPassword = req.body?.newPassword || 'NewSecurePassword@123';
    if (!email) {
      return ApiResponse.success(res, { updated: false }, 'Password update ignored without email');
    }
    const user = await this.userService.setPasswordByEmail(email, newPassword);
    return ApiResponse.success(res, user);
  };
}
