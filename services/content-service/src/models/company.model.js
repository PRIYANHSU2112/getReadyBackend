import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: 'Bangalore' },
    state: { type: String, trim: true, default: 'Karnataka' },
    postalCode: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: 'India' },
  },
  { _id: false },
);

const companySchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true, index: true },

    // Identity & Legal details
    legalName: { type: String, trim: true, default: 'GetReady Beauty Tech Private Limited' },
    brandName: { type: String, trim: true, default: 'GET READY' },
    cin: { type: String, trim: true, default: 'U74999KA2024PTC189012' },
    gstin: { type: String, trim: true, default: '29ABCDE1234F1Z5' },
    pan: { type: String, trim: true, default: 'ABCDE1234F' },
    foundingYear: { type: Number, default: 2024 },

    // Contact Information
    supportEmail: { type: String, trim: true, default: 'support@getready.in' },
    businessEmail: { type: String, trim: true, default: 'business@getready.in' },
    pressEmail: { type: String, trim: true, default: 'press@getready.in' },
    supportPhone: { type: String, trim: true, default: '+91 98765 43210' },
    businessPhone: { type: String, trim: true, default: '+91 80 4567 8900' },
    whatsappNumber: { type: String, trim: true, default: '+91 98765 43210' },
    workingHours: { type: String, trim: true, default: 'Monday – Sunday: 8:00 AM – 9:00 PM IST' },

    // Addresses
    registeredAddress: { type: addressSchema, default: () => ({ street: 'Plot No. 42, HSR Layout, Sector 2', city: 'Bangalore', state: 'Karnataka', postalCode: '560102', country: 'India' }) },
    corporateAddress: { type: addressSchema, default: () => ({ street: 'Level 4, Prestige Tech Park, Marathahalli', city: 'Bangalore', state: 'Karnataka', postalCode: '560103', country: 'India' }) },

    // Grievance Redressal (Mandatory under Indian IT Rules / Consumer Protection)
    grievanceOfficer: {
      name: { type: String, trim: true, default: 'Arjun Verma' },
      designation: { type: String, trim: true, default: 'Head of Customer Experience & Grievances' },
      email: { type: String, trim: true, default: 'grievance@getready.in' },
      phone: { type: String, trim: true, default: '+91 80 4567 8999' },
      address: { type: String, trim: true, default: 'Level 4, Prestige Tech Park, Marathahalli, Bangalore, Karnataka 560103' },
    },

    // Master Policies
    policies: {
      termsAndConditions: {
        type: String,
        default: '## Terms and Conditions\n\nWelcome to GET READY. By accessing or using our on-demand doorstep salon and beauty services, you agree to be bound by these Terms and Conditions. All beauticians operating on our platform are verified independent certified professionals. Service satisfaction and hygiene guarantee apply to all completed sessions.',
      },
      privacyPolicy: {
        type: String,
        default: '## Privacy Policy\n\nGET READY respects your personal privacy. We collect minimal personal data including name, mobile phone number, location, and service preferences solely to dispatch beauticians, process payments securely, and guarantee on-time service delivery. We do not sell user data to third parties.',
      },
      cancellationPolicy: {
        type: String,
        default: '## Cancellation & Rescheduling Policy\n\n- Cancellations made 6 hours before scheduled time: 100% FREE.\n- Cancellations between 6 to 2 hours before scheduled time: Nominal fee of up to ₹100.\n- Cancellations within 2 hours: Convenience fee of up to ₹200 applies.\n- If our beautician is delayed by more than 15 minutes, ALL cancellation fees are 100% waived.',
      },
      refundPolicy: {
        type: String,
        default: '## Refund & Dispute Policy\n\nEligible refunds are credited directly to your GET READY Wallet immediately, or refunded to the original payment source (UPI/Card/NetBanking) within 3-5 business days upon customer support approval.',
      },
      hygieneProtocol: {
        type: String,
        default: '## Industry-Leading Hygiene Protocol\n\n1. Single-use sealed hygiene kit (₹49) opened right in front of the customer.\n2. Alcohol sanitization wipes for all tools before and after treatment.\n3. Single-use disposable bedsheets, headbands, and aprons for sterile safety.',
      },
      partnerCodeOfConduct: {
        type: String,
        default: '## Beautician Partner Code of Conduct\n\nAll verified partners must adhere to strict zero-tolerance harassment policies, punctual arrival standards, verified identity badges, and complete customer privacy protocols.',
      },
    },

    // Branding & Assets
    branding: {
      primaryLogoUrl: { type: String, default: null },
      darkLogoUrl: { type: String, default: null },
      faviconUrl: { type: String, default: null },
      tagline: { type: String, default: 'Salon-quality beauty, right at your home.' },
      primaryColor: { type: String, default: '#E11D48' },
    },

    // Social Links
    socials: {
      instagram: { type: String, default: 'https://instagram.com/getready' },
      facebook: { type: String, default: 'https://facebook.com/getready' },
      youtube: { type: String, default: 'https://youtube.com/@getready' },
      linkedin: { type: String, default: 'https://linkedin.com/company/getready' },
      twitter: { type: String, default: 'https://x.com/getready' },
    },
  },
  { timestamps: true },
);

companySchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  obj.id = obj._id?.toString();
  return obj;
};

export const CompanyModel =
  mongoose.models.Company || mongoose.model('Company', companySchema);
export default CompanyModel;
