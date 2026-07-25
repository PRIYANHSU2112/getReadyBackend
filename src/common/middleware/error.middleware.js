import { AppError } from '../errors/AppError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { HttpStatus } from '../constants/http-status.js';
import { ErrorCodes } from '../constants/error-codes.js';

/**
 * @param {import('pino').Logger} logger
 * @param {boolean} isProduction
 */
export function createErrorMiddleware(logger, isProduction = false) {
  return (err, req, res, _next) => {
    const requestId = req.requestId;

    if (err.name === 'ValidationError' && err.isJoi) {
      logger.warn({ err, requestId }, 'Joi validation error');
      return ApiResponse.error(
        res,
        'Validation failed',
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.VALIDATION_ERROR,
        err.details,
      );
    }

    // express.json() parse failures (trailing commas, single quotes, etc.)
    if (
      err instanceof SyntaxError ||
      err.type === 'entity.parse.failed' ||
      (err.status === 400 && typeof err.body === 'string')
    ) {
      logger.warn({ err: { message: err.message }, requestId }, 'Invalid JSON body');
      return ApiResponse.error(
        res,
        'Invalid JSON body. Use double quotes and no trailing commas.',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.BAD_REQUEST,
        { reason: err.message },
      );
    }

    if (err.name === 'CastError') {
      return ApiResponse.error(res, 'Invalid resource id', HttpStatus.BAD_REQUEST, ErrorCodes.BAD_REQUEST);
    }

    if (err.code === 11000) {
      const fields = Object.keys(err.keyPattern || err.keyValue || {});
      const field = fields[0];
      const value = field && err.keyValue ? err.keyValue[field] : undefined;
      const message = field
        ? value != null
          ? `${field} already exists: ${value}`
          : `${field} already exists`
        : 'Duplicate key';
      return ApiResponse.error(res, message, HttpStatus.CONFLICT, ErrorCodes.CONFLICT, {
        fields,
        keyValue: err.keyValue || null,
      });
    }

    if (err.name === 'MulterError') {
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5MB)' : err.message;
      return ApiResponse.error(res, message, HttpStatus.BAD_REQUEST, ErrorCodes.BAD_REQUEST);
    }

    if (err instanceof AppError) {
      if (!err.isOperational) {
        logger.error({ err, requestId }, 'Non-operational error');
      } else {
        logger.warn({ err: { message: err.message, code: err.code }, requestId }, err.message);
      }

      // Always return validation field details (safe for clients)
      const details =
        err.code === ErrorCodes.VALIDATION_ERROR || !isProduction ? err.details : undefined;

      return ApiResponse.error(
        res,
        err.message,
        err.statusCode,
        err.code,
        details,
      );
    }

    logger.error({ err, requestId }, 'Unhandled error');
    return ApiResponse.error(
      res,
      isProduction ? 'Internal server error' : err.message || 'Internal server error',
      HttpStatus.INTERNAL_ERROR,
      ErrorCodes.INTERNAL_ERROR,
    );
  };
}

export function notFoundHandler(req, res) {
  return ApiResponse.error(
    res,
    `Route ${req.method} ${req.originalUrl} not found`,
    HttpStatus.NOT_FOUND,
    ErrorCodes.NOT_FOUND,
  );
}
