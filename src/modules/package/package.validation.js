import { BaseValidator } from '../../common/base/BaseValidator.js';
import {
  joiJsonArray,
  joiJsonObject,
  joiParseJson,
} from '../../common/helpers/joi-json.helper.js';
import {
  PackageType,
  PackageGender,
  PackageDiscountType,
  PackageBadge,
} from './package.enum.js';

const { Joi } = BaseValidator;

const singlePackageItemSchema = Joi.object({
  serviceId: Joi.string().hex().length(24).required(),
  categoryId: Joi.string().hex().length(24).required(),
  groupTitle: Joi.string().trim().allow('', null).optional(),
  isMandatory: Joi.boolean().optional().default(false),
  isDefaultSelected: Joi.boolean().optional().default(false),
  badgeTags: joiJsonArray(Joi.string().trim()),
  extraCharge: Joi.number().min(0).optional().default(0),
  displayOrder: Joi.number().optional().default(0),
});

const packageItemSchema = joiParseJson(singlePackageItemSchema);

const imageSchema = Joi.object({
  url: Joi.string().uri().required(),
  publicId: Joi.string().allow('', null).optional(),
  displayOrder: Joi.number().optional().default(0),
});

const sharedBodyFields = {
  name: Joi.string().min(2).max(150),
  slug: Joi.string().trim().lowercase(),
  badgeTag: Joi.string().trim().max(100).allow('', null),
  shortDescription: Joi.string().max(300).allow(''),
  description: Joi.string().allow(''),
  packageType: Joi.string().valid(...Object.values(PackageType)),
  minSelectCount: Joi.number().integer().min(1),
  maxSelectCount: Joi.number().integer().min(1),
  selectionNotice: Joi.string().allow(''),

  items: joiJsonArray(packageItemSchema, 50),

  durationMinMinutes: Joi.number().integer().min(0),
  durationMaxMinutes: Joi.number().integer().min(0),

  originalPrice: Joi.number().min(0),
  approxPrice: Joi.number().min(0).allow(null),
  price: Joi.number().min(0).allow(null),

  discountType: Joi.string().valid(...Object.values(PackageDiscountType)),
  discountValue: Joi.number().min(0),

  badges: joiJsonArray(Joi.string().valid(...Object.values(PackageBadge))),

  socialProofText: Joi.string().allow('', null),

  gender: Joi.string().valid(...Object.values(PackageGender)),
  isPopular: Joi.boolean(),
  isTrending: Joi.boolean(),
  isFeatured: Joi.boolean(),
  isHomeServiceAvailable: Joi.boolean(),
  isActive: Joi.boolean(),
  displayOrder: Joi.number(),

  images: joiJsonArray(joiParseJson(imageSchema), 10),
  metadata: joiJsonObject(),
};

const createPackage = Joi.object({
  ...sharedBodyFields,
  name: sharedBodyFields.name.required(),
  items: sharedBodyFields.items.required(),
});

const updatePackage = Joi.object({
  ...sharedBodyFields,
}).min(1);

const approvePackage = Joi.object({
  price: Joi.number().min(0).required(),
  discountType: Joi.string().valid(...Object.values(PackageDiscountType)).optional(),
  discountValue: Joi.number().min(0).optional(),
});

const rejectPackage = Joi.object({
  rejectionReason: Joi.string().trim().min(2).max(500).required(),
});

const publicPackagesQuery = Joi.object({
  categoryId: Joi.string().hex().length(24),
  categorySlug: Joi.string().trim().lowercase(),
  search: Joi.string().trim().max(100),
  q: Joi.string().trim().max(100),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  minRating: Joi.number().min(0).max(5),
  gender: Joi.string().valid(...Object.values(PackageGender)),
  isPopular: Joi.boolean(),
  isTrending: Joi.boolean(),
  isFeatured: Joi.boolean(),
  packageType: Joi.string().valid(...Object.values(PackageType)),
  isHomeServiceAvailable: Joi.boolean(),
  sort: Joi.string().valid(
    'price_asc',
    'price_desc',
    'rating',
    'popular',
    'newest',
    'displayOrder',
  ),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

export class PackageValidator extends BaseValidator {
  constructor() {
    super({
      createPackage,
      updatePackage,
      approvePackage,
      rejectPackage,
      publicPackagesQuery,
    });
  }
}

export const packageValidator = new PackageValidator();
