import { HttpStatus } from './HttpStatus.js';

export class ApiResponse {
  /**
   * Success response format
   */
  static success(res, data = null, message = 'Success', statusCode = HttpStatus.OK, meta = null) {
    const payload = {
      success: true,
      message,
      data,
    };
    if (meta) {
      payload.meta = meta;
    }
    return res.status(statusCode).json(payload);
  }

  /**
   * Created response format
   */
  static created(res, data = null, message = 'Resource created successfully') {
    return this.success(res, data, message, HttpStatus.CREATED);
  }

  /**
   * Paginated response format
   */
  static paginated(res, items = [], meta = {}, message = 'Fetched successfully') {
    return res.status(HttpStatus.OK).json({
      success: true,
      message,
      data: items,
      meta,
    });
  }

  /**
   * Standard error response format
   */
  static error(res, message = 'An error occurred', statusCode = HttpStatus.INTERNAL_SERVER_ERROR, code = 'INTERNAL_ERROR', details = null, requestId = null) {
    const errorPayload = {
      code,
      message,
    };
    if (details) {
      errorPayload.details = details;
    }
    if (requestId) {
      errorPayload.requestId = requestId;
    }
    return res.status(statusCode).json({
      success: false,
      error: errorPayload,
    });
  }
}
