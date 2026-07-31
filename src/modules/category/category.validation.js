import { BaseValidator } from '../../common/base/BaseValidator.js';
import {
  DEFAULT_CATEGORY_SORT,
  MAX_CATEGORY_NAME_LENGTH,
  MAX_CATEGORY_SLUG_LENGTH,
  MAX_CATEGORY_DESCRIPTION_LENGTH,
} from '../../common/constants/category.js';

const { Joi } = BaseValidator;

const objectId = Joi.string().hex().length(24);
const slugSchema = Joi.string()
  .trim()
  .lowercase()
  .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(MAX_CATEGORY_SLUG_LENGTH);

const boolField = Joi.boolean().truthy('true').falsy('false');

/** Multipart may send metadata as a JSON string. */
const metadataSchema = Joi.alternatives()
  .try(
    Joi.object().unknown(true),
    Joi.string()
      .allow('')
      .custom((value, helpers) => {
        if (!value || !String(value).trim()) return {};
        try {
          const parsed = JSON.parse(value);
          if (
            parsed === null ||
            typeof parsed !== 'object' ||
            Array.isArray(parsed)
          ) {
            return helpers.error('object.base');
          }
          return parsed;
        } catch {
          return helpers.error('object.base');
        }
      }),
  )
  .default({});

const priceRangeObject = Joi.object({
  min: Joi.number().min(0).allow(null),
  max: Joi.number().min(0).allow(null),
})
  .custom((value, helpers) => {
    if (
      value?.min != null &&
      value?.max != null &&
      Number(value.min) > Number(value.max)
    ) {
      return helpers.message(
        '"defaultPriceRange.min" must be less than or equal to "defaultPriceRange.max"',
      );
    }
    return value;
  });

/** Multipart may send defaultPriceRange as a JSON string. */
const defaultPriceRangeSchema = Joi.alternatives()
  .try(
    priceRangeObject,
    Joi.string()
      .allow('')
      .custom((value, helpers) => {
        if (!value || !String(value).trim()) return { min: null, max: null };
        try {
          const parsed = JSON.parse(value);
          const { error, value: validated } = priceRangeObject.validate(parsed);
          if (error) return helpers.message(error.message);
          return validated;
        } catch {
          return helpers.error('object.base');
        }
      }),
  )
  .default({ min: null, max: null });

const createCategory = Joi.object({
  name: Joi.string().trim().min(1).max(MAX_CATEGORY_NAME_LENGTH).required(),
  slug: slugSchema.optional(),
  description: Joi.string()
    .trim()
    .max(MAX_CATEGORY_DESCRIPTION_LENGTH)
    .allow('', null)
    .optional(),
  icon: Joi.string().trim().max(2000).allow('', null).optional(),
  color: Joi.string().trim().max(50).allow('', null).optional(),
  displayOrder: Joi.number().integer().min(0).default(0),
  isActive: boolField.default(true),
  isFeatured: boolField.default(false),
  defaultPriceRange: defaultPriceRangeSchema,
  metadata: metadataSchema,
  file: Joi.any().optional(),
});

const updateCategory = Joi.object({
  name: Joi.string().trim().min(1).max(MAX_CATEGORY_NAME_LENGTH),
  slug: slugSchema,
  description: Joi.string()
    .trim()
    .max(MAX_CATEGORY_DESCRIPTION_LENGTH)
    .allow('', null),
  icon: Joi.string().trim().max(2000).allow('', null),
  color: Joi.string().trim().max(50).allow('', null),
  displayOrder: Joi.number().integer().min(0),
  isActive: boolField,
  isFeatured: boolField,
  defaultPriceRange: defaultPriceRangeSchema,
  metadata: metadataSchema,
  file: Joi.any().optional(),
}).min(1);

const categoryIdParams = Joi.object({
  id: objectId.required(),
});

const publicSlugParams = Joi.object({
  slug: slugSchema.required(),
});

const listCategoriesQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().default(DEFAULT_CATEGORY_SORT),
  search: Joi.string().trim().max(100).allow(''),
  isActive: boolField,
  isFeatured: boolField,
  includeDeleted: boolField.default(false),
});

const publicCategoriesQuery = Joi.object({
  featured: boolField.optional(),
});

const statusBody = Joi.object({
  isActive: boolField.required(),
});

const reorderBody = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        id: objectId.required(),
        displayOrder: Joi.number().integer().min(0).required(),
      }),
    )
    .min(1)
    .required(),
});

const bulkStatusBody = Joi.object({
  ids: Joi.array().items(objectId).min(1).max(100).required(),
  isActive: boolField.required(),
});

const bulkDeleteBody = Joi.object({
  ids: Joi.array().items(objectId).min(1).max(100).required(),
});

export class CategoryValidator extends BaseValidator {
  constructor() {
    super({
      createCategory,
      updateCategory,
      categoryIdParams,
      publicSlugParams,
      listCategoriesQuery,
      publicCategoriesQuery,
      statusBody,
      reorderBody,
      bulkStatusBody,
      bulkDeleteBody,
    });
  }
}

export const categoryValidator = new CategoryValidator();
