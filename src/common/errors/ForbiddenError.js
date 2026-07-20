import { AppError } from './AppError.js';
import { HttpStatus } from '../constants/http-status.js';
import { ErrorCodes } from '../constants/error-codes.js';

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details = null) {
    super(message, HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, true, details);
  }
}
