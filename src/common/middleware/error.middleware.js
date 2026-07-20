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

    if (err.name === 'CastError') {
      return ApiResponse.error(res, 'Invalid resource id', HttpStatus.BAD_REQUEST, ErrorCodes.BAD_REQUEST);
    }

    if (err.code === 11000) {
      return ApiResponse.error(res, 'Duplicate key', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
    }

    if (err instanceof AppError) {
      if (!err.isOperational) {
        logger.error({ err, requestId }, 'Non-operational error');
      } else {
        logger.warn({ err: { message: err.message, code: err.code }, requestId }, err.message);
      }

      return ApiResponse.error(
        res,
        err.message,
        err.statusCode,
        err.code,
        isProduction ? undefined : err.details,
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
