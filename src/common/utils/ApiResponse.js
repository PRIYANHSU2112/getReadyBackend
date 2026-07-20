import { HttpStatus } from '../constants/http-status.js';

export class ApiResponse {
  static success(res, data = null, statusCode = HttpStatus.OK, meta = null) {
    const body = { success: true, data };
    if (meta) body.meta = meta;
    return res.status(statusCode).json(body);
  }

  static created(res, data = null, meta = null) {
    return ApiResponse.success(res, data, HttpStatus.CREATED, meta);
  }

  static noContent(res) {
    return res.status(HttpStatus.NO_CONTENT).send();
  }

  static error(res, message, statusCode = HttpStatus.INTERNAL_ERROR, code = 'INTERNAL_ERROR', details = null) {
    const body = {
      success: false,
      error: { code, message },
    };
    if (details) body.error.details = details;
    return res.status(statusCode).json(body);
  }
}
