import Joi from 'joi';
import { ValidationError } from '@getready/errors';

export { Joi };

/**
 * Express middleware for validating request body, query, or params with Joi schemas.
 * @param {object} validatorObject - Object holding Joi schemas or Joi schema directly
 * @param {string} schemaName - Property name on validatorObject, or null if schema directly passed
 * @param {'body'|'query'|'params'} [target='body']
 */
export function validate(validatorObject, schemaName, target = 'body') {
  return (req, _res, next) => {
    let schema = schemaName ? validatorObject[schemaName] : validatorObject;
    if (!schema) {
      return next();
    }

    // In case schema is a function returning Joi schema
    if (typeof schema === 'function' && !schema.isJoi) {
      schema = schema(req);
    }

    const data = req[target] || {};
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message.replace(/['"]/g, ''),
        type: d.type,
      }));
      return next(new ValidationError('Validation failed', details));
    }

    req[target] = value;
    return next();
  };
}

export default validate;
