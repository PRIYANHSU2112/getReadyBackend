import Joi from 'joi';
import { ValidationError } from '../errors/ValidationError.js';

export class BaseValidator {
  /**
   * @param {Record<string, Joi.Schema>} schemas
   */
  constructor(schemas = {}) {
    this.schemas = schemas;
  }

  /**
   * @param {string} schemaName
   * @param {unknown} payload
   * @param {Joi.ValidationOptions} [options]
   */
  validate(schemaName, payload, options = {}) {
    const schema = this.schemas[schemaName];
    if (!schema) {
      throw new ValidationError(`Unknown validation schema: ${schemaName}`);
    }

    const { error, value } = schema.validate(payload, {
      abortEarly: false,
      stripUnknown: true,
      ...options,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      throw new ValidationError('Validation failed', details);
    }

    return value;
  }

  static object(shape) {
    return Joi.object(shape);
  }

  static get Joi() {
    return Joi;
  }
}
