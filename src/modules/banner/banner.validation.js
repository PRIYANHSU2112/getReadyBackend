import { BaseValidator } from '../../common/base/BaseValidator.js';
import {
  BannerType,
  BannerStatus,
  BannerPlatform,
} from '../../common/constants/enums.js';
import {
  MIN_BANNER_POSITION,
  MAX_BANNER_POSITION,
  MAX_SERVICE_CATEGORY_LENGTH,
  MAX_BANNER_SERVICE_IDS,
  DEFAULT_BANNER_SORT,
} from '../../common/constants/banner.js';

const { Joi } = BaseValidator;

const objectId = Joi.string().hex().length(24);
const uriOrPath = Joi.string().trim().uri({ allowRelative: true }).max(2000);

const scheduleRefine = (value, helpers) => {
  if (value.startAt && value.endAt && new Date(value.endAt) < new Date(value.startAt)) {
    return helpers.message('"endAt" must be greater than or equal to "startAt"');
  }
  return value;
};

/** Multipart may send serviceIds as a JSON string. */
const serviceIdsField = Joi.alternatives()
  .try(
    Joi.array().items(objectId).max(MAX_BANNER_SERVICE_IDS),
    Joi.string().allow(''),
  )
  .optional();

const createBanner = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  linkUrl: uriOrPath.allow('', null).optional(),
  position: Joi.number()
    .integer()
    .min(MIN_BANNER_POSITION)
    .max(MAX_BANNER_POSITION)
    .required(),
  serviceCategory: Joi.string()
    .trim()
    .max(MAX_SERVICE_CATEGORY_LENGTH)
    .allow('', null)
    .optional(),
  serviceIds: serviceIdsField,
  type: Joi.string()
    .valid(...Object.values(BannerType))
    .default(BannerType.GENERAL),
  status: Joi.string()
    .valid(...Object.values(BannerStatus))
    .default(BannerStatus.INACTIVE),
  sortOrder: Joi.number().integer().min(0).default(0),
  startAt: Joi.date().iso().allow(null).optional(),
  endAt: Joi.date().iso().allow(null).optional(),
  platform: Joi.string()
    .valid(...Object.values(BannerPlatform))
    .default(BannerPlatform.ALL),
}).custom(scheduleRefine);

const updateBanner = Joi.object({
  title: Joi.string().trim().min(1).max(200),
  linkUrl: uriOrPath.allow('', null),
  position: Joi.number().integer().min(MIN_BANNER_POSITION).max(MAX_BANNER_POSITION),
  serviceCategory: Joi.string().trim().max(MAX_SERVICE_CATEGORY_LENGTH).allow('', null),
  serviceIds: serviceIdsField,
  type: Joi.string().valid(...Object.values(BannerType)),
  status: Joi.string().valid(...Object.values(BannerStatus)),
  sortOrder: Joi.number().integer().min(0),
  startAt: Joi.date().iso().allow(null),
  endAt: Joi.date().iso().allow(null),
  platform: Joi.string().valid(...Object.values(BannerPlatform)),
})
  .min(1)
  .custom(scheduleRefine);

const bannerIdParams = Joi.object({
  id: objectId.required(),
});

const listBannersQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().default(DEFAULT_BANNER_SORT),
  position: Joi.number().integer().min(MIN_BANNER_POSITION).max(MAX_BANNER_POSITION),
  serviceCategory: Joi.string().trim().max(MAX_SERVICE_CATEGORY_LENGTH),
  serviceId: objectId,
  platform: Joi.string().valid(...Object.values(BannerPlatform)),
  type: Joi.string().valid(...Object.values(BannerType)),
  status: Joi.string().valid(...Object.values(BannerStatus)),
});

const activeBannersQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().default(DEFAULT_BANNER_SORT),
  position: Joi.number().integer().min(MIN_BANNER_POSITION).max(MAX_BANNER_POSITION),
  serviceCategory: Joi.string().trim().max(MAX_SERVICE_CATEGORY_LENGTH),
  serviceId: objectId,
  platform: Joi.string().valid(...Object.values(BannerPlatform)),
  type: Joi.string().valid(...Object.values(BannerType)),
});

export class BannerValidator extends BaseValidator {
  constructor() {
    super({
      createBanner,
      updateBanner,
      bannerIdParams,
      listBannersQuery,
      activeBannersQuery,
    });
  }
}

export const bannerValidator = new BannerValidator();
