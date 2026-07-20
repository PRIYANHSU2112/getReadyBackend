import { HttpStatus } from '../constants/http-status.js';
import { ErrorCodes } from '../constants/error-codes.js';

export class AppError extends Error {
  constructor(
    message,
    statusCode = HttpStatus.INTERNAL_ERROR,
    code = ErrorCodes.INTERNAL_ERROR,
    isOperational = true,
    details = null,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}
