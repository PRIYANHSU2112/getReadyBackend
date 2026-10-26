import { CompanyModel } from '../models/company.model.js';

export class CompanyRepository {
  async getProfile() {
    let profile = await CompanyModel.findOne({ key: 'default' }).lean();
    if (!profile) {
      const created = await CompanyModel.create({ key: 'default' });
      profile = created.toObject();
    }
    return profile;
  }

  async updateProfile(data) {
    return CompanyModel.findOneAndUpdate(
      { key: 'default' },
      { $set: data },
      { new: true, upsert: true },
    ).lean();
  }

  async getPolicy(type) {
    const profile = await this.getProfile();
    const policyMap = {
      terms: profile?.policies?.termsAndConditions,
      privacy: profile?.policies?.privacyPolicy,
      cancellation: profile?.policies?.cancellationPolicy,
      refund: profile?.policies?.refundPolicy,
      hygiene: profile?.policies?.hygieneProtocol,
      partner: profile?.policies?.partnerCodeOfConduct,
    };

    return {
      type,
      policy: policyMap[type] || null,
      updatedAt: profile?.updatedAt,
    };
  }
}
