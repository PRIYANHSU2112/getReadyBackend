import { BaseValidator } from '../../common/base/BaseValidator.js';
import {
  ServiceDiscountType,
  ServiceStatus,
  ServiceBadge,
  ServiceGender,
  ServiceChangeRequestStatus,
} from '../../common/constants/enums.js';
import {
  DEFAULT_SERVICE_SORT,
  MAX_SERVICE_NAME_LENGTH,
  MAX_SERVICE_SLUG_LENGTH,
  MAX_SERVICE_SHORT_DESCRIPTION_LENGTH,
  MAX_SERVICE_DESCRIPTION_LENGTH,
  MAX_SERVICE_IMAGES,
  MAX_SERVICE_TAGS,
  MAX_SERVICE_INCLUSIONS,
  MAX_REJECTION_REASON_LENGTH,
  MIN_REJECTION_REASON_LENGTH,
} from '../../common/constants/service.js';

const { Joi } = BaseValidator;

const objectId = Joi.string().hex().length(24);
const slugSchema = Joi.string()
  .trim()
  .lowercase()
  .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(MAX_SERVICE_SLUG_LENGTH);
const boolField = Joi.boolean().truthy('true').falsy('false');

const metadataSchema = Joi.alternatives()
  .try(
    Joi.object().unknown(true),
    Joi.string()
      .allow('')
      .custom((value, helpers) => {
        if (!value || !String(value).trim()) return {};
        try {
          const parsed = JSON.parse(value);
          if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return helpers.error('object.base');
          }
          return parsed;
        } catch {
          return helpers.error('object.base');
        }
      }),
  )
  .default({});

const mediaObject = Joi.object({
  url: Joi.string().trim().uri({ allowRelative: true }).allow('', null),
  publicId: Joi.string().trim().allow('', null),
}).allow(null);

const imageItem = Joi.object({
  url: Joi.string().trim().uri({ allowRelative: true }).required(),
  publicId: Joi.string().trim().allow('', null),
  isPrimary: boolField.default(false),
  displayOrder: Joi.number().integer().min(0).default(0),
});

const inclusionItem = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  displayOrder: Joi.number().integer().min(0).default(0),
});

const parseJsonArray = (itemSchema, maxItems) => {
  let arraySchema = Joi.array().items(itemSchema);
  if (maxItems !== undefined && maxItems !== null) {
    arraySchema = arraySchema.max(maxItems);
  }
  return Joi.alternatives().try(
    arraySchema,
    Joi.string()
      .allow('')
      .custom((value, helpers) => {
        if (!value || !String(value).trim()) return [];
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed)) return helpers.error('array.base');
          const { error, value: validated } = arraySchema.validate(parsed);
          if (error) return helpers.message(error.message);
          return validated;
        } catch {
          return helpers.error('array.base');
        }
      }),
  );
};

const sharedBodyFields = {
  name: Joi.string().trim().min(1).max(MAX_SERVICE_NAME_LENGTH),
  slug: slugSchema,
  shortDescription: Joi.string()
    .trim()
    .max(MAX_SERVICE_SHORT_DESCRIPTION_LENGTH)
    .allow('', null),
  description: Joi.string()
    .trim()
    .max(MAX_SERVICE_DESCRIPTION_LENGTH)
    .allow('', null),
  categoryId: objectId,
  images: parseJsonArray(imageItem, MAX_SERVICE_IMAGES),
  thumbnail: mediaObject,
  video: mediaObject,
  durationMinMinutes: Joi.number().integer().min(0).allow(null),
  durationMaxMinutes: Joi.number().integer().min(0).allow(null),
  approxPrice: Joi.number().min(0).allow(null),
  badges: parseJsonArray(
    Joi.string().valid(...Object.values(ServiceBadge)),
  ),
  isPopular: boolField,
  isTrending: boolField,
  isFeatured: boolField,
  isActive: boolField,
  inclusions: parseJsonArray(inclusionItem, MAX_SERVICE_INCLUSIONS),
  isHomeServiceAvailable: boolField,
  homeVisitFee: Joi.number().min(0),
  rewardPointsMultiplier: Joi.number().min(0),
  tags: parseJsonArray(Joi.string().trim().lowercase().max(50), MAX_SERVICE_TAGS),
  gender: Joi.string().valid(...Object.values(ServiceGender)),
  displayOrder: Joi.number().integer().min(0),
  metadata: metadataSchema,
  // admin pricing (stripped for beautician in service)
  price: Joi.number().min(0).allow(null),
  discountType: Joi.string().valid(...Object.values(ServiceDiscountType)),
  discountValue: Joi.number().min(0),
};

const createService = Joi.object({
  ...sharedBodyFields,
  name: sharedBodyFields.name.required(),
  categoryId: objectId.required(),
  isActive: boolField.default(true),
  isPopular: boolField.default(false),
  isTrending: boolField.default(false),
  isFeatured: boolField.default(false),
  displayOrder: Joi.number().integer().min(0).default(0),
  discountType: Joi.string()
    .valid(...Object.values(ServiceDiscountType))
    .default(ServiceDiscountType.NONE),
  discountValue: Joi.number().min(0).default(0),
  rewardPointsMultiplier: Joi.number().min(0).default(1),
  homeVisitFee: Joi.number().min(0).default(0),
  gender: Joi.string()
    .valid(...Object.values(ServiceGender))
    .default(ServiceGender.ALL),
  file: Joi.any().optional(),
  files: Joi.any().optional(),
}).custom((value, helpers) => {
  if (
    value.durationMinMinutes != null &&
    value.durationMaxMinutes != null &&
    value.durationMinMinutes > value.durationMaxMinutes
  ) {
    return helpers.message(
      '"durationMaxMinutes" must be greater than or equal to "durationMinMinutes"',
    );
  }
  return value;
});

const updateService = Joi.object({
  ...sharedBodyFields,
  file: Joi.any().optional(),
  files: Joi.any().optional(),
})
  .min(1)
  .custom((value, helpers) => {
    if (
      value.durationMinMinutes != null &&
      value.durationMaxMinutes != null &&
      value.durationMinMinutes > value.durationMaxMinutes
    ) {
      return helpers.message(
        '"durationMaxMinutes" must be greater than or equal to "durationMinMinutes"',
      );
    }
    return value;
  });

const serviceIdParams = Joi.object({ id: objectId.required() });
const changeRequestIdParams = Joi.object({ id: objectId.required() });
const publicSlugParams = Joi.object({ slug: slugSchema.required() });
const categoryServicesParams = Joi.object({ categoryId: objectId.required() });

const listServicesQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().default(DEFAULT_SERVICE_SORT),
  search: Joi.string().trim().max(100).allow(''),
  status: Joi.string().valid(...Object.values(ServiceStatus)),
  categoryId: objectId,
  isActive: boolField,
  isFeatured: boolField,
  isPopular: boolField,
  isTrending: boolField,
  gender: Joi.string().valid(...Object.values(ServiceGender)),
  tag: Joi.string().trim().lowercase().max(50),
  includeDeleted: boolField.default(false),
});

const publicServicesQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  categoryId: objectId,
  categorySlug: slugSchema,
  search: Joi.string().trim().max(100).allow(''),
  q: Joi.string().trim().max(100).allow(''),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  minRating: Joi.number().min(0).max(5),
  featured: boolField,
  popular: boolField,
  trending: boolField,
  isHomeServiceAvailable: boolField,
  gender: Joi.string().valid(...Object.values(ServiceGender)),
  tag: Joi.string().trim().lowercase().max(50),
  sort: Joi.string()
    .valid(
      'displayOrder',
      'price_asc',
      'price-asc',
      'price_desc',
      'price-desc',
      'rating',
      'rating_desc',
      'popular',
      'newest',
      'created_at_desc',
      'name',
    )
    .default('displayOrder'),
});

const approveCreateBody = Joi.object({
  price: Joi.number().min(0).required(),
  discountType: Joi.string()
    .valid(...Object.values(ServiceDiscountType))
    .default(ServiceDiscountType.NONE),
  discountValue: Joi.number().min(0).default(0),
  reviewedNote: Joi.string().trim().max(500).allow('', null),
});

const rejectBody = Joi.object({
  rejectionReason: Joi.string()
    .trim()
    .min(MIN_REJECTION_REASON_LENGTH)
    .max(MAX_REJECTION_REASON_LENGTH)
    .required(),
});

const rejectChangeRequestBody = Joi.object({
  rejectedReason: Joi.string()
    .trim()
    .min(MIN_REJECTION_REASON_LENGTH)
    .max(MAX_REJECTION_REASON_LENGTH)
    .required(),
});

const approveChangeRequestBody = Joi.object({
  price: Joi.number().min(0).optional(),
  discountType: Joi.string().valid(...Object.values(ServiceDiscountType)),
  discountValue: Joi.number().min(0),
  reviewedNote: Joi.string().trim().max(500).allow('', null),
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

const listChangeRequestsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().default('-createdAt'),
  status: Joi.string().valid(...Object.values(ServiceChangeRequestStatus)),
  serviceId: objectId,
  requestedBy: objectId,
  mine: boolField.default(false),
});

export class ServiceValidator extends BaseValidator {
  constructor() {
    super({
      createService,
      updateService,
      serviceIdParams,
      changeRequestIdParams,
      publicSlugParams,
      categoryServicesParams,
      listServicesQuery,
      publicServicesQuery,
      approveCreateBody,
      rejectBody,
      rejectChangeRequestBody,
      approveChangeRequestBody,
      statusBody,
      reorderBody,
      bulkStatusBody,
      bulkDeleteBody,
      listChangeRequestsQuery,
    });
  }
}

export const serviceValidator = new ServiceValidator();
