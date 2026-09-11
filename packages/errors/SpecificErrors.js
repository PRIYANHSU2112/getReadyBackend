import { AppError } from './AppError.js';
import { HttpStatus } from './HttpStatus.js';
import { ErrorCodes } from './ErrorCodes.js';

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
      ErrorCodes.VALIDATION_ERROR,
      true,
      details,
    );
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = ErrorCodes.NOT_FOUND) {
    super(message, HttpStatus.NOT_FOUND, code, true);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access', code = ErrorCodes.UNAUTHORIZED) {
    super(message, HttpStatus.UNAUTHORIZED, code, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', code = ErrorCodes.FORBIDDEN) {
    super(message, HttpStatus.FORBIDDEN, code, true);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', code = ErrorCodes.CONFLICT) {
    super(message, HttpStatus.CONFLICT, code, true);
  }
}
