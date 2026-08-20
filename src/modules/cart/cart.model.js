import mongoose from 'mongoose';
import { CartItemType } from '../../common/constants/enums.js';
import {
  MAX_ITEM_QUANTITY,
  MAX_SPECIAL_INSTRUCTIONS_LENGTH,
  CART_CURRENCY,
} from '../../common/constants/cart.js';

const selectedServiceSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    name: { type: String, trim: true, required: true },
    durationMin: { type: Number, default: null, min: 0 },
  },
  { _id: false },
);

const packageMetaSchema = new mongoose.Schema(
  {
    subtitle: { type: String, trim: true, default: null },
    selectionRule: {
      minSelect: { type: Number, default: null, min: 0 },
      maxSelect: { type: Number, default: null, min: 0 },
    },
  },
  { _id: false },
);

const snapshotSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    thumbnail: { type: String, trim: true, default: null },
    durationLabel: { type: String, trim: true, default: null },
    badges: { type: [{ type: String, trim: true }], default: [] },
    unitPrice: { type: Number, required: true, min: 0 },
    mrp: { type: Number, default: null, min: 0 },
    rating: { type: Number, default: null, min: 0, max: 5 },
    homeVisitFee: { type: Number, default: 0, min: 0 },
    extraCharge: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const forMemberSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    relationship: { type: String, trim: true, default: null },
    avatarUrl: { type: String, trim: true, default: null },
    phone: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const cartItemSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      enum: Object.values(CartItemType),
      required: true,
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_ITEM_QUANTITY,
      default: 1,
    },
    snapshot: { type: snapshotSchema, required: true },
    packageMeta: { type: packageMetaSchema, default: null },
    selectedServices: { type: [selectedServiceSchema], default: [] },
    /** null = booking for Self (payer) */
    forMemberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      default: null,
    },
    forMemberSnapshot: { type: forMemberSnapshotSchema, default: null },
  },
  { _id: true },
);

const cartHygieneKitSchema = new mongoose.Schema(
  {
    hygieneKitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HygieneKit',
      default: null,
    },
    count: {
      type: Number,
      default: 1,
      min: 1,
      max: 20,
    },
  },
  { _id: false },
);


const benefitsSchema = new mongoose.Schema(
  {
    couponCode: { type: String, trim: true, uppercase: true, default: null },
    usePoints: { type: Boolean, default: false },
    useCashback: { type: Boolean, default: false },
    membershipOptIn: { type: Boolean, default: false },
  },
  { _id: false },
);

const upsellSchema = new mongoose.Schema(
  {
    amountToWaiveVisitFee: { type: Number, default: 0, min: 0 },
    message: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const pricingSchema = new mongoose.Schema(
  {
    itemsSubtotal: { type: Number, default: 0, min: 0 },
    hygieneKitTotal: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, default: 0, min: 0 },
    visitFee: { type: Number, default: 0, min: 0 },
    visitFeeWaived: { type: Boolean, default: false },
    couponDiscount: { type: Number, default: 0, min: 0 },
    pointsDeduction: { type: Number, default: 0, min: 0 },
    cashbackDeduction: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, default: 0, min: 0 },
    savings: { type: Number, default: 0, min: 0 },
    earnPoints: { type: Number, default: 0, min: 0 },
    upsell: { type: upsellSchema, default: null },
    currency: { type: String, default: CART_CURRENCY, trim: true, uppercase: true },
    computedAt: { type: Date, default: null },
  },
  { _id: false },
);

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    items: {
      type: [cartItemSchema],
      default: [],
    },
    hygieneKit: {
      type: cartHygieneKitSchema,
      default: null,
    },
    specialInstructions: {
      type: String,
      trim: true,
      default: null,
      maxlength: MAX_SPECIAL_INSTRUCTIONS_LENGTH,
    },
    benefits: {
      type: benefitsSchema,
      default: () => ({}),
    },
    pricing: {
      type: pricingSchema,
      default: null,
    },
    expiresAt: { type: Date, default: null, index: true },
    checkedOutAt: { type: Date, default: null },
  },
  { timestamps: true },
);


cartSchema.index({ 'items.refId': 1 });

cartSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const CartModel = mongoose.models.Cart || mongoose.model('Cart', cartSchema);

export default CartModel;
