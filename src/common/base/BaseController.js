import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpStatus } from '../constants/http-status.js';

export class BaseController {
  /**
   * Bind handler methods so `this` is preserved when passed to Express.
   * @param {string[]} methods
   */
  bindMethods(methods) {
    methods.forEach((method) => {
      if (typeof this[method] === 'function') {
        this[method] = this[method].bind(this);
      }
    });
  }

  wrap(handler) {
    return asyncHandler(handler.bind(this));
  }

  ok(res, data, meta = null) {
    return ApiResponse.success(res, data, HttpStatus.OK, meta);
  }

  created(res, data, meta = null) {
    return ApiResponse.created(res, data, meta);
  }

  noContent(res) {
    return ApiResponse.noContent(res);
  }
}
