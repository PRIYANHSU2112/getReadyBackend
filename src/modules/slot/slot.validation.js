import { BaseValidator } from '../../common/base/BaseValidator.js';
import { SlotStatus } from '../../common/constants/enums.js';
import {
  DEFAULT_SLOT_MIN_BOOKINGS,
  DEFAULT_SLOT_MAX_BOOKINGS,
  DEFAULT_SLOT_SORT,
  MAX_SLOT_BULK_CREATE,
  MAX_SLOT_CAPACITY,
  MAX_SLOT_NOTES_LENGTH,
  SLOT_SORT_FIELDS,
} from '../../common/constants/slot.js';

const { Joi } = BaseValidator;

const objectId = Joi.string().hex().length(24);
const dateStr = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .message('"date" must be YYYY-MM-DD');
const boolField = Joi.boolean().truthy('true').falsy('false');

const sortEnum = SLOT_SORT_FIELDS.flatMap((f) => [f, `-${f}`]);

const capacityRefine = (value, helpers) => {
  if (value.minBookings != null && value.maxBookings != null && value.minBookings > value.maxBookings) {
    return helpers.error('any.custom', {
      message: '"minBookings" must be <= "maxBookings"',
    });
  }
  return value;
};

const timeRefine = (value, helpers) => {
  if (value.startAt && value.endAt && new Date(value.endAt) <= new Date(value.startAt)) {
    return helpers.error('any.custom', {
      message: '"endAt" must be after "startAt"',
    });
  }
  return value;
};

const slotBodyBase = {
  beauticianId: objectId.optional().allow(null),
  serviceIds: Joi.array().items(objectId).max(50).default([]),
  date: dateStr.required(),
  startAt: Joi.date().iso().required(),
  endAt: Joi.date().iso().required(),
  minBookings: Joi.number()
    .integer()
    .min(1)
    .max(MAX_SLOT_CAPACITY)
    .default(DEFAULT_SLOT_MIN_BOOKINGS),
  maxBookings: Joi.number()
    .integer()
    .min(1)
    .max(MAX_SLOT_CAPACITY)
    .default(DEFAULT_SLOT_MAX_BOOKINGS),
  status: Joi.string()
    .valid(...Object.values(SlotStatus))
    .default(SlotStatus.ACTIVE),
  isBookable: boolField.default(true),
  notes: Joi.string().trim().max(MAX_SLOT_NOTES_LENGTH).optional().allow(null, ''),
};

const createSlot = Joi.object(slotBodyBase).custom(capacityRefine).custom(timeRefine);

const bulkSlotItem = Joi.object(slotBodyBase).custom(capacityRefine).custom(timeRefine);

const createSlotsBulk = Joi.object({
  slots: Joi.array().items(bulkSlotItem).min(1).max(MAX_SLOT_BULK_CREATE).required(),
});

const updateSlot = Joi.object({
  beauticianId: objectId.optional().allow(null),
  serviceIds: Joi.array().items(objectId).max(50),
  date: dateStr,
  startAt: Joi.date().iso(),
  endAt: Joi.date().iso(),
  minBookings: Joi.number().integer().min(1).max(MAX_SLOT_CAPACITY),
  maxBookings: Joi.number().integer().min(1).max(MAX_SLOT_CAPACITY),
  status: Joi.string().valid(...Object.values(SlotStatus)),
  isBookable: boolField,
  notes: Joi.string().trim().max(MAX_SLOT_NOTES_LENGTH).optional().allow(null, ''),
})
  .min(1)
  .custom(capacityRefine)
  .custom(timeRefine);

const slotIdParams = Joi.object({
  id: objectId.required(),
});

const listSlotsQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string()
    .valid(...sortEnum)
    .default(DEFAULT_SLOT_SORT),
  date: dateStr.optional(),
  status: Joi.string().valid(...Object.values(SlotStatus)),
  beauticianId: objectId.optional(),
  isBookable: boolField,
});

const availableSlotsQuery = Joi.object({
  date: dateStr.required(),
});

export class SlotValidator extends BaseValidator {
  constructor() {
    super({
      createSlot,
      createSlotsBulk,
      updateSlot,
      slotIdParams,
      listSlotsQuery,
      availableSlotsQuery,
    });
  }
}

export const slotValidator = new SlotValidator();
