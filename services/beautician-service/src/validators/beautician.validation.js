import Joi from 'joi';

export const beauticianValidator = {
  createProfile: Joi.object({
    bio: Joi.string().trim().max(1000).optional().allow(null, ''),
    experienceYears: Joi.number().min(0).max(50).default(0),
    skills: Joi.array().items(Joi.string()).default([]),
  }),

  updateProfile: Joi.object({
    bio: Joi.string().trim().max(1000).optional().allow(null, ''),
    experienceYears: Joi.number().min(0).max(50).optional(),
    skills: Joi.array().items(Joi.string()).optional(),
  }),

  createWorkHistory: Joi.object({
    companyName: Joi.string().trim().required(),
    role: Joi.string().trim().required(),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().optional().allow(null),
    isCurrent: Joi.boolean().default(false),
    description: Joi.string().trim().optional().allow(null, ''),
  }),

  createCertificate: Joi.object({
    title: Joi.string().trim().required(),
    issuingOrganization: Joi.string().trim().required(),
    issueDate: Joi.date().iso().required(),
    expiryDate: Joi.date().iso().optional().allow(null),
  }),

  createSkill: Joi.object({
    name: Joi.string().trim().required(),
    slug: Joi.string().trim().lowercase().optional(),
    description: Joi.string().trim().optional().allow(null, ''),
    displayOrder: Joi.number().default(0),
    isActive: Joi.boolean().default(true),
  }),

  createBankDetail: Joi.object({
    accountHolderName: Joi.string().trim().required(),
    accountNumber: Joi.string().trim().required(),
    ifscCode: Joi.string().trim().uppercase().required(),
    bankName: Joi.string().trim().optional().allow(null, ''),
    branchName: Joi.string().trim().optional().allow(null, ''),
    upiId: Joi.string().trim().optional().allow(null, ''),
  }),

  adminCreateProfile: Joi.object({
    userId: Joi.string().optional().allow(null, ''),
    // User Identity fields
    name: Joi.string().trim().required(),
    email: Joi.string().email().trim().lowercase().optional().allow(null, ''),
    phone: Joi.string().trim().required(),
    gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', 'male', 'female', 'other').default('female'),
    dob: Joi.date().iso().optional().allow(null),
    languages: Joi.array().items(Joi.string().trim()).default(['Hindi', 'English']),
    alternatePhone: Joi.string().trim().optional().allow(null, ''),
    emergencyContact: Joi.object({
      name: Joi.string().trim().optional().allow(null, ''),
      phone: Joi.string().trim().optional().allow(null, ''),
      relation: Joi.string().trim().optional().allow(null, ''),
    }).optional(),
    bio: Joi.string().trim().max(1000).optional().allow(null, ''),
    profilePhoto: Joi.object({
      url: Joi.string().optional().allow(null, ''),
      publicId: Joi.string().optional().allow(null, ''),
    }).optional(),

    // Address & Area
    address: Joi.object({
      line1: Joi.string().trim().optional().allow(''),
      line2: Joi.string().trim().optional().allow(''),
      city: Joi.string().trim().default('Bhopal'),
      state: Joi.string().trim().default('Madhya Pradesh'),
      pincode: Joi.string().trim().default('462003'),
      country: Joi.string().trim().default('India'),
      location: Joi.object({
        type: Joi.string().valid('Point').default('Point'),
        coordinates: Joi.array().items(Joi.number()).length(2).default([77.4126, 23.2599]),
      }).optional(),
    }).optional(),
    serviceRadiusKm: Joi.number().min(1).max(100).default(8),
    operationalArea: Joi.string().trim().optional().allow(null, ''),

    // Working hours & fleet
    operationalStatus: Joi.string().valid('ONLINE', 'OFFLINE', 'BUSY', 'AVAILABLE', 'ON_LEAVE', 'SUSPENDED').default('AVAILABLE'),
    isAvailable: Joi.boolean().default(true),
    workingHours: Joi.object({
      start: Joi.string().default('09:00'),
      end: Joi.string().default('18:00'),
    }).optional(),
    workingDays: Joi.array().items(Joi.string()).default(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
    breaks: Joi.array().items(Joi.object({
      start: Joi.string().required(),
      end: Joi.string().required(),
      label: Joi.string().default('Break'),
    })).optional(),

    // Skills & Services
    experienceYears: Joi.number().min(0).max(50).default(1),
    skills: Joi.array().items(Joi.string()).default([]),
    skillDetails: Joi.array().items(Joi.object({
      skillId: Joi.string().optional().allow(null, ''),
      skillName: Joi.string().required(),
      experienceYears: Joi.number().default(1),
      proficiency: Joi.string().valid('BEGINNER', 'INTERMEDIATE', 'EXPERT', 'MASTER').default('EXPERT'),
      isActive: Joi.boolean().default(true),
    })).optional(),
    eligibleServiceIds: Joi.array().items(Joi.string()).default([]),

    // Work History & Certificates (Optional during multi-step create)
    workHistory: Joi.array().items(Joi.object({
      companyName: Joi.string().required(),
      role: Joi.string().required(),
      startDate: Joi.date().iso().required(),
      endDate: Joi.date().iso().optional().allow(null),
      isCurrent: Joi.boolean().default(false),
      description: Joi.string().optional().allow(null, ''),
    })).optional(),

    certificates: Joi.array().items(Joi.object({
      title: Joi.string().required(),
      issuingOrganization: Joi.string().required(),
      issueDate: Joi.date().iso().required(),
      expiryDate: Joi.date().iso().optional().allow(null),
      certificateImage: Joi.object({
        url: Joi.string().optional().allow(null, ''),
        publicId: Joi.string().optional().allow(null, ''),
      }).optional(),
    })).optional(),

    // Bank Details
    bankDetails: Joi.object({
      accountHolderName: Joi.string().optional().allow(null, ''),
      accountNumber: Joi.string().optional().allow(null, ''),
      ifscCode: Joi.string().optional().allow(null, ''),
      bankName: Joi.string().optional().allow(null, ''),
      branchName: Joi.string().optional().allow(null, ''),
      upiId: Joi.string().optional().allow(null, ''),
    }).optional(),

    // Documents
    documents: Joi.array().items(Joi.object({
      docType: Joi.string().valid('aadhaar_front', 'aadhaar_back', 'pan', 'license', 'police_verification', 'insurance', 'other').required(),
      docNumber: Joi.string().optional().allow(null, ''),
      file: Joi.object({
        url: Joi.string().optional().allow(null, ''),
        publicId: Joi.string().optional().allow(null, ''),
      }).optional(),
      status: Joi.string().valid('NOT_UPLOADED', 'PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED').default('PENDING'),
    })).optional(),

    // Selfie
    selfieWithId: Joi.object({
      url: Joi.string().optional().allow(null, ''),
      publicId: Joi.string().optional().allow(null, ''),
    }).optional(),

    // Status & Verification
    isDraft: Joi.boolean().default(false),
    status: Joi.string().valid('DRAFT', 'INCOMPLETE', 'SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED').default('DRAFT'),
    kycStatus: Joi.string().valid('NOT_SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED').optional().allow(null, ''),
    selfieVerification: Joi.object({
      status: Joi.string().valid('PENDING', 'VERIFIED', 'FAILED', 'NEEDS_REVERIFICATION').default('PENDING'),
      verifiedAt: Joi.date().iso().optional().allow(null),
      remarks: Joi.string().optional().allow(null, ''),
    }).optional(),
  }).unknown(true),

  adminReviewProfile: Joi.object({
    status: Joi.string().valid('APPROVED', 'REJECTED', 'SUSPENDED', 'UNDER_REVIEW', 'DRAFT', 'PENDING', 'ACTIVE', 'INACTIVE', 'approved', 'rejected', 'suspended', 'under_review', 'draft', 'pending', 'active', 'inactive').insensitive().required(),
    operationalStatus: Joi.string().valid('ONLINE', 'OFFLINE', 'BUSY', 'AVAILABLE', 'ON_LEAVE', 'SUSPENDED', 'online', 'offline', 'busy', 'available', 'on_leave', 'suspended').insensitive().optional().allow(null, ''),
    rejectionReason: Joi.when('status', {
      is: Joi.string().valid('REJECTED', 'rejected'),
      then: Joi.string().trim().min(3).required(),
      otherwise: Joi.string().trim().optional().allow(null, ''),
    }),
    id: Joi.string().optional().allow(null, ''),
    _id: Joi.string().optional().allow(null, ''),
    verificationStatus: Joi.string().optional().allow(null, ''),
  }).unknown(true),

  adminReviewKyc: Joi.object({
    kycStatus: Joi.string().valid('VERIFIED', 'REJECTED', 'UNDER_REVIEW', 'PENDING').required(),
    kycRejectionReason: Joi.when('kycStatus', {
      is: 'REJECTED',
      then: Joi.string().trim().min(3).required(),
      otherwise: Joi.string().trim().optional().allow(null, ''),
    }),
  }),

  reviewKycDocument: Joi.object({
    status: Joi.string().valid('VERIFIED', 'REJECTED', 'UNDER_REVIEW', 'EXPIRED', 'PENDING').required(),
    rejectionReason: Joi.when('status', {
      is: 'REJECTED',
      then: Joi.string().trim().min(3).required(),
      otherwise: Joi.string().trim().optional().allow(null, ''),
    }),
  }),

  reviewSelfie: Joi.object({
    status: Joi.string().valid('VERIFIED', 'FAILED', 'NEEDS_REVERIFICATION', 'PENDING').required(),
    remarks: Joi.string().trim().optional().allow(null, ''),
  }),

  requestReupload: Joi.object({
    docType: Joi.string().required(),
    reason: Joi.string().trim().min(3).required(),
  }),

  updateEligibleServices: Joi.object({
    serviceIds: Joi.array().items(Joi.string()).required(),
  }),

  updateAvailability: Joi.object({
    isAvailable: Joi.boolean().optional(),
    operationalStatus: Joi.string().valid('ONLINE', 'OFFLINE', 'BUSY', 'AVAILABLE', 'ON_LEAVE', 'SUSPENDED').optional(),
    serviceRadiusKm: Joi.number().min(1).max(100).optional(),
    workingHours: Joi.object({
      start: Joi.string().required(),
      end: Joi.string().required(),
    }).optional(),
    workingDays: Joi.array().items(Joi.string()).optional(),
    breaks: Joi.array().items(Joi.object({
      start: Joi.string().required(),
      end: Joi.string().required(),
      label: Joi.string().default('Break'),
    })).optional(),
  }),
};
