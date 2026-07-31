import { BaseController } from '../../common/base/BaseController.js';

export class BeauticianProfileController extends BaseController {
  /**
   * @param {import('./beautician-profile.service.js').BeauticianProfileService} profileService
   */
  constructor(profileService) {
    super();
    this.profileService = profileService;
    this.bindMethods([
      // Profile
      'createProfile',
      'getMyProfile',
      'updateProfile',
      'uploadSelfie',
      'submitForReview',
      // Admin profile
      'listProfiles',
      'getProfileById',
      'reviewProfile',
      'reviewKyc',
      // Work History
      'addWorkHistory',
      'updateWorkHistory',
      'deleteWorkHistory',
      'getWorkHistory',
      // Certificates
      'addCertificate',
      'updateCertificate',
      'deleteCertificate',
      'getCertificates',
      'reviewCertificate',
    ]);
  }

  // ═══════════════════════════════════════════════════════════
  //  BEAUTICIAN PROFILE
  // ═══════════════════════════════════════════════════════════

  async createProfile(req, res) {
    const profile = await this.profileService.createProfile(req.user.id, req.body);
    return this.created(res, profile);
  }

  async getMyProfile(req, res) {
    const profile = await this.profileService.getMyProfile(req.user.id);
    return this.ok(res, profile);
  }

  async updateProfile(req, res) {
    const profile = await this.profileService.updateProfile(req.user.id, req.body);
    return this.ok(res, profile);
  }

  /** Upload 3 KYC images: profilePhoto, idCardFront, idCardBack */
  async uploadSelfie(req, res) {
    const profile = await this.profileService.uploadKycDocuments(
      req.user.id,
      req.files || {},
      req.file || null,
    );
    return this.ok(res, profile);
  }

  async submitForReview(req, res) {
    const profile = await this.profileService.submitForReview(req.user.id);
    return this.ok(res, profile);
  }

  // ═══════════════════════════════════════════════════════════
  //  ADMIN
  // ═══════════════════════════════════════════════════════════

  async listProfiles(req, res) {
    const { items, meta } = await this.profileService.listProfiles(req.query);
    return this.ok(res, items, meta);
  }

  async getProfileById(req, res) {
    const profile = await this.profileService.getProfileById(req.params.id);
    return this.ok(res, profile);
  }

  async reviewProfile(req, res) {
    const profile = await this.profileService.reviewProfile(req.params.id, req.body, req.user.id);
    return this.ok(res, profile);
  }

  async reviewKyc(req, res) {
    const profile = await this.profileService.reviewKyc(req.params.id, req.body, req.user.id);
    return this.ok(res, profile);
  }

  // ═══════════════════════════════════════════════════════════
  //  WORK HISTORY
  // ═══════════════════════════════════════════════════════════

  async addWorkHistory(req, res) {
    const entry = await this.profileService.addWorkHistory(req.user.id, req.body);
    return this.created(res, entry);
  }

  async updateWorkHistory(req, res) {
    const entry = await this.profileService.updateWorkHistory(req.user.id, req.params.id, req.body);
    return this.ok(res, entry);
  }

  async deleteWorkHistory(req, res) {
    await this.profileService.deleteWorkHistory(req.user.id, req.params.id);
    return this.noContent(res);
  }

  async getWorkHistory(req, res) {
    const items = await this.profileService.getWorkHistory(req.user.id);
    return this.ok(res, items);
  }

  // ═══════════════════════════════════════════════════════════
  //  CERTIFICATES
  // ═══════════════════════════════════════════════════════════

  async addCertificate(req, res) {
    const cert = await this.profileService.addCertificate(req.user.id, req.body, req.file || null);
    return this.created(res, cert);
  }

  async updateCertificate(req, res) {
    const cert = await this.profileService.updateCertificate(
      req.user.id,
      req.params.id,
      req.body,
      req.file || null,
    );
    return this.ok(res, cert);
  }

  async deleteCertificate(req, res) {
    await this.profileService.deleteCertificate(req.user.id, req.params.id);
    return this.noContent(res);
  }

  async getCertificates(req, res) {
    const items = await this.profileService.getCertificates(req.user.id);
    return this.ok(res, items);
  }

  async reviewCertificate(req, res) {
    const cert = await this.profileService.reviewCertificate(req.params.id, req.body, req.user.id);
    return this.ok(res, cert);
  }
}
