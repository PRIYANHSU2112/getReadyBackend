import Joi from 'joi';

const phoneRegex = /^[+]?[\d\s-]{10,15}$/;

export const userValidator = {
  createUser: Joi.object({
    name: Joi.string().trim().max(100).required(),
    email: Joi.string().email().optional().allow(null, ''),
    phone: Joi.string().pattern(phoneRegex).optional().allow(null, ''),
    password: Joi.string().min(6).optional().allow(null, ''),
    role: Joi.string().valid('admin', 'super_admin', 'customer', 'beautician', 'ops', 'support').default('customer'),
    gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', 'male', 'female', 'other').optional().allow(null),
    dob: Joi.date().iso().optional().allow(null),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DEACTIVATED').default('ACTIVE'),
    notes: Joi.string().trim().optional().allow(null, ''),
    languages: Joi.array().items(Joi.string().trim()).default(['Hindi', 'English']),
    referralCode: Joi.string().trim().uppercase().optional().allow(null, ''),
    isActive: Joi.boolean().optional(),
  }),

  updateUser: Joi.object({
    name: Joi.string().trim().max(100).optional(),
    email: Joi.string().email().optional().allow(null, ''),
    phone: Joi.string().pattern(phoneRegex).optional().allow(null, ''),
    password: Joi.string().min(6).optional(),
    role: Joi.string().valid('admin', 'super_admin', 'customer', 'beautician', 'ops', 'support').optional(),
    gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', 'male', 'female', 'other').optional().allow(null),
    dob: Joi.date().iso().optional().allow(null),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DEACTIVATED').optional(),
    notes: Joi.string().trim().optional().allow(null, ''),
    languages: Joi.array().items(Joi.string().trim()).optional(),
    isActive: Joi.boolean().optional(),
  }),

  createAddress: Joi.object({
    label: Joi.string().valid('HOME', 'WORK', 'OFFICE', 'OTHER').default('HOME'),
    addressLine1: Joi.string().trim().required(),
    addressLine2: Joi.string().trim().optional().allow(null, ''),
    landmark: Joi.string().trim().optional().allow(null, ''),
    city: Joi.string().trim().required(),
    state: Joi.string().trim().required(),
    pincode: Joi.string().trim().required(),
    location: Joi.object({
      type: Joi.string().valid('Point').default('Point'),
      coordinates: Joi.array().items(Joi.number()).length(2).default([0, 0]),
    }).optional(),
    isDefault: Joi.boolean().default(false),
  }),

  updateAddress: Joi.object({
    label: Joi.string().valid('HOME', 'WORK', 'OFFICE', 'OTHER').optional(),
    addressLine1: Joi.string().trim().optional(),
    addressLine2: Joi.string().trim().optional().allow(null, ''),
    landmark: Joi.string().trim().optional().allow(null, ''),
    city: Joi.string().trim().optional(),
    state: Joi.string().trim().optional(),
    pincode: Joi.string().trim().optional(),
    isDefault: Joi.boolean().optional(),
  }),

  createMember: Joi.object({
    userId: Joi.string().optional().allow(null, ''),
    accountOwnerId: Joi.string().optional().allow(null, ''),
    name: Joi.string().trim().max(100).required(),
    relationship: Joi.string().trim().default('Self'),
    gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', 'male', 'female', 'other').default('FEMALE'),
    age: Joi.number().min(0).max(120).optional().allow(null),
    mobileNumber: Joi.string().pattern(phoneRegex).optional().allow(null, ''),
    phone: Joi.string().pattern(phoneRegex).optional().allow(null, ''),
    skinType: Joi.string().trim().optional().allow(null, ''),
    hairType: Joi.string().trim().optional().allow(null, ''),
    allergies: Joi.array().items(Joi.string().trim()).default([]),
    notes: Joi.string().trim().optional().allow(null, ''),
    avatarUrl: Joi.string().trim().optional().allow(null, ''),
    status: Joi.string().valid('ACTIVE', 'INACTIVE').default('ACTIVE'),
  }),

  updateMember: Joi.object({
    name: Joi.string().trim().max(100).optional(),
    relationship: Joi.string().trim().optional(),
    gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', 'male', 'female', 'other').optional(),
    age: Joi.number().min(0).max(120).optional().allow(null),
    mobileNumber: Joi.string().pattern(phoneRegex).optional().allow(null, ''),
    phone: Joi.string().pattern(phoneRegex).optional().allow(null, ''),
    skinType: Joi.string().trim().optional().allow(null, ''),
    hairType: Joi.string().trim().optional().allow(null, ''),
    allergies: Joi.array().items(Joi.string().trim()).optional(),
    notes: Joi.string().trim().optional().allow(null, ''),
    avatarUrl: Joi.string().trim().optional().allow(null, ''),
    status: Joi.string().valid('ACTIVE', 'INACTIVE').optional(),
  }),

  createRole: Joi.object({
    name: Joi.string().trim().required(),
    slug: Joi.string().trim().lowercase().required(),
    description: Joi.string().trim().optional().allow(null, ''),
    permissions: Joi.array().items(Joi.string()).default([]),
    isActive: Joi.boolean().default(true),
  }),

  updateRole: Joi.object({
    name: Joi.string().trim().optional(),
    description: Joi.string().trim().optional().allow(null, ''),
    permissions: Joi.array().items(Joi.string()).optional(),
    isActive: Joi.boolean().optional(),
  }),
};
