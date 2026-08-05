import mongoose from 'mongoose';
import { SlotStatus } from '../../common/constants/enums.js';
import {
  DEFAULT_SLOT_MIN_BOOKINGS,
  DEFAULT_SLOT_MAX_BOOKINGS,
  MAX_SLOT_CAPACITY,
  MAX_SLOT_NOTES_LENGTH,
} from '../../common/constants/slot.js';

const slotSchema = new mongoose.Schema(
  {
    beauticianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    serviceIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
      default: [],
    },
    /** Business calendar date YYYY-MM-DD */
    date: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    minBookings: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_SLOT_CAPACITY,
      default: DEFAULT_SLOT_MIN_BOOKINGS,
    },
    maxBookings: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_SLOT_CAPACITY,
      default: DEFAULT_SLOT_MAX_BOOKINGS,
    },
    /** Confirmed bookings only — filled by future Booking module */
    bookedCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(SlotStatus),
      default: SlotStatus.ACTIVE,
      index: true,
    },
    isBookable: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: MAX_SLOT_NOTES_LENGTH,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

slotSchema.index({ date: 1, status: 1, startAt: 1 });
slotSchema.index({ beauticianId: 1, startAt: 1 });

slotSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const SlotModel = mongoose.models.Slot || mongoose.model('Slot', slotSchema);

export default SlotModel;
