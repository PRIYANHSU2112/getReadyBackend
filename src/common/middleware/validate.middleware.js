import { asyncHandler } from '../utils/asyncHandler.js';
import { ValidationError } from '../errors/ValidationError.js';

/**
 * @param {import('../base/BaseValidator.js').BaseValidator} validator
 * @param {string} schemaName
 * @param {'body'|'query'|'params'} [source]
 */
export function validate(validator, schemaName, source = 'body') {
  return asyncHandler(async (req, _res, next) => {
    try {
      const value = validator.validate(schemaName, req[source]);
      req[source] = value;
      next();
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new ValidationError(err.message);
    }
  });
}
