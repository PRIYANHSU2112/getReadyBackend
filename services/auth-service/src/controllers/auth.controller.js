import { ApiResponse, HttpStatus } from '@getready/errors';

export class AuthController {
  /**
   * @param {import('../services/auth.service.js').AuthService} authService
   */
  constructor(authService) {
    this.authService = authService;
  }

  #getRequestInfo(req) {
    return {
      createdByIp: req.ip || req.headers['x-forwarded-for'] || null,
      userAgent: req.headers['user-agent'] || null,
    };
  }

  adminLogin = async (req, res, next) => {
    try {
      const result = await this.authService.adminLogin(req.body, this.#getRequestInfo(req));
      return ApiResponse.success(res, result, 'Login successful', HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  };

  adminForgotPassword = async (req, res, next) => {
    try {
      const result = await this.authService.adminForgotPassword(req.body);
      return ApiResponse.success(res, result, result.message, HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  };

  adminResetPassword = async (req, res, next) => {
    try {
      const result = await this.authService.adminResetPassword(req.body);
      return ApiResponse.success(res, result, result.message, HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  };

  mobileSendOtp = async (req, res, next) => {
    try {
      const result = await this.authService.mobileSendOtp(req.body);
      return ApiResponse.success(res, result, result.message, HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  };

  mobileResendOtp = async (req, res, next) => {
    try {
      const result = await this.authService.mobileResendOtp(req.body);
      return ApiResponse.success(res, result, result.message, HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  };

  mobileVerifyOtp = async (req, res, next) => {
    try {
      const result = await this.authService.mobileVerifyOtp(req.body, this.#getRequestInfo(req));
      return ApiResponse.success(res, result, 'OTP verified successfully', HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  };

  refreshToken = async (req, res, next) => {
    try {
      const result = await this.authService.refreshToken({
        ...req.body,
        ...this.#getRequestInfo(req),
      });
      return ApiResponse.success(res, result, 'Token refreshed successfully', HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  };

  logout = async (req, res, next) => {
    try {
      const userId = req.headers['x-user-id'] || req.user?.id;
      const result = await this.authService.logout({
        userId,
        refreshToken: req.body?.refreshToken,
      });
      return ApiResponse.success(res, result, result.message, HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  };

  getMe = async (req, res, next) => {
    try {
      const userId = req.headers['x-user-id'] || req.user?.id;
      if (!userId) {
        return ApiResponse.error(res, 'Unauthorized', HttpStatus.UNAUTHORIZED);
      }
      const user = await this.authService.getMe(userId);
      return ApiResponse.success(res, user, 'Profile fetched successfully', HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  };
}
