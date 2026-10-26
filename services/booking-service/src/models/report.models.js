import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reportNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    templateId: {
      type: String,
      required: true,
      enum: ['financial_settlements', 'bookings_master', 'gst_tax', 'customers_retention', 'custom'],
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['Finance', 'Operations', 'Taxation', 'Marketing', 'General'],
      default: 'Operations',
      index: true,
    },
    format: {
      type: String,
      required: true,
      enum: ['CSV', 'XLSX', 'PDF'],
      default: 'CSV',
    },
    datePreset: {
      type: String,
      enum: ['today', '7d', 'month', 'quarter', 'custom'],
      default: 'month',
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    rowsCount: {
      type: Number,
      default: 0,
    },
    fileSize: {
      type: String,
      default: '0 KB',
    },
    status: {
      type: String,
      enum: ['READY', 'PROCESSING', 'FAILED'],
      default: 'READY',
      index: true,
    },
    generatedBy: {
      type: String,
      default: 'Admin',
    },
    summary: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    columns: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    dataSnapshot: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id?.toString();
        delete ret.__v;
        return ret;
      },
    },
  },
);

reportSchema.index({ createdAt: -1 });
reportSchema.index({ templateId: 1, createdAt: -1 });

export const ReportModel = mongoose.models.Report || mongoose.model('Report', reportSchema);
export default ReportModel;
