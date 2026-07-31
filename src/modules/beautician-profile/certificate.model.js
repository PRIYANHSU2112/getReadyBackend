import mongoose from 'mongoose';
import { CertificateStatus } from '../../common/constants/enums.js';
import { MAX_CERTIFICATE_TITLE_LENGTH } from '../../common/constants/beautician-profile.js';

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: null },
    publicId: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const certificateSchema = new mongoose.Schema(
  {
    beauticianProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BeauticianProfile',
      required: [true, 'Beautician Profile ID is required'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Certificate title is required'],
      trim: true,
      maxlength: [MAX_CERTIFICATE_TITLE_LENGTH, `Title cannot exceed ${MAX_CERTIFICATE_TITLE_LENGTH} characters`],
    },
    issueDate: {
      type: Date,
      default: null,
    },
    certificateImage: {
      type: mediaSchema,
      default: () => ({ url: null, publicId: null }),
    },
    status: {
      type: String,
      enum: Object.values(CertificateStatus),
      default: CertificateStatus.PENDING,
      index: true,
    },
    rejectionReason: { type: String, trim: true, default: null },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

certificateSchema.index({ beauticianProfileId: 1, deletedAt: 1 });
certificateSchema.index({ userId: 1, deletedAt: 1 });
certificateSchema.index({ status: 1, deletedAt: 1 });

certificateSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const CertificateModel =
  mongoose.models.Certificate ||
  mongoose.model('Certificate', certificateSchema, 'certificates');

export default CertificateModel;
