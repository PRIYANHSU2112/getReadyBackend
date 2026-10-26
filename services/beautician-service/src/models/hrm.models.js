import mongoose from 'mongoose';

// 1. Attendance Schema
const attendanceSchema = new mongoose.Schema(
  {
    beauticianProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BeauticianProfile',
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: true,
      index: true,
    },
    punchIn: {
      type: Date,
      default: null,
    },
    punchOut: {
      type: Date,
      default: null,
    },
    totalHoursWorked: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY'],
      default: 'ABSENT',
      index: true,
    },
    source: {
      type: String,
      enum: ['DUTY_TOGGLE', 'MANUAL_ADMIN', 'SYSTEM'],
      default: 'DUTY_TOGGLE',
    },
    remarks: {
      type: String,
      trim: true,
      default: null,
    },
    markedBy: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

attendanceSchema.index({ beauticianProfileId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1, status: 1 });
attendanceSchema.index({ userId: 1, date: -1 });

// 2. Leave Request Schema
const leaveRequestSchema = new mongoose.Schema(
  {
    beauticianProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BeauticianProfile',
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    leaveType: {
      type: String,
      enum: ['CL', 'SL', 'PL', 'EMERGENCY'],
      required: true,
    },
    duration: {
      type: String,
      enum: ['FULL_DAY', 'HALF_DAY'],
      default: 'FULL_DAY',
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    totalDays: {
      type: Number,
      required: true,
      default: 1,
      min: 0.5,
    },
    reason: {
      type: String,
      trim: true,
      required: true,
      maxlength: 500,
    },
    attachmentUrl: {
      type: String,
      default: null,
    },
    attachmentKey: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    reviewedBy: {
      type: String,
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    adminRemarks: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ beauticianProfileId: 1, startDate: -1 });
leaveRequestSchema.index({ status: 1, startDate: 1 });
leaveRequestSchema.index({ userId: 1, status: 1 });

// 3. Payslip Schema
const payslipSchema = new mongoose.Schema(
  {
    beauticianProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BeauticianProfile',
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    payPeriod: {
      type: String, // 'YYYY-MM'
      required: true,
      index: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
    },
    totalBookings: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    platformCommission: {
      type: Number,
      default: 0,
      min: 0,
    },
    tds: {
      type: Number,
      default: 0,
      min: 0,
    },
    netPayout: {
      type: Number,
      default: 0,
    },
    bonuses: {
      type: Number,
      default: 0,
      min: 0,
    },
    deductions: {
      type: Number,
      default: 0,
      min: 0,
    },
    presentDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    absentDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    leaveDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    workingDays: {
      type: Number,
      default: 26,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'GENERATED', 'PAID'],
      default: 'DRAFT',
      index: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    generatedBy: {
      type: String,
      default: 'SYSTEM',
    },
    paidAt: {
      type: Date,
      default: null,
    },
    paidBy: {
      type: String,
      default: null,
    },
    remarks: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

payslipSchema.index({ beauticianProfileId: 1, payPeriod: 1 }, { unique: true });
payslipSchema.index({ payPeriod: 1, status: 1 });

export const AttendanceModel =
  mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);

export const LeaveRequestModel =
  mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', leaveRequestSchema);

export const PayslipModel =
  mongoose.models.Payslip || mongoose.model('Payslip', payslipSchema);
