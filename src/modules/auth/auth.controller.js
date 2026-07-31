import { BaseController } from '../../common/base/BaseController.js';

export class AuthController extends BaseController {
  /**
   * @param {import('./auth.service.js').AuthService} authService
   */
  constructor(authService) {
    super();
    this.authService = authService;
    this.bindMethods([
      'adminLogin',
      'adminForgotPassword',
      'adminResetPassword',
      'mobileSendOtp',
      'mobileResendOtp',
      'mobileVerifyOtp',
      'refreshToken',
      'logout',
      'me',
    ]);
  }

  async adminLogin(req, res) {
    const reqInfo = { createdByIp: req.ip, userAgent: req.get('user-agent') };
    const result = await this.authService.adminLogin(req.body, reqInfo);
    return this.ok(res, result);
  }

  async adminForgotPassword(req, res) {
    const result = await this.authService.adminForgotPassword(req.body);
    return this.ok(res, result);
  }

  async adminResetPassword(req, res) {
    const result = await this.authService.adminResetPassword(req.body);
    return this.ok(res, result);
  }

  async mobileSendOtp(req, res) {
    const result = await this.authService.mobileSendOtp(req.body);
    return this.ok(res, result);
  }

  async mobileResendOtp(req, res) {
    const result = await this.authService.mobileResendOtp(req.body);
    return this.ok(res, result);
  }

  async mobileVerifyOtp(req, res) {
    const reqInfo = { createdByIp: req.ip, userAgent: req.get('user-agent') };
    const result = await this.authService.mobileVerifyOtp(req.body, reqInfo);
    return this.ok(res, result);
  }

  async refreshToken(req, res) {
    const reqInfo = { createdByIp: req.ip, userAgent: req.get('user-agent') };
    const result = await this.authService.refreshToken({
      refreshToken: req.body.refreshToken,
      ...reqInfo,
    });
    return this.ok(res, result);
  }

  async logout(req, res) {
    const userId = req.user?.id || req.user?.sub;
    const refreshToken = req.body?.refreshToken;
    const result = await this.authService.logout({ userId, refreshToken });
    return this.ok(res, result);
  }

  async me(req, res) {
    const user = await this.authService.getMe(req.user.id);
    return this.ok(res, user);
  }
}
