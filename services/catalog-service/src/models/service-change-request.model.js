import mongoose from 'mongoose';

const serviceChangeRequestSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
      index: true,
    },
    requestedBy: { type: String, required: true },
    changes: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

serviceChangeRequestSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const ServiceChangeRequestModel =
  mongoose.models.ServiceChangeRequest || mongoose.model('ServiceChangeRequest', serviceChangeRequestSchema);
export default ServiceChangeRequestModel;
