import mongoose from 'mongoose';
import { BankVerificationStatus } from '../../common/constants/enums.js';
import {
  IFSC_REGEX,
  MAX_ACCOUNT_HOLDER_NAME_LENGTH,
  MAX_ACCOUNT_NUMBER_LENGTH,
  MAX_BANK_NAME_LENGTH,
  MAX_BRANCH_NAME_LENGTH,
  MAX_UPI_ID_LENGTH,
} from '../../common/constants/bank-detail.js';

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: null },
    publicId: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const bankDetailSchema = new mongoose.Schema(
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
      unique: true,
      index: true,
    },
    accountHolderName: {
      type: String,
      required: [true, 'Account holder name is required'],
      trim: true,
      maxlength: [MAX_ACCOUNT_HOLDER_NAME_LENGTH, `Account holder name cannot exceed ${MAX_ACCOUNT_HOLDER_NAME_LENGTH} characters`],
    },
    accountNumber: {
      type: String,
      required: [true, 'Account number is required'],
      trim: true,
      maxlength: [MAX_ACCOUNT_NUMBER_LENGTH, `Account number cannot exceed ${MAX_ACCOUNT_NUMBER_LENGTH} characters`],
    },
    ifscCode: {
      type: String,
      required: [true, 'IFSC code is required'],
      trim: true,
      uppercase: true,
      match: [IFSC_REGEX, 'Invalid IFSC code format'],
    },
    bankName: {
      type: String,
      trim: true,
      maxlength: [MAX_BANK_NAME_LENGTH, `Bank name cannot exceed ${MAX_BANK_NAME_LENGTH} characters`],
      default: null,
    },
    branchName: {
      type: String,
      trim: true,
      maxlength: [MAX_BRANCH_NAME_LENGTH, `Branch name cannot exceed ${MAX_BRANCH_NAME_LENGTH} characters`],
      default: null,
    },
    passbookImage: {
      type: mediaSchema,
      default: () => ({ url: null, publicId: null }),
    },
    upiId: {
      type: String,
      trim: true,
      maxlength: [MAX_UPI_ID_LENGTH, `UPI ID cannot exceed ${MAX_UPI_ID_LENGTH} characters`],
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(BankVerificationStatus),
      default: BankVerificationStatus.PENDING,
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

bankDetailSchema.index({ userId: 1, deletedAt: 1 });
bankDetailSchema.index({ beauticianProfileId: 1, deletedAt: 1 });
bankDetailSchema.index({ status: 1, deletedAt: 1 });

bankDetailSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  if (obj.accountNumber && obj.accountNumber.length > 4) {
    obj.maskedAccountNumber = '****' + obj.accountNumber.slice(-4);
  }
  return obj;
};

export const BankDetailModel =
  mongoose.models.BankDetail ||
  mongoose.model('BankDetail', bankDetailSchema, 'bank_details');

export default BankDetailModel;
