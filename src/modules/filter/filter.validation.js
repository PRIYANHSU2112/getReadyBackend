import { BaseValidator } from '../../common/base/BaseValidator.js';
import {
  FilterDisplayType,
  FilterSelectionType,
} from '../../common/constants/enums.js';
import {
  DEFAULT_FILTER_SORT,
  DEFAULT_FILTER_VALUE_SORT,
  MAX_FILTER_SCOPES,
  MAX_FILTER_NAME_LENGTH,
  MAX_FILTER_SLUG_LENGTH,
} from '../../common/constants/filter.js';

const { Joi } = BaseValidator;

const objectId = Joi.string().hex().length(24);
const slugSchema = Joi.string()
  .trim()
  .lowercase()
  .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(MAX_FILTER_SLUG_LENGTH);

/** Multipart form fields arrive as strings — accept JSON string or object. */
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

const boolField = Joi.boolean().truthy('true').falsy('false');

const createFilter = Joi.object({
  name: Joi.string().trim().min(1).max(MAX_FILTER_NAME_LENGTH).required(),
  slug: slugSchema.optional(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
  displayType: Joi.string()
    .valid(...Object.values(FilterDisplayType))
    .default(FilterDisplayType.CHIPS),
  selectionType: Joi.string()
    .valid(...Object.values(FilterSelectionType))
    .default(FilterSelectionType.MULTIPLE),
  isSearchable: boolField.default(false),
  isRequired: boolField.default(false),
  isActive: boolField.default(true),
  isFeatured: boolField.default(false),
  displayOrder: Joi.number().integer().min(0).default(0),
  icon: Joi.string().trim().max(2000).allow('', null).optional(),
  color: Joi.string().trim().max(50).allow('', null).optional(),
  scopes: Joi.alternatives()
    .try(
      Joi.array().items(Joi.string().trim().lowercase().max(50)).max(MAX_FILTER_SCOPES),
      Joi.string().allow(''),
    )
    .default([]),
  metadata: metadataSchema,
});

const updateFilter = Joi.object({
  name: Joi.string().trim().min(1).max(MAX_FILTER_NAME_LENGTH),
  slug: slugSchema,
  description: Joi.string().trim().max(500).allow('', null),
  displayType: Joi.string().valid(...Object.values(FilterDisplayType)),
  selectionType: Joi.string().valid(...Object.values(FilterSelectionType)),
  isSearchable: boolField,
  isRequired: boolField,
  isActive: boolField,
  isFeatured: boolField,
  displayOrder: Joi.number().integer().min(0),
  icon: Joi.string().trim().max(2000).allow('', null),
  color: Joi.string().trim().max(50).allow('', null),
  scopes: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim().lowercase().max(50)).max(MAX_FILTER_SCOPES),
    Joi.string().allow(''),
  ),
  metadata: metadataSchema,
}).min(1);

const filterIdParams = Joi.object({
  id: objectId.required(),
});

const filterIdOnlyParams = Joi.object({
  filterId: objectId.required(),
});

const valueIdParams = Joi.object({
  filterId: objectId.required(),
  valueId: objectId.required(),
});

const listFiltersQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().default(DEFAULT_FILTER_SORT),
  search: Joi.string().trim().max(100).allow(''),
  isActive: boolField,
  isFeatured: boolField,
  scope: Joi.string().trim().lowercase().max(50),
  includeDeleted: boolField.default(false),
  includeValues: boolField.default(false),
});

const publicFiltersQuery = Joi.object({
  scope: Joi.string().trim().lowercase().max(50).optional(),
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

const createFilterValue = Joi.object({
  label: Joi.string().trim().min(1).max(100).required(),
  value: Joi.string().trim().min(1).max(120).required(),
  slug: slugSchema.optional(),
  icon: Joi.string().trim().max(2000).allow('', null).optional(),
  color: Joi.string().trim().max(50).allow('', null).optional(),
  displayOrder: Joi.number().integer().min(0).default(0),
  isDefault: boolField.default(false),
  isActive: boolField.default(true),
  metadata: metadataSchema,
});

const updateFilterValue = Joi.object({
  label: Joi.string().trim().min(1).max(100),
  value: Joi.string().trim().min(1).max(120),
  slug: slugSchema,
  icon: Joi.string().trim().max(2000).allow('', null),
  color: Joi.string().trim().max(50).allow('', null),
  displayOrder: Joi.number().integer().min(0),
  isDefault: boolField,
  isActive: boolField,
  metadata: metadataSchema,
}).min(1);

const listFilterValuesQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().default(DEFAULT_FILTER_VALUE_SORT),
  search: Joi.string().trim().max(100).allow(''),
  isActive: boolField,
  includeDeleted: boolField.default(false),
});

export class FilterValidator extends BaseValidator {
  constructor() {
    super({
      createFilter,
      updateFilter,
      filterIdParams,
      filterIdOnlyParams,
      valueIdParams,
      listFiltersQuery,
      publicFiltersQuery,
      statusBody,
      reorderBody,
      bulkStatusBody,
      bulkDeleteBody,
      createFilterValue,
      updateFilterValue,
      listFilterValuesQuery,
    });
  }
}

export const filterValidator = new FilterValidator();
