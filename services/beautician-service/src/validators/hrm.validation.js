import Joi from 'joi';

export const hrmValidator = {
  submitLeave: Joi.object({
    leaveType: Joi.string().valid('CL', 'SL', 'PL', 'EMERGENCY').required(),
    duration: Joi.string().valid('FULL_DAY', 'HALF_DAY').default('FULL_DAY'),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(),
    reason: Joi.string().trim().max(500).required(),
  }),

  adminReviewLeave: Joi.object({
    status: Joi.string().valid('APPROVED', 'REJECTED').required(),
    adminRemarks: Joi.string().trim().max(500).optional().allow(null, ''),
  }),

  adminMarkAttendance: Joi.object({
    beauticianProfileId: Joi.string().optional(),
    profileId: Joi.string().optional(),
    status: Joi.string().valid('PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY').required(),
    date: Joi.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    punchIn: Joi.date().iso().optional().allow(null),
    punchOut: Joi.date().iso().optional().allow(null),
    totalHoursWorked: Joi.number().min(0).max(24).optional(),
    remarks: Joi.string().trim().max(500).optional().allow(null, ''),
  }),

  generatePayslip: Joi.object({
    beauticianId: Joi.string().required(),
    month: Joi.number().integer().min(1).max(12).required(),
    year: Joi.number().integer().min(2020).max(2100).required(),
    totalBookings: Joi.number().integer().min(0).default(0),
    totalEarnings: Joi.number().min(0).default(0),
    platformCommission: Joi.number().min(0).default(0),
    bonuses: Joi.number().min(0).default(0),
    deductions: Joi.number().min(0).default(0),
    remarks: Joi.string().trim().max(500).optional().allow(null, ''),
  }),
};
