import Joi from 'joi';

/**
 * Creates a Joi alternative that accepts a native target schema OR a JSON-encoded string.
 * It parses the string into a JS object/array and lets the target Joi schema validate the result.
 *
 * @param {Joi.Schema} targetSchema - The expected Joi schema (e.g. Joi.array().items(...), Joi.object())
 * @param {*} [defaultValue] - Optional default value if the string is empty
 */
export function joiParseJson(targetSchema, defaultValue = undefined) {
  return Joi.alternatives().try(
    targetSchema,
    Joi.string()
      .allow('', null)
      .custom((value, helpers) => {
        if (!value || !String(value).trim()) {
          return defaultValue;
        }

        let parsed;
        try {
          parsed = JSON.parse(value);
        } catch {
          // If JSON parse fails, check if string is comma-separated values for arrays
          const type = targetSchema.type;
          if (type === 'array') {
            parsed = String(value)
              .split(',')
              .map((s) => s.trim()) 
              .filter(Boolean);
          } else {
            return defaultValue !== undefined ? defaultValue : helpers.error('any.invalid');
          }
        }

        const { error, value: validated } = targetSchema.validate(parsed);
        if (error) {
          return helpers.message(error.message);
        }
        return validated;
      }, 'JSON String Pre-parser'),
  );
}

/**
 * Reusable helper for JSON array fields (badges, tags, inclusions, package items).
 * Accepts native arrays, JSON array strings, or comma-separated strings.
 *
 * @param {Joi.Schema} itemSchema - Schema for individual array items
 * @param {number} [maxItems=100] - Max array length
 */
export function joiJsonArray(itemSchema, maxItems = 100) {
  const arraySchema = Joi.array().items(itemSchema).max(maxItems);
  return joiParseJson(arraySchema, []);
}

/**
 * Reusable helper for JSON object fields (metadata, custom key-values).
 * Accepts native objects or JSON object strings.
 *
 * @param {Joi.Schema} [objectSchema] - Object schema definition
 */
export function joiJsonObject(objectSchema = Joi.object().unknown(true)) {
  return joiParseJson(objectSchema, {});
}
