import { ApiResponse } from '@getready/errors';

export class LandingController {
  constructor(landingService) {
    this.landingService = landingService;
  }

  getLanding = async (_req, res) => {
    const data = await this.landingService.getPublicLandingData();
    return ApiResponse.success(res, data, 'Landing CMS data fetched successfully');
  };

  updateLanding = async (req, res) => {
    const data = await this.landingService.updateLandingConfig(req.body);
    return ApiResponse.success(res, data, 'Landing CMS configuration updated successfully');
  };

  listFaqs = async (req, res) => {
    const isAdmin = req.query.admin === 'true';
    const faqs = await this.landingService.listFaqs(isAdmin);
    return ApiResponse.success(res, faqs, 'FAQs fetched successfully');
  };

  createFaq = async (req, res) => {
    const faq = await this.landingService.createFaq(req.body);
    return ApiResponse.created(res, faq, 'FAQ created successfully');
  };

  updateFaq = async (req, res) => {
    const faq = await this.landingService.updateFaq(req.params.id, req.body);
    return ApiResponse.success(res, faq, 'FAQ updated successfully');
  };

  deleteFaq = async (req, res) => {
    await this.landingService.deleteFaq(req.params.id);
    return ApiResponse.success(res, { id: req.params.id }, 'FAQ deleted successfully');
  };
}
