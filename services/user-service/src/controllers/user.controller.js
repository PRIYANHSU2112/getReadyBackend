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
    const user = await this.userService.findByEmailForAuth(req.body.email);
    return ApiResponse.success(res, user);
  };

  internalFindOrCreateMobile = async (req, res) => {
    const user = await this.userService.findOrCreateMobileUser(req.body);
    return ApiResponse.success(res, user);
  };

  internalUpdateLastLogin = async (req, res) => {
    const user = await this.userService.updateLastLogin(req.params.id, req.body);
    return ApiResponse.success(res, user);
  };

  internalSetPasswordByEmail = async (req, res) => {
    const user = await this.userService.setPasswordByEmail(req.body.email, req.body.newPassword);
    return ApiResponse.success(res, user);
  };
}
