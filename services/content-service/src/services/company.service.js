export class CompanyService {
  constructor(companyRepo) {
    this.companyRepo = companyRepo;
  }

  async getProfile() {
    return this.companyRepo.getProfile();
  }

  async updateProfile(data) {
    // Sanitization: don't allow altering key
    const updateData = { ...data };
    delete updateData.key;
    delete updateData._id;
    return this.companyRepo.updateProfile(updateData);
  }

  async getPolicy(type) {
    return this.companyRepo.getPolicy(type);
  }
}
