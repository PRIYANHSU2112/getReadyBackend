import { AppError } from './AppError.js';
import { HttpStatus } from '../constants/http-status.js';
import { ErrorCodes } from '../constants/error-codes.js';

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details = null) {
    super(message, HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED, true, details);
  }
}
