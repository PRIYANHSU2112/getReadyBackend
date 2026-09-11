export class LandingService {
  constructor(landingRepo, faqRepo) {
    this.landingRepo = landingRepo;
    this.faqRepo = faqRepo;
  }

  async getPublicLandingData() {
    const [landingConfig, faqs] = await Promise.all([
      this.landingRepo.getLandingConfig(),
      this.faqRepo.listPublic(),
    ]);

    return {
      ...landingConfig,
      faqs,
    };
  }

  async updateLandingConfig(data) {
    return this.landingRepo.updateLandingConfig(data);
  }

  async listFaqs(isAdmin = false) {
    return isAdmin ? this.faqRepo.listAll() : this.faqRepo.listPublic();
  }

  async createFaq(data) {
    return this.faqRepo.create(data);
  }

  async updateFaq(id, data) {
    return this.faqRepo.updateById(id, data);
  }

  async deleteFaq(id) {
    return this.faqRepo.deleteById(id);
  }
}
