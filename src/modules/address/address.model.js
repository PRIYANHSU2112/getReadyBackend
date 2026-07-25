import mongoose from 'mongoose';
import { AddressLabel } from '../../common/constants/enums.js';
import { DEFAULT_COUNTRY, GeoJsonType } from '../../common/constants/address.js';

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    label: {
      type: String,
      enum: Object.values(AddressLabel),
      default: AddressLabel.HOME,
      uppercase: true,
      trim: true,
    },
    fullName: { type: String, trim: true, maxlength: 100 },
    phone: {
      type: String,
      trim: true,
      match: /^\+?[1-9]\d{7,14}$/,
    },
    line1: { type: String, trim: true, maxlength: 200 },
    line2: { type: String, default: null, trim: true, maxlength: 200 },
    landmark: { type: String, default: null, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    pincode: {
      type: String,
      trim: true,
      match: /^\d{6}$/,
    },
    country: {
      type: String,
      default: DEFAULT_COUNTRY,
      uppercase: true,
      trim: true,
      maxlength: 2,
    },
    location: {
      type: {
        type: String,
        enum: Object.values(GeoJsonType),
        default: undefined,
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: undefined,
      },
    },
    isDefault: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

addressSchema.index({ userId: 1, deletedAt: 1, createdAt: -1 });
addressSchema.index({ userId: 1, isDefault: 1, deletedAt: 1 });
addressSchema.index({ location: '2dsphere' }, { sparse: true });

addressSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const AddressModel =
  mongoose.models.Address || mongoose.model('Address', addressSchema);

export default AddressModel;
