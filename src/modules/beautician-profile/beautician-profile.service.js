import { BaseService } from '../../common/base/BaseService.js';
import { AppError } from '../../common/errors/AppError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import { BeauticianProfileStatus, KycStatus, CertificateStatus } from '../../common/constants/enums.js';
import {
  BEAUTICIAN_PROFILE_CACHE_TTL_SECONDS,
  BEAUTICIAN_PROFILE_SORT_FIELDS,
  DEFAULT_BEAUTICIAN_PROFILE_SORT,
} from '../../common/constants/beautician-profile.js';
import { buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { parseListQuery } from '../../common/helpers/list-query.helper.js';

export class BeauticianProfileService extends BaseService {
  /**
   * @param {import('./beautician-profile.repository.js').BeauticianProfileRepository} profileRepo
   * @param {import('./beautician-profile.repository.js').WorkHistoryRepository} workHistoryRepo
   * @param {import('./beautician-profile.repository.js').CertificateRepository} certificateRepo
   * @param {import('../../core/storage/StorageService.js').StorageService|null} storageService
   * @param {import('../../core/redis/cache.service.js').CacheService|null} cacheService
   */
  constructor(profileRepo, workHistoryRepo, certificateRepo, storageService = null, cacheService = null) {
    super(null, cacheService);
    this.profileRepo = profileRepo;
    this.workHistoryRepo = workHistoryRepo;
    this.certificateRepo = certificateRepo;
    this.storageService = storageService;
  }

  #sanitize(doc) {
    if (!doc) return doc;
    const obj = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
    if (obj._id) obj.id = obj._id.toString();
    return obj;
  }

  #profileUserCacheKey(userId) {
    return this.cacheKey('beautician_profile', 'user', userId);
  }

  #profileIdCacheKey(id) {
    return this.cacheKey('beautician_profile', 'id', id);
  }

  async #invalidateProfileCache(userId, profileId = null) {
    const promises = [];
    if (userId) {
      promises.push(this.invalidateCache(this.#profileUserCacheKey(userId)));
    }
    if (profileId) {
      promises.push(this.invalidateCache(this.#profileIdCacheKey(profileId)));
    }
    await Promise.all(promises);
  }

  async #uploadFile(file) {
    if (!this.storageService) {
      throw new AppError(
        'Storage service is not configured',
        HttpStatus.INTERNAL_ERROR,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
    const uploaded = await this.storageService.upload(file);
    return { url: uploaded.url, publicId: uploaded.key };
  }

  async #deleteFile(publicId) {
    if (!publicId || !this.storageService) return;
    try {
      await this.storageService.delete(publicId);
    } catch {
      // best-effort cleanup
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  BEAUTICIAN PROFILE
  // ═══════════════════════════════════════════════════════════

  /**
   * Create initial beautician profile (called after user registers as beautician).
   */
  async createProfile(userId, data = {}) {
    const existing = await this.profileRepo.findByUserId(userId);
    if (existing) {
      throw new AppError(
        'Beautician profile already exists',
        HttpStatus.CONFLICT,
        ErrorCodes.CONFLICT,
      );
    }

    const payload = {
      userId,
      languages: data.languages || [],
      bio: data.bio || null,
      preferredHours: data.preferredHours || { startTime: null, endTime: null, days: [] },
      profileStatus: BeauticianProfileStatus.PENDING,
      kyc: {
        status: KycStatus.PENDING,
        rejectionReason: null,
        verifiedBy: null,
        verifiedAt: null,
        selfieImage: { url: null, publicId: null },
        idCardFront: { url: null, publicId: null },
        idCardBack: { url: null, publicId: null },
      },
    };

    const created = await this.profileRepo.create(payload);
    await this.#invalidateProfileCache(userId, created._id?.toString());
    return this.#sanitize(created);
  }

  /**
   * Beautician — get own profile with populated skills, work history, and certificates.
   */
  async getMyProfile(userId) {
    const cacheKey = this.#profileUserCacheKey(userId);
    const cached = await this.getCached(cacheKey);
    if (cached) return cached;

    const profile = await this.profileRepo.findFullProfileAggregateByUserId(userId);
    this.ensureFound(profile, 'Beautician profile not found');

    await this.setCached(cacheKey, profile, BEAUTICIAN_PROFILE_CACHE_TTL_SECONDS);
    return profile;
  }

  /**
   * Beautician — update own profile fields.
   */
  async updateProfile(userId, data) {
    const profile = await this.profileRepo.findByUserId(userId);
    this.ensureFound(profile, 'Beautician profile not found');

    const updated = await this.profileRepo.updateByUserId(userId, data);
    await this.#invalidateProfileCache(userId, profile._id?.toString());
    return this.#sanitize(this.ensureFound(updated, 'Beautician profile not found'));
  }

  /**
   * Beautician — upload 3 KYC images (selfieImage, idCardFront, idCardBack) to S3 inside `kyc` object.
   * Concurrently processes uploads with Promise.all()!
   */
  async uploadKycDocuments(userId, files = {}, singleFile = null) {
    const profile = await this.profileRepo.findByUserId(userId);
    this.ensureFound(profile, 'Beautician profile not found');

    const updatePayload = {
      'kyc.status': KycStatus.PENDING,
      'kyc.rejectionReason': null,
    };

    const deletePromises = [];
    const uploadTasks = [];

    // Extract files from named fields or fallback single file
    const photoFile = files.selfieImage?.[0] || (singleFile && !files.idCardFront && !files.idCardBack ? singleFile : null);
    const frontFile = files.idCardFront?.[0];
    const backFile = files.idCardBack?.[0];

    if (photoFile) {
      if (profile.kyc?.selfieImage?.publicId) deletePromises.push(this.#deleteFile(profile.kyc.selfieImage.publicId));
      uploadTasks.push(
        this.#uploadFile(photoFile).then((media) => {
          updatePayload['kyc.selfieImage'] = media;
        }),
      );
    }

    if (frontFile) {
      if (profile.kyc?.idCardFront?.publicId) deletePromises.push(this.#deleteFile(profile.kyc.idCardFront.publicId));
      uploadTasks.push(
        this.#uploadFile(frontFile).then((media) => {
          updatePayload['kyc.idCardFront'] = media;
        }),
      );
    }

    if (backFile) {
      if (profile.kyc?.idCardBack?.publicId) deletePromises.push(this.#deleteFile(profile.kyc.idCardBack.publicId));
      uploadTasks.push(
        this.#uploadFile(backFile).then((media) => {
          updatePayload['kyc.idCardBack'] = media;
        }),
      );
    }

    if (!uploadTasks.length) {
      throw new AppError(
        'At least one KYC image (selfieImage, idCardFront, or idCardBack) must be provided',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.BAD_REQUEST,
      );
    }

    // Execute S3 uploads and cleanup concurrently
    await Promise.all([...deletePromises, ...uploadTasks]);

    const updated = await this.profileRepo.updateByUserId(userId, updatePayload);
    await this.#invalidateProfileCache(userId, profile._id?.toString());
    return this.#sanitize(updated);
  }

  /**
   * Beautician — submit profile for review.
   */
  async submitForReview(userId) {
    const profile = await this.profileRepo.findByUserId(userId);
    this.ensureFound(profile, 'Beautician profile not found');

    if (profile.profileStatus === BeauticianProfileStatus.UNDER_REVIEW) {
      throw new AppError(
        'Profile is already under review',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.BAD_REQUEST,
      );
    }

    const updated = await this.profileRepo.updateByUserId(userId, {
      profileStatus: BeauticianProfileStatus.UNDER_REVIEW,
      submittedAt: new Date(),
    });

    await this.#invalidateProfileCache(userId, profile._id?.toString());
    return this.#sanitize(updated);
  }

  /**
   * Admin — list profiles with filters.
   */
  async listProfiles(query = {}) {
    const pagination = parseListQuery(query, {
      allowedSortFields: BEAUTICIAN_PROFILE_SORT_FIELDS,
      defaultSort: DEFAULT_BEAUTICIAN_PROFILE_SORT,
    });

    const filter = this.profileRepo.buildAdminFilter(query);

    const { items, total } = await this.profileRepo.listAdminWithDetails(filter, {
      skip: pagination.skip,
      limit: pagination.limit,
      sort: pagination.sort,
    });

    return {
      items: items.map((i) => this.#sanitize(i)),
      meta: buildPaginationMeta(total, pagination),
    };
  }

  /**
   * Admin — get full profile by ID with single-query Aggregation & L2 Cache.
   */
  async getProfileById(id) {
    const cacheKey = this.#profileIdCacheKey(id);
    const cached = await this.getCached(cacheKey);
    if (cached) return cached;

    const profile = await this.profileRepo.findFullProfileAggregateById(id);
    this.ensureFound(profile, 'Beautician profile not found');

    await this.setCached(cacheKey, profile, BEAUTICIAN_PROFILE_CACHE_TTL_SECONDS);
    return profile;
  }

  /**
   * Admin — review/approve/reject profile.
   */
  async reviewProfile(id, data, adminId) {
    const profile = await this.profileRepo.findById(id);
    this.ensureFound(profile, 'Beautician profile not found');

    const updateData = {
      profileStatus: data.profileStatus,
      rejectionReason: data.rejectionReason || null,
      reviewedBy: adminId,
      reviewedAt: new Date(),
    };

    const updated = await this.profileRepo.updateById(id, updateData);
    await this.#invalidateProfileCache(profile.userId?.toString(), id);
    return this.#sanitize(updated);
  }

  /**
   * Admin — verify/reject KYC inside `kyc` object.
   */
  async reviewKyc(id, data, adminId) {
    const profile = await this.profileRepo.findById(id);
    this.ensureFound(profile, 'Beautician profile not found');

    const updateData = {
      'kyc.status': data.kycStatus,
      'kyc.rejectionReason': data.kycRejectionReason || null,
      'kyc.verifiedBy': adminId,
      'kyc.verifiedAt': data.kycStatus === KycStatus.VERIFIED ? new Date() : null,
    };

    const updated = await this.profileRepo.updateById(id, updateData);
    await this.#invalidateProfileCache(profile.userId?.toString(), id);
    return this.#sanitize(updated);
  }

  // ═══════════════════════════════════════════════════════════
  //  WORK HISTORY
  // ═══════════════════════════════════════════════════════════

  async addWorkHistory(userId, data) {
    const profile = await this.profileRepo.findByUserId(userId);
    this.ensureFound(profile, 'Beautician profile not found');

    const payload = {
      ...data,
      beauticianProfileId: profile._id,
      userId,
    };
    const created = await this.workHistoryRepo.create(payload);
    await this.#invalidateProfileCache(userId, profile._id.toString());
    return this.#sanitize(created);
  }

  async updateWorkHistory(userId, workHistoryId, data) {
    const existing = await this.workHistoryRepo.findById(workHistoryId);
    this.ensureFound(existing, 'Work history entry not found');

    if (existing.userId.toString() !== userId.toString()) {
      throw new AppError('Not authorized', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    const updated = await this.workHistoryRepo.updateById(workHistoryId, data);
    await this.#invalidateProfileCache(userId, existing.beauticianProfileId.toString());
    return this.#sanitize(this.ensureFound(updated, 'Work history entry not found'));
  }

  async deleteWorkHistory(userId, workHistoryId) {
    const existing = await this.workHistoryRepo.findById(workHistoryId);
    this.ensureFound(existing, 'Work history entry not found');

    if (existing.userId.toString() !== userId.toString()) {
      throw new AppError('Not authorized', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    await this.workHistoryRepo.softDelete(workHistoryId);
    await this.#invalidateProfileCache(userId, existing.beauticianProfileId.toString());
    return true;
  }

  async getWorkHistory(userId) {
    return (await this.workHistoryRepo.findByUserId(userId)).map((w) => this.#sanitize(w));
  }

  // ═══════════════════════════════════════════════════════════
  //  CERTIFICATES
  // ═══════════════════════════════════════════════════════════

  async addCertificate(userId, data, file = null) {
    const profile = await this.profileRepo.findByUserId(userId);
    this.ensureFound(profile, 'Beautician profile not found');

    const payload = {
      ...data,
      beauticianProfileId: profile._id,
      userId,
      status: CertificateStatus.PENDING,
    };

    if (file) {
      payload.certificateImage = await this.#uploadFile(file);
    }

    const created = await this.certificateRepo.create(payload);
    await this.#invalidateProfileCache(userId, profile._id.toString());
    return this.#sanitize(created);
  }

  async updateCertificate(userId, certId, data, file = null) {
    const existing = await this.certificateRepo.findById(certId);
    this.ensureFound(existing, 'Certificate not found');

    if (existing.userId.toString() !== userId.toString()) {
      throw new AppError('Not authorized', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    const payload = { ...data };
    if (file) {
      await this.#deleteFile(existing.certificateImage?.publicId);
      payload.certificateImage = await this.#uploadFile(file);
    }

    const updated = await this.certificateRepo.updateById(certId, payload);
    await this.#invalidateProfileCache(userId, existing.beauticianProfileId.toString());
    return this.#sanitize(this.ensureFound(updated, 'Certificate not found'));
  }

  async deleteCertificate(userId, certId) {
    const existing = await this.certificateRepo.findById(certId);
    this.ensureFound(existing, 'Certificate not found');

    if (existing.userId.toString() !== userId.toString()) {
      throw new AppError('Not authorized', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    await this.#deleteFile(existing.certificateImage?.publicId);
    await this.certificateRepo.softDelete(certId);
    await this.#invalidateProfileCache(userId, existing.beauticianProfileId.toString());
    return true;
  }

  async getCertificates(userId) {
    return (await this.certificateRepo.findByUserId(userId)).map((c) => this.#sanitize(c));
  }

  /**
   * Admin — review/verify/reject certificate.
   */
  async reviewCertificate(certId, data, adminId) {
    const existing = await this.certificateRepo.findById(certId);
    this.ensureFound(existing, 'Certificate not found');

    const updateData = {
      status: data.status,
      rejectionReason: data.rejectionReason || null,
      verifiedBy: adminId,
      verifiedAt: data.status === CertificateStatus.VERIFIED ? new Date() : null,
    };

    const updated = await this.certificateRepo.updateById(certId, updateData);
    await this.#invalidateProfileCache(existing.userId.toString(), existing.beauticianProfileId.toString());
    return this.#sanitize(updated);
  }
}
