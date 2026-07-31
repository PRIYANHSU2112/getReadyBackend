import mongoose from 'mongoose';

const workHistorySchema = new mongoose.Schema(
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
    salonName: {
      type: String,
      required: [true, 'Salon name is required'],
      trim: true,
      maxlength: [200, 'Salon name cannot exceed 200 characters'],
    },
    role: {
      type: String,
      trim: true,
      maxlength: [150, 'Role cannot exceed 150 characters'],
      default: null,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      default: null,
    },
    isCurrent: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

workHistorySchema.index({ beauticianProfileId: 1, deletedAt: 1, startDate: -1 });
workHistorySchema.index({ userId: 1, deletedAt: 1 });

workHistorySchema.pre('validate', function validateDates(next) {
  if (this.isCurrent) {
    this.endDate = null;
  }
  if (this.endDate && this.startDate && this.endDate < this.startDate) {
    return next(new Error('End date must be after start date'));
  }
  return next();
});

workHistorySchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const WorkHistoryModel =
  mongoose.models.WorkHistory ||
  mongoose.model('WorkHistory', workHistorySchema, 'work_histories');

export default WorkHistoryModel;
