import { AppError } from './AppError.js';
import { HttpStatus } from '../constants/http-status.js';
import { ErrorCodes } from '../constants/error-codes.js';

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, HttpStatus.UNPROCESSABLE, ErrorCodes.VALIDATION_ERROR, true, details);
  }
}
