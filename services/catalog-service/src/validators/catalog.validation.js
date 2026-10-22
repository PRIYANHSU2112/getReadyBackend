import Joi from 'joi';

export const catalogValidator = {
  createCategory: Joi.object({
    name: Joi.string().trim().required(),
    slug: Joi.string().trim().lowercase().optional(),
    description: Joi.string().trim().optional().allow(null, ''),
    displayOrder: Joi.number().default(0),
    isActive: Joi.boolean().default(true),
  }),

  updateCategory: Joi.object({
    name: Joi.string().trim().optional(),
    slug: Joi.string().trim().lowercase().optional(),
    description: Joi.string().trim().optional().allow(null, ''),
    displayOrder: Joi.number().optional(),
    isActive: Joi.boolean().optional(),
  }),

  createService: Joi.object({
    name: Joi.string().trim().required(),
    slug: Joi.string().trim().lowercase().optional(),
    categoryId: Joi.string().required(),
    description: Joi.string().trim().optional().allow(null, ''),
    shortDescription: Joi.string().trim().optional().allow(null, ''),
    price: Joi.number().min(0).required(),
    discountedPrice: Joi.number().min(0).optional().allow(null),
    durationMinMinutes: Joi.number().min(5).default(30),
    durationMaxMinutes: Joi.number().min(5).default(45),
    homeVisitFee: Joi.number().min(0).default(0),
    badges: Joi.array().items(Joi.string()).optional(),
    gender: Joi.string().valid('all', 'female', 'male', 'unisex').default('all'),
    status: Joi.string().valid('PENDING_APPROVAL', 'APPROVED', 'REJECTED').default('APPROVED'),
  }),

  updateService: Joi.object({
    name: Joi.string().trim().optional(),
    slug: Joi.string().trim().lowercase().optional(),
    categoryId: Joi.string().optional(),
    description: Joi.string().trim().optional().allow(null, ''),
    shortDescription: Joi.string().trim().optional().allow(null, ''),
    price: Joi.number().min(0).optional(),
    discountedPrice: Joi.number().min(0).optional().allow(null),
    durationMinMinutes: Joi.number().min(5).optional(),
    durationMaxMinutes: Joi.number().min(5).optional(),
    homeVisitFee: Joi.number().min(0).optional(),
    badges: Joi.array().items(Joi.string()).optional(),
    gender: Joi.string().valid('all', 'female', 'male', 'unisex').optional(),
    status: Joi.string().valid('PENDING_APPROVAL', 'APPROVED', 'REJECTED').optional(),
    isActive: Joi.boolean().optional(),
  }),

  createPackage: Joi.object({
    name: Joi.string().trim().required(),
    slug: Joi.string().trim().lowercase().optional(),
    categoryId: Joi.string().required(),
    description: Joi.string().trim().optional().allow(null, ''),
    price: Joi.number().min(0).required(),
    originalPrice: Joi.number().min(0).optional().allow(null),
    discountedPrice: Joi.number().min(0).optional().allow(null),
    minSelectCount: Joi.number().min(1).default(1),
    maxSelectCount: Joi.number().min(1).default(1),
    selectionNotice: Joi.string().trim().optional().allow(null, ''),
    durationMinMinutes: Joi.number().min(5).default(60),
    durationMaxMinutes: Joi.number().min(5).default(90),
    badges: Joi.array().items(Joi.string()).optional(),
    items: Joi.array().items(
      Joi.object({
        serviceId: Joi.string().required(),
        name: Joi.string().trim().optional(),
        isMandatory: Joi.boolean().default(false),
        isDefaultSelected: Joi.boolean().default(true),
        extraCharge: Joi.number().min(0).default(0),
        durationMinMinutes: Joi.number().default(30),
      }),
    ).optional(),
  }),

  createFilter: Joi.object({
    name: Joi.string().trim().required(),
    slug: Joi.string().trim().lowercase().optional(),
    displayType: Joi.string().valid('chips', 'checkbox', 'radio', 'dropdown', 'range').default('chips'),
    selectionType: Joi.string().valid('single', 'multiple').default('single'),
    displayOrder: Joi.number().default(0),
    isActive: Joi.boolean().default(true),
  }),

  createFilterValue: Joi.object({
    label: Joi.string().trim().required(),
    value: Joi.string().trim().required(),
    displayOrder: Joi.number().default(0),
  }),

  createHygieneKit: Joi.object({
    title: Joi.string().trim().required(),
    description: Joi.string().trim().optional().allow(null, ''),
    price: Joi.number().min(0).default(49),
    items: Joi.array().items(Joi.string()).optional(),
    isDefault: Joi.boolean().default(false),
  }),

  validateCoupon: Joi.object({
    code: Joi.string().trim().required(),
    amount: Joi.number().min(0).default(0),
    userId: Joi.string().trim().optional().allow(null, ''),
  }),

  redeemCoupon: Joi.object({
    code: Joi.string().trim().required(),
    amount: Joi.number().min(0).required(),
    orderId: Joi.string().trim().required(),
    userId: Joi.string().trim().required(),
  }),

  releaseCoupon: Joi.object({
    orderId: Joi.string().trim().required(),
    couponId: Joi.string().trim().optional(),
    userId: Joi.string().trim().optional().allow(null, ''),
    reason: Joi.string().trim().optional().allow(null, ''),
  }),

  createCoupon: Joi.object({
    code: Joi.string().trim().required(),
    name: Joi.string().trim().optional().allow(null, ''),
    description: Joi.string().trim().optional().allow(null, ''),
    discountType: Joi.string().valid('FLAT', 'PERCENTAGE').default('FLAT'),
    discountValue: Joi.number().min(0).required(),
    minOrderValue: Joi.number().min(0).default(0),
    maxDiscountAmount: Joi.number().min(0).optional().allow(null),
    usageLimit: Joi.number().min(1).default(1000),
    perUserLimit: Joi.number().min(1).default(1),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'EXPIRED').default('ACTIVE'),
    validFrom: Joi.date().optional(),
    validTo: Joi.date().optional(),
    isActive: Joi.boolean().default(true),
  }),
};

