import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    channel: { type: String, enum: ['IN_APP', 'PUSH', 'SMS', 'EMAIL'], default: 'IN_APP' },
    read: { type: Boolean, default: false },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, deletedAt: 1, createdAt: -1 });

notificationSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const NotificationModel = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default NotificationModel;
