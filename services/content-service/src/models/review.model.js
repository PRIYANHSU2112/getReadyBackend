import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    userName: { type: String, trim: true, default: 'Customer' },
    bookingId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    beauticianId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    serviceName: { type: String, trim: true, default: 'Beauty Care Service' },
    title: { type: String, trim: true, default: null },
    comment: { type: String, trim: true, default: null },
    rating: { type: Number, required: true, min: 1, max: 5 },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE'],
      default: 'APPROVED',
      index: true,
    },
    images: [{ type: String }],
  },
  { timestamps: true },
);

reviewSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  obj.name = obj.title || obj.comment?.slice(0, 30) || `${obj.rating}★ Review`;
  obj.service = obj.serviceName || 'Service';
  obj.status = obj.status || 'APPROVED';
  return obj;
};

export const ReviewModel = mongoose.models.Review || mongoose.model('Review', reviewSchema);
export default ReviewModel;
