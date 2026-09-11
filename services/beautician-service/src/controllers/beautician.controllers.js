import { ApiResponse, HttpStatus } from '@getready/errors';

export class BeauticianProfileController {
  constructor(profileService) {
    this.profileService = profileService;
  }

  getMyProfile = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const profile = await this.profileService.getMyProfile(userId);
    return ApiResponse.success(res, profile, 'Profile fetched successfully');
  };

  createProfile = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const profile = await this.profileService.createProfile(userId, req.body);
    return ApiResponse.created(res, profile, 'Profile created successfully');
  };

  updateProfile = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const profile = await this.profileService.updateProfile(userId, req.body);
    return ApiResponse.success(res, profile, 'Profile updated successfully');
  };

  uploadSelfie = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const profile = await this.profileService.uploadSelfie(userId, req.files || {});
    return ApiResponse.success(res, profile, 'KYC documents uploaded successfully');
  };

  submitForReview = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const profile = await this.profileService.submitForReview(userId);
    return ApiResponse.success(res, profile, 'Submitted for review successfully');
  };

  // Work History
  getWorkHistory = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const items = await this.profileService.getWorkHistory(userId);
    return ApiResponse.success(res, items, 'Work history fetched successfully');
  };

  addWorkHistory = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const item = await this.profileService.addWorkHistory(userId, req.body);
    return ApiResponse.created(res, item, 'Work history added successfully');
  };

  updateWorkHistory = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const item = await this.profileService.updateWorkHistory(userId, req.params.id, req.body);
    return ApiResponse.success(res, item, 'Work history updated successfully');
  };

  deleteWorkHistory = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    await this.profileService.deleteWorkHistory(userId, req.params.id);
    return ApiResponse.success(res, { id: req.params.id }, 'Work history deleted successfully');
  };

  // Certificates
  getCertificates = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const items = await this.profileService.getCertificates(userId);
    return ApiResponse.success(res, items, 'Certificates fetched successfully');
  };

  addCertificate = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const item = await this.profileService.addCertificate(userId, req.body, req.file);
    return ApiResponse.created(res, item, 'Certificate added successfully');
  };

  updateCertificate = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const item = await this.profileService.updateCertificate(userId, req.params.id, req.body, req.file);
    return ApiResponse.success(res, item, 'Certificate updated successfully');
  };

  deleteCertificate = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    await this.profileService.deleteCertificate(userId, req.params.id);
    return ApiResponse.success(res, { id: req.params.id }, 'Certificate deleted successfully');
  };

  // Admin
  adminCreate = async (req, res) => {
    const adminId = req.headers['x-user-id'] || req.user?.id;
    const profile = await this.profileService.adminCreateProfile(req.body, adminId);
    return ApiResponse.created(res, profile, 'Beautician created successfully');
  };

  listProfiles = async (req, res) => {
    const result = await this.profileService.listProfiles(req.query);
    return ApiResponse.paginated(res, result.items, result.meta, 'Profiles fetched successfully');
  };

  getProfileById = async (req, res) => {
    const profile = await this.profileService.getProfileById(req.params.id);
    return ApiResponse.success(res, profile, 'Profile fetched successfully');
  };

  getKycQueue = async (req, res) => {
    const result = await this.profileService.getKycQueue(req.query);
    return ApiResponse.paginated(res, result.items, result.meta, 'KYC Queue fetched successfully');
  };

  reviewKycDocument = async (req, res) => {
    const adminId = req.headers['x-user-id'] || req.user?.id;
    const profile = await this.profileService.reviewKycDocument(
      req.params.id,
      req.params.docId,
      req.body,
      adminId,
    );
    return ApiResponse.success(res, profile, 'Document reviewed successfully');
  };

  reviewKycSelfie = async (req, res) => {
    const adminId = req.headers['x-user-id'] || req.user?.id;
    const profile = await this.profileService.reviewKycSelfie(req.params.id, req.body, adminId);
    return ApiResponse.success(res, profile, 'Selfie review updated successfully');
  };

  requestReupload = async (req, res) => {
    const adminId = req.headers['x-user-id'] || req.user?.id;
    const profile = await this.profileService.requestReupload(req.params.id, req.body, adminId);
    return ApiResponse.success(res, profile, 'Document re-upload requested successfully');
  };

  updateEligibleServices = async (req, res) => {
    const adminId = req.headers['x-user-id'] || req.user?.id;
    const profile = await this.profileService.updateEligibleServices(
      req.params.id,
      req.body.serviceIds,
      adminId,
    );
    return ApiResponse.success(res, profile, 'Eligible services updated successfully');
  };

  updateAvailability = async (req, res) => {
    const adminId = req.headers['x-user-id'] || req.user?.id;
    const profile = await this.profileService.updateAvailability(req.params.id, req.body, adminId);
    return ApiResponse.success(res, profile, 'Availability & working hours updated successfully');
  };

  updateStatus = async (req, res) => {
    const adminId = req.headers['x-user-id'] || req.user?.id;
    const profile = await this.profileService.updateStatus(req.params.id, req.body, adminId);
    return ApiResponse.success(res, profile, 'Status updated successfully');
  };

  reviewProfile = async (req, res) => {
    const adminId = req.headers['x-user-id'] || req.user?.id;
    const profile = await this.profileService.reviewProfile(req.params.id, req.body, adminId);
    return ApiResponse.success(res, profile, 'Profile reviewed successfully');
  };

  reviewKyc = async (req, res) => {
    const adminId = req.headers['x-user-id'] || req.user?.id;
    const profile = await this.profileService.reviewKyc(req.params.id, req.body, adminId);
    return ApiResponse.success(res, profile, 'KYC reviewed successfully');
  };

  reviewCertificate = async (req, res) => {
    const cert = await this.profileService.reviewCertificate(req.params.id, req.body);
    return ApiResponse.success(res, cert, 'Certificate reviewed successfully');
  };
}

export class SkillController {
  constructor(skillService) {
    this.skillService = skillService;
  }

  list = async (req, res) => {
    const items = await this.skillService.listActive();
    return ApiResponse.success(res, items, 'Skills fetched successfully');
  };

  getById = async (req, res) => {
    const skill = await this.skillService.getById(req.params.id);
    return ApiResponse.success(res, skill, 'Skill fetched successfully');
  };

  create = async (req, res) => {
    const skill = await this.skillService.create(req.body);
    return ApiResponse.created(res, skill, 'Skill created successfully');
  };

  update = async (req, res) => {
    const skill = await this.skillService.update(req.params.id, req.body);
    return ApiResponse.success(res, skill, 'Skill updated successfully');
  };

  remove = async (req, res) => {
    await this.skillService.remove(req.params.id);
    return ApiResponse.success(res, { id: req.params.id }, 'Skill deleted successfully');
  };
}

export class BankDetailController {
  constructor(bankDetailService) {
    this.bankDetailService = bankDetailService;
  }

  getMyBankDetail = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const detail = await this.bankDetailService.getMyBankDetail(userId);
    return ApiResponse.success(res, detail, 'Bank detail fetched successfully');
  };

  upsertBankDetail = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    const detail = await this.bankDetailService.upsertBankDetail(userId, req.body, req.file);
    return ApiResponse.success(res, detail, 'Bank detail saved successfully');
  };

  deleteBankDetail = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.user?.id;
    await this.bankDetailService.deleteBankDetail(userId);
    return ApiResponse.success(res, null, 'Bank detail deleted successfully');
  };

  listBankDetails = async (req, res) => {
    const result = await this.bankDetailService.listBankDetails(req.query);
    return ApiResponse.paginated(res, result.items, result.meta, 'Bank details fetched successfully');
  };

  getBankDetailById = async (req, res) => {
    const detail = await this.bankDetailService.getBankDetailById(req.params.id);
    return ApiResponse.success(res, detail, 'Bank detail fetched successfully');
  };

  reviewBankDetail = async (req, res) => {
    const adminId = req.headers['x-user-id'] || req.user?.id;
    const detail = await this.bankDetailService.reviewBankDetail(req.params.id, req.body, adminId);
    return ApiResponse.success(res, detail, 'Bank detail reviewed successfully');
  };
}
