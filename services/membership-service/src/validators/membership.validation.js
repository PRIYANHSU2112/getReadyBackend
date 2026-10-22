import Joi from 'joi';
import {
  PLAN_STATUS,
  BILLING_CYCLE,
  STACKING_RULE,
} from '../models/index.js';

export const membershipValidator = {
  subscribe: Joi.object({
    planCode: Joi.string().trim().uppercase().default('GLOW_CLUB_MONTHLY'),
    idempotencyKey: Joi.string().trim().optional().allow(null, ''),
  }),

  calculateBenefits: Joi.object({
    items: Joi.array()
      .items(
        Joi.object({
          serviceId: Joi.string().optional(),
          id: Joi.string().optional(),
          name: Joi.string().optional(),
          price: Joi.number().min(0).optional(),
          unitPrice: Joi.number().min(0).optional(),
          quantity: Joi.number().integer().min(1).default(1),
          categoryId: Joi.string().optional().allow(null, ''),
        }),
      )
      .default([]),
    grossSubtotal: Joi.number().min(0).default(0),
    optInRequested: Joi.boolean().default(false),
    requestedPlanCode: Joi.string().trim().uppercase().default('GLOW_CLUB_MONTHLY'),
  }),

  cancelSubscription: Joi.object({
    subscriptionId: Joi.string().trim().required(),
    reason: Joi.string().trim().optional().default('Customer cancelled'),
  }),

  claimEntitlement: Joi.object({
    entitlementId: Joi.string().trim().required(),
    bookingId: Joi.string().trim().required(),
  }),

  addFamilyMember: Joi.object({
    familyUserId: Joi.string().trim().required(),
  }),

  adminCreatePlan: Joi.object({
    planCode: Joi.string().trim().uppercase().required(),
    name: Joi.string().trim().required(),
    description: Joi.string().trim().optional().allow(null, ''),
    displayOrder: Joi.number().integer().default(0),
    price: Joi.number().min(0).required(),
    billingCycle: Joi.string().valid(...Object.values(BILLING_CYCLE)).default(BILLING_CYCLE.MONTHLY),
    durationDays: Joi.number().integer().min(1).default(30),
    discountType: Joi.string().valid('PERCENTAGE', 'FLAT').default('PERCENTAGE'),
    discountValue: Joi.number().min(0).default(15),
    maxDiscountPerBooking: Joi.number().min(0).optional().allow(null).default(500),
    minBookingSubtotal: Joi.number().min(0).default(0),
    applicableCategoryIds: Joi.array().items(Joi.string()).default([]),
    excludedServiceIds: Joi.array().items(Joi.string()).default([]),
    loyaltyMultiplier: Joi.number().min(1.0).default(2.0),
    bonusPointsOnJoin: Joi.number().min(0).default(500),
    complimentaryServices: Joi.array()
      .items(
        Joi.object({
          serviceId: Joi.string().required(),
          name: Joi.string().required(),
          quantityPerCycle: Joi.number().integer().min(1).default(1),
          rolloverAllowed: Joi.boolean().default(true),
          rolloverMaxDays: Joi.number().integer().min(0).default(60),
        }),
      )
      .default([]),
    familySharingAllowed: Joi.boolean().default(true),
    maxFamilyMembers: Joi.number().integer().min(0).default(4),
    stackingRule: Joi.string().valid(...Object.values(STACKING_RULE)).default(STACKING_RULE.CANNOT_STACK_WITH_COUPON),
    marketingConfig: Joi.object({
      badgeText: Joi.string().default('EXCLUSIVE MEMBERSHIP'),
      heroTitle: Joi.string().default('Get Ready. Glow Club.'),
      heroSubtitle: Joi.string().default('One membership. Unlimited beauty. Savings that compound every visit.'),
      bannerImageUrl: Joi.string().optional().allow(null, ''),
      accentColor: Joi.string().default('#FBBF24'),
      perceivedWorthText: Joi.string().default('₹2,400+'),
      cartOptInTitle: Joi.string().default('Join Glow Club & Save More Today'),
      cartOptInSubtitle: Joi.string().default('Get 15% OFF this booking + 500 Welcome Points'),
    }).default({}),
    faqs: Joi.array()
      .items(
        Joi.object({
          question: Joi.string().required(),
          answer: Joi.string().required(),
          displayOrder: Joi.number().integer().default(0),
        }),
      )
      .default([]),
    status: Joi.string().valid(...Object.values(PLAN_STATUS)).default(PLAN_STATUS.ACTIVE),
    isActive: Joi.boolean().default(true),
  }),

  adminUpdatePlan: Joi.object({
    name: Joi.string().trim().optional(),
    description: Joi.string().trim().optional().allow(null, ''),
    displayOrder: Joi.number().integer().optional(),
    price: Joi.number().min(0).optional(),
    billingCycle: Joi.string().valid(...Object.values(BILLING_CYCLE)).optional(),
    durationDays: Joi.number().integer().min(1).optional(),
    discountType: Joi.string().valid('PERCENTAGE', 'FLAT').optional(),
    discountValue: Joi.number().min(0).optional(),
    maxDiscountPerBooking: Joi.number().min(0).optional().allow(null),
    minBookingSubtotal: Joi.number().min(0).optional(),
    applicableCategoryIds: Joi.array().items(Joi.string()).optional(),
    excludedServiceIds: Joi.array().items(Joi.string()).optional(),
    loyaltyMultiplier: Joi.number().min(1.0).optional(),
    bonusPointsOnJoin: Joi.number().min(0).optional(),
    complimentaryServices: Joi.array().optional(),
    familySharingAllowed: Joi.boolean().optional(),
    maxFamilyMembers: Joi.number().integer().min(0).optional(),
    stackingRule: Joi.string().valid(...Object.values(STACKING_RULE)).optional(),
    marketingConfig: Joi.object().optional(),
    faqs: Joi.array().optional(),
    status: Joi.string().valid(...Object.values(PLAN_STATUS)).optional(),
    isActive: Joi.boolean().optional(),
  }),

  adminStatusUpdate: Joi.object({
    status: Joi.string().valid(...Object.values(PLAN_STATUS)).required(),
  }),
};

export default membershipValidator;
