import mongoose from 'mongoose';
import { ServiceChangeRequestStatus } from '../../common/constants/enums.js';
import { MAX_REJECTION_REASON_LENGTH } from '../../common/constants/service.js';

const serviceChangeRequestSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ServiceChangeRequestStatus),
      default: ServiceChangeRequestStatus.PENDING,
      index: true,
    },
    changes: { type: mongoose.Schema.Types.Mixed, default: {} },
    previousValues: { type: mongoose.Schema.Types.Mixed, default: {} },
    changedFields: { type: [String], default: [] },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: { type: Date, default: null },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectedAt: { type: Date, default: null },
    rejectedReason: {
      type: String,
      trim: true,
      default: null,
      maxlength: MAX_REJECTION_REASON_LENGTH,
    },
    reviewedNote: { type: String, trim: true, default: null, maxlength: 500 },
  },
  { timestamps: true },
);

serviceChangeRequestSchema.index(
  { serviceId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: ServiceChangeRequestStatus.PENDING },
  },
);
serviceChangeRequestSchema.index({ status: 1, createdAt: -1 });
serviceChangeRequestSchema.index({ requestedBy: 1, status: 1, createdAt: -1 });
serviceChangeRequestSchema.index({ serviceId: 1, createdAt: -1 });

serviceChangeRequestSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const ServiceChangeRequestModel =
  mongoose.models.ServiceChangeRequest ||
  mongoose.model(
    'ServiceChangeRequest',
    serviceChangeRequestSchema,
    'service_change_requests',
  );

export default ServiceChangeRequestModel;
