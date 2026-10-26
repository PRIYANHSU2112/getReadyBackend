import { ApiResponse } from '@getready/errors';

export class CompanyController {
  constructor(companyService) {
    this.companyService = companyService;
  }

  getProfile = async (_req, res) => {
    const data = await this.companyService.getProfile();
    return ApiResponse.success(res, data, 'Company profile retrieved successfully');
  };

  updateProfile = async (req, res) => {
    const data = await this.companyService.updateProfile(req.body);
    return ApiResponse.success(res, data, 'Company profile updated successfully');
  };

  getPolicy = async (req, res) => {
    const { type } = req.params;
    const data = await this.companyService.getPolicy(type);
    return ApiResponse.success(res, data, `Company ${type} policy retrieved successfully`);
  };
}
