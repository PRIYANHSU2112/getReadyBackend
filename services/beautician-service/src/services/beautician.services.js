import crypto from 'crypto';
import { AppError, ValidationError, HttpStatus, ErrorCodes } from '@getready/errors';
import { EVENT_TYPES } from '@getready/rabbitmq';
import { StorageService } from '@getready/storage';

export { StorageService };

export class BeauticianProfileService {
  constructor(
    profileRepo,
    workHistoryRepo,
    certificateRepo,
    bankRepo = null,
    storageService = null,
    userClient = null,
    eventPublisher = null,
  ) {
    this.profileRepo = profileRepo;
    this.workHistoryRepo = workHistoryRepo;
    this.certificateRepo = certificateRepo;
    this.bankRepo = bankRepo;
    this.storageService = storageService;
    this.userClient = userClient;
    this.eventPublisher = eventPublisher;
  }

  async getMyProfile(userId) {
    let profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      profile = await this.profileRepo.create({ userId });
    }
    return profile;
  }

  async createProfile(userId, data) {
    let profile = await this.profileRepo.findByUserId(userId);
    if (profile) {
      profile = await this.profileRepo.updateByUserId(userId, data);
      return profile;
    }
    profile = await this.profileRepo.create({ ...data, userId });
    if (this.eventPublisher) {
      this.eventPublisher.publish('beautician.created', EVENT_TYPES.BEAUTICIAN_CREATED, {
        profileId: profile._id.toString(),
        userId,
      }).catch(() => {});
    }
    return profile;
  }

  async updateProfile(userId, data) {
    const updated = await this.profileRepo.updateByUserId(userId, data);
    if (!updated) throw new AppError('Profile not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return updated;
  }

  async uploadSelfie(userId, files = {}) {
    const profile = await this.getMyProfile(userId);
    const updates = {};

    if (files.profilePhoto && files.profilePhoto[0]) {
      const up = await this.storageService.upload(files.profilePhoto[0], 'kyc');
      updates.profilePhoto = { url: up.url, publicId: up.key };
    }
    if (files.idCardFront && files.idCardFront[0]) {
      const up = await this.storageService.upload(files.idCardFront[0], 'kyc');
      updates.idCardFront = { url: up.url, publicId: up.key };
    }
    if (files.idCardBack && files.idCardBack[0]) {
      const up = await this.storageService.upload(files.idCardBack[0], 'kyc');
      updates.idCardBack = { url: up.url, publicId: up.key };
    }
    if (files.selfieWithId && files.selfieWithId[0]) {
      const up = await this.storageService.upload(files.selfieWithId[0], 'kyc');
      updates.selfieWithId = { url: up.url, publicId: up.key };
    }

    return this.profileRepo.updateByUserId(userId, updates);
  }

  async submitForReview(userId) {
    const profile = await this.getMyProfile(userId);
    profile.status = 'UNDER_REVIEW';
    profile.kycStatus = 'PENDING';
    await profile.save();
    return profile;
  }

  // Work History
  async getWorkHistory(userId) {
    const profile = await this.getMyProfile(userId);
    return this.workHistoryRepo.findByProfileId(profile._id);
  }

  async addWorkHistory(userId, data) {
    const profile = await this.getMyProfile(userId);
    return this.workHistoryRepo.create({ ...data, beauticianProfileId: profile._id });
  }

  async updateWorkHistory(userId, id, data) {
    const profile = await this.getMyProfile(userId);
    const updated = await this.workHistoryRepo.updateById(id, profile._id, data);
    if (!updated) throw new AppError('Work history not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return updated;
  }

  async deleteWorkHistory(userId, id) {
    const profile = await this.getMyProfile(userId);
    await this.workHistoryRepo.deleteById(id, profile._id);
    return true;
  }

  // Certificates
  async getCertificates(userId) {
    const profile = await this.getMyProfile(userId);
    return this.certificateRepo.findByProfileId(profile._id);
  }

  async addCertificate(userId, data, file = null) {
    const profile = await this.getMyProfile(userId);
    let certificateImage = { url: null, publicId: null };
    if (file) {
      const up = await this.storageService.upload(file, 'certificates');
      certificateImage = { url: up.url, publicId: up.key };
    }
    return this.certificateRepo.create({ ...data, beauticianProfileId: profile._id, certificateImage });
  }

  async updateCertificate(userId, id, data, file = null) {
    const profile = await this.getMyProfile(userId);
    const payload = { ...data };
    if (file) {
      const up = await this.storageService.upload(file, 'certificates');
      payload.certificateImage = { url: up.url, publicId: up.key };
    }
    const updated = await this.certificateRepo.updateById(id, profile._id, payload);
    if (!updated) throw new AppError('Certificate not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return updated;
  }

  async deleteCertificate(userId, id) {
    const profile = await this.getMyProfile(userId);
    await this.certificateRepo.deleteById(id, profile._id);
    return true;
  }

  // Admin
  async listProfiles(query = {}) {
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '10', 10), 100);
    const skip = (page - 1) * limit;
    const filter = { deletedAt: null };

    if (query.status) filter.status = query.status.toUpperCase();
    if (query.kycStatus) filter.kycStatus = query.kycStatus.toUpperCase();
    if (query.operationalStatus) filter.operationalStatus = query.operationalStatus.toUpperCase();
    if (query.city) filter['address.city'] = new RegExp(query.city, 'i');
    if (query.skill) filter.skills = { $in: [query.skill] };

    const { items, total } = await this.profileRepo.findAndCount(filter, { skip, limit });
    
    // Attach user profile summary if userClient available
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        let userDetails = null;
        if (this.userClient && item.userId) {
          userDetails = await this.userClient.getUserById(item.userId).catch(() => null);
        }
        return {
          ...item,
          user: userDetails || {
            name: 'Professional Partner',
            phone: item.alternatePhone || '',
            email: '',
          },
        };
      }),
    );

    return { items: enrichedItems, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getProfileById(id) {
    const profile = await this.profileRepo.findById(id);
    if (!profile) throw new AppError('Profile not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);

    const [workHistory, certificates, bankDetail, user] = await Promise.all([
      this.workHistoryRepo.findByProfileId(profile._id),
      this.certificateRepo.findByProfileId(profile._id),
      this.bankRepo ? this.bankRepo.findByUserId(profile.userId) : null,
      this.userClient ? this.userClient.getUserById(profile.userId).catch(() => null) : null,
    ]);

    const result = typeof profile.toJSON === 'function' ? profile.toJSON() : { ...profile };
    result.workHistory = workHistory || [];
    result.certificates = certificates || [];
    result.bankDetail = bankDetail || null;
    result.user = user || null;
    return result;
  }

  async adminCreateProfile(data, adminUserId = null) {
    let userId = data.userId;

    // 1. Resolve or Create User Account
    if (!userId && this.userClient) {
      const user = await this.userClient.findOrCreateBeauticianUser({
        name: data.name,
        phone: data.phone,
        email: data.email,
        gender: data.gender,
        dob: data.dob,
        languages: data.languages,
        profilePhoto: data.profilePhoto,
      });
      if (user) {
        userId = user.id || user._id;
      }
    }

    if (!userId) {
      userId = `usr_${crypto.randomUUID().slice(0, 8)}`;
    }

    // 2. Prepare Profile Documents
    let documents = Array.isArray(data.documents) ? [...data.documents] : [];
    if (data.idCardFront && !documents.some((d) => d.docType === 'aadhaar_front')) {
      documents.push({
        docType: 'aadhaar_front',
        file: data.idCardFront,
        status: data.kycStatus === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
        uploadedAt: new Date(),
      });
    }
    if (data.idCardBack && !documents.some((d) => d.docType === 'aadhaar_back')) {
      documents.push({
        docType: 'aadhaar_back',
        file: data.idCardBack,
        status: data.kycStatus === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
        uploadedAt: new Date(),
      });
    }

    // 3. Upsert Profile
    const profileData = {
      userId,
      bio: data.bio || null,
      languages: data.languages || ['Hindi', 'English'],
      alternatePhone: data.alternatePhone || null,
      emergencyContact: data.emergencyContact || { name: null, phone: null, relation: null },
      profilePhoto: data.profilePhoto || { url: null, publicId: null },
      address: data.address || {
        line1: '',
        line2: '',
        city: 'Bhopal',
        state: 'Madhya Pradesh',
        pincode: '462003',
        country: 'India',
        location: { type: 'Point', coordinates: [77.4126, 23.2599] },
      },
      serviceRadiusKm: data.serviceRadiusKm || 8,
      operationalArea: data.operationalArea || null,
      operationalStatus: data.operationalStatus || (data.status === 'APPROVED' ? 'AVAILABLE' : 'OFFLINE'),
      isAvailable: data.isAvailable !== false,
      workingHours: data.workingHours || { start: '09:00', end: '18:00' },
      workingDays: data.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      breaks: data.breaks || [{ start: '13:00', end: '14:00', label: 'Lunch Break' }],
      experienceYears: data.experienceYears || 1,
      skills: data.skills || [],
      skillDetails: data.skillDetails || [],
      eligibleServiceIds: data.eligibleServiceIds || [],
      documents,
      selfieWithId: data.selfieWithId || { url: null, publicId: null },
      selfieVerification: data.selfieVerification || { status: 'PENDING', verifiedAt: null },
      kycStatus: data.kycStatus || (data.status === 'APPROVED' ? 'VERIFIED' : 'PENDING'),
      status: data.status || (data.isDraft ? 'DRAFT' : 'SUBMITTED'),
      verificationStatus: data.status || (data.isDraft ? 'DRAFT' : 'SUBMITTED'),
      isDraft: Boolean(data.isDraft),
      isActive: data.status !== 'SUSPENDED',
      verifiedAt: data.status === 'APPROVED' ? new Date() : null,
      verifiedBy: data.status === 'APPROVED' ? adminUserId : null,
    };

    let profile = await this.profileRepo.findByUserId(userId);
    if (profile) {
      profile = await this.profileRepo.updateByUserId(userId, profileData);
    } else {
      profile = await this.profileRepo.create(profileData);
    }

    // 4. Create Work History if provided
    if (Array.isArray(data.workHistory) && data.workHistory.length > 0) {
      for (const item of data.workHistory) {
        await this.workHistoryRepo.create({
          beauticianProfileId: profile._id,
          ...item,
        });
      }
    }

    // 5. Create Certificates if provided
    if (Array.isArray(data.certificates) && data.certificates.length > 0) {
      for (const item of data.certificates) {
        await this.certificateRepo.create({
          beauticianProfileId: profile._id,
          ...item,
          status: data.status === 'APPROVED' ? 'VERIFIED' : 'PENDING',
        });
      }
    }

    // 6. Create Bank Detail if provided
    if (data.bankDetails && data.bankDetails.accountNumber && this.bankRepo) {
      await this.bankRepo.upsertByUserId(userId, {
        beauticianProfileId: profile._id,
        userId,
        accountHolderName: data.bankDetails.accountHolderName || data.name,
        accountNumber: data.bankDetails.accountNumber,
        ifscCode: data.bankDetails.ifscCode || '',
        bankName: data.bankDetails.bankName || null,
        branchName: data.bankDetails.branchName || null,
        upiId: data.bankDetails.upiId || null,
        status: data.status === 'APPROVED' ? 'VERIFIED' : 'PENDING',
        verifiedBy: data.status === 'APPROVED' ? adminUserId : null,
        verifiedAt: data.status === 'APPROVED' ? new Date() : null,
      });
    }

    // 7. Publish Domain Event
    if (this.eventPublisher) {
      this.eventPublisher.publish('beautician.created', EVENT_TYPES.BEAUTICIAN_CREATED, {
        profileId: profile._id.toString(),
        userId,
        name: data.name,
        phone: data.phone,
        isDraft: Boolean(data.isDraft),
        status: profile.status,
        createdBy: adminUserId,
      }).catch(() => {});

      if (profile.status === 'APPROVED') {
        this.eventPublisher.publish('beautician.kyc_approved', EVENT_TYPES.BEAUTICIAN_KYC_APPROVED, {
          profileId: profile._id.toString(),
          userId,
          status: 'APPROVED',
          kycStatus: 'VERIFIED',
        }).catch(() => {});
      }
    }

    return this.getProfileById(profile._id);
  }

  async getKycQueue(query = {}) {
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '10', 10), 100);
    const skip = (page - 1) * limit;

    const filter = { deletedAt: null };
    if (query.status) {
      filter.kycStatus = query.status.toUpperCase();
    } else {
      filter.kycStatus = { $in: ['PENDING', 'UNDER_REVIEW', 'REJECTED', 'EXPIRED'] };
    }

    const sortOption = query.sort === 'oldest' ? 'createdAt' : '-updatedAt';
    const { items, total } = await this.profileRepo.findAndCount(filter, { skip, limit, sort: sortOption });

    const enrichedQueue = await Promise.all(
      items.map(async (item) => {
        let userDetails = null;
        if (this.userClient && item.userId) {
          userDetails = await this.userClient.getUserById(item.userId).catch(() => null);
        }
        return {
          ...item,
          user: userDetails || {
            name: 'Professional Partner',
            phone: item.alternatePhone || '',
            email: '',
          },
          pendingDocsCount: Array.isArray(item.documents) ? item.documents.filter((d) => d.status === 'PENDING' || d.status === 'UNDER_REVIEW').length : 0,
        };
      }),
    );

    return { items: enrichedQueue, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async reviewKycDocument(profileId, docId, { status, rejectionReason = null }, adminUserId = null) {
    if (status === 'REJECTED' && (!rejectionReason || !rejectionReason.trim())) {
      throw new ValidationError('Rejection reason is mandatory when rejecting a KYC document');
    }

    const profile = await this.profileRepo.findById(profileId);
    if (!profile) throw new AppError('Profile not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);

    let docFound = false;
    profile.documents = (profile.documents || []).map((doc) => {
      if (doc._id?.toString() === docId || doc.docType === docId) {
        docFound = true;
        doc.status = status;
        doc.verifiedAt = new Date();
        doc.verifiedBy = adminUserId;
        doc.rejectionReason = status === 'REJECTED' ? rejectionReason : null;
      }
      return doc;
    });

    if (!docFound) {
      // Legacy document fallback
      if (docId === 'idCardFront' || docId === 'aadhaar_front') {
        profile.documents.push({
          docType: 'aadhaar_front',
          file: profile.idCardFront,
          status,
          verifiedAt: new Date(),
          verifiedBy: adminUserId,
          rejectionReason: status === 'REJECTED' ? rejectionReason : null,
        });
      } else if (docId === 'idCardBack' || docId === 'aadhaar_back') {
        profile.documents.push({
          docType: 'aadhaar_back',
          file: profile.idCardBack,
          status,
          verifiedAt: new Date(),
          verifiedBy: adminUserId,
          rejectionReason: status === 'REJECTED' ? rejectionReason : null,
        });
      }
    }

    if (status === 'REJECTED') {
      profile.kycStatus = 'REJECTED';
      profile.kycRejectionReason = rejectionReason;
      if (this.eventPublisher) {
        this.eventPublisher.publish('beautician.kyc_rejected', EVENT_TYPES.BEAUTICIAN_KYC_REJECTED, {
          profileId: profile._id.toString(),
          userId: profile.userId,
          docId,
          reason: rejectionReason,
        }).catch(() => {});
      }
    } else if (status === 'VERIFIED') {
      const allVerified = profile.documents.length > 0 && profile.documents.every((d) => d.status === 'VERIFIED');
      if (allVerified) {
        profile.kycStatus = 'VERIFIED';
        profile.kycRejectionReason = null;
      }
    }

    await profile.save();
    return profile;
  }

  async reviewKycSelfie(profileId, { status, remarks = null }, adminUserId = null) {
    const profile = await this.profileRepo.findById(profileId);
    if (!profile) throw new AppError('Profile not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);

    profile.selfieVerification = {
      status,
      verifiedAt: new Date(),
      remarks,
    };

    if (status === 'FAILED') {
      profile.kycStatus = 'REJECTED';
      profile.kycRejectionReason = remarks || 'Selfie verification failed';
    }

    await profile.save();
    return profile;
  }

  async requestReupload(profileId, { docType, reason }, adminUserId = null) {
    const profile = await this.profileRepo.findById(profileId);
    if (!profile) throw new AppError('Profile not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);

    let docMatched = false;
    profile.documents = (profile.documents || []).map((doc) => {
      if (doc.docType === docType) {
        docMatched = true;
        doc.status = 'REJECTED';
        doc.rejectionReason = reason;
        doc.verifiedAt = new Date();
        doc.verifiedBy = adminUserId;
      }
      return doc;
    });

    if (!docMatched) {
      profile.documents.push({
        docType,
        status: 'REJECTED',
        rejectionReason: reason,
        verifiedAt: new Date(),
        verifiedBy: adminUserId,
      });
    }

    profile.kycStatus = 'REJECTED';
    profile.kycRejectionReason = reason;
    await profile.save();

    if (this.eventPublisher) {
      this.eventPublisher.publish(
        'beautician.documents_resubmission_required',
        EVENT_TYPES.BEAUTICIAN_DOCUMENTS_RESUBMISSION_REQUIRED,
        {
          profileId: profile._id.toString(),
          userId: profile.userId,
          docType,
          reason,
        },
      ).catch(() => {});
    }

    return profile;
  }

  async updateEligibleServices(profileId, serviceIds = [], adminUserId = null) {
    const profile = await this.profileRepo.findById(profileId);
    if (!profile) throw new AppError('Profile not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);

    profile.eligibleServiceIds = serviceIds;
    await profile.save();
    return profile;
  }

  async updateAvailability(profileId, availabilityData = {}) {
    const profile = await this.profileRepo.findById(profileId);
    if (!profile) throw new AppError('Profile not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);

    if (availabilityData.isAvailable !== undefined) profile.isAvailable = availabilityData.isAvailable;
    if (availabilityData.operationalStatus) profile.operationalStatus = availabilityData.operationalStatus;
    if (availabilityData.serviceRadiusKm) profile.serviceRadiusKm = availabilityData.serviceRadiusKm;
    if (availabilityData.workingHours) profile.workingHours = availabilityData.workingHours;
    if (availabilityData.workingDays) profile.workingDays = availabilityData.workingDays;
    if (availabilityData.breaks) profile.breaks = availabilityData.breaks;

    await profile.save();
    return profile;
  }

  async updateStatus(profileId, { status, rejectionReason = null, operationalStatus = null }, adminUserId = null) {
    const profile = await this.profileRepo.findById(profileId);
    if (!profile) throw new AppError('Profile not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);

    const prevStatus = profile.status;
    profile.status = status;
    profile.verificationStatus = status;
    profile.rejectionReason = rejectionReason;

    if (operationalStatus) {
      profile.operationalStatus = operationalStatus;
    }

    if (status === 'APPROVED') {
      profile.verifiedAt = new Date();
      profile.verifiedBy = adminUserId;
      profile.kycStatus = 'VERIFIED';
      profile.isActive = true;
      if (!operationalStatus) profile.operationalStatus = 'AVAILABLE';

      if (this.eventPublisher) {
        this.eventPublisher.publish('beautician.kyc_approved', EVENT_TYPES.BEAUTICIAN_KYC_APPROVED, {
          profileId: profile._id.toString(),
          userId: profile.userId,
          status: 'APPROVED',
        }).catch(() => {});
      }
    } else if (status === 'SUSPENDED') {
      profile.isActive = false;
      profile.operationalStatus = 'SUSPENDED';
      if (this.eventPublisher) {
        this.eventPublisher.publish('beautician.suspended', EVENT_TYPES.BEAUTICIAN_SUSPENDED, {
          profileId: profile._id.toString(),
          userId: profile.userId,
          reason: rejectionReason,
        }).catch(() => {});
      }
    } else if (status === 'REJECTED') {
      profile.isActive = false;
      if (this.eventPublisher) {
        this.eventPublisher.publish('beautician.kyc_rejected', EVENT_TYPES.BEAUTICIAN_KYC_REJECTED, {
          profileId: profile._id.toString(),
          userId: profile.userId,
          reason: rejectionReason,
        }).catch(() => {});
      }
    }

    await profile.save();
    return profile;
  }

  async reviewProfile(id, { status, rejectionReason = null }, adminUserId = null) {
    return this.updateStatus(id, { status, rejectionReason }, adminUserId);
  }

  async reviewKyc(id, { kycStatus, kycRejectionReason = null }, adminUserId = null) {
    const profile = await this.profileRepo.findById(id);
    if (!profile) throw new AppError('Profile not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    profile.kycStatus = kycStatus;
    profile.kycRejectionReason = kycRejectionReason;
    if (kycStatus === 'VERIFIED') {
      profile.status = 'APPROVED';
      profile.verifiedAt = new Date();
      profile.verifiedBy = adminUserId;
    } else if (kycStatus === 'REJECTED') {
      profile.status = 'REJECTED';
    }
    await profile.save();
    return profile;
  }

  async reviewCertificate(id, { status, rejectionReason = null }) {
    return this.certificateRepo.reviewById(id, { status, rejectionReason });
  }
}

export class SkillService {
  constructor(skillRepo, eventPublisher = null) {
    this.skillRepo = skillRepo;
    this.eventPublisher = eventPublisher;
  }

  async listActive() {
    return this.skillRepo.findActive();
  }

  async getById(id) {
    const skill = await this.skillRepo.findById(id);
    if (!skill) throw new AppError('Skill not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return skill;
  }

  async create(data) {
    const slug = String(data.slug || data.name || '').trim().toLowerCase().replace(/\s+/g, '-');
    const existing = await this.skillRepo.findBySlug(slug);
    if (existing) throw new AppError('Skill already exists', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
    const skill = await this.skillRepo.create({ ...data, slug });
    if (this.eventPublisher) {
      this.eventPublisher.publish('skill.created', EVENT_TYPES.SKILL_CREATED, {
        skillId: skill._id.toString(),
        name: skill.name,
      }).catch(() => {});
    }
    return skill;
  }

  async update(id, data) {
    const updated = await this.skillRepo.updateById(id, data);
    if (!updated) throw new AppError('Skill not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return updated;
  }

  async remove(id) {
    await this.skillRepo.deleteById(id);
    return true;
  }
}

export class BankDetailService {
  constructor(bankDetailRepo, profileRepo, storageService) {
    this.bankDetailRepo = bankDetailRepo;
    this.profileRepo = profileRepo;
    this.storageService = storageService;
  }

  async getMyBankDetail(userId) {
    return this.bankDetailRepo.findByUserId(userId);
  }

  async upsertBankDetail(userId, data, file = null) {
    let profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      profile = await this.profileRepo.create({ userId });
    }

    const payload = { ...data, beauticianProfileId: profile._id, status: 'PENDING' };
    if (file) {
      const up = await this.storageService.upload(file, 'bank');
      payload.passbookImage = { url: up.url, publicId: up.key };
    }

    return this.bankDetailRepo.upsertByUserId(userId, payload);
  }

  async deleteBankDetail(userId) {
    return this.bankDetailRepo.deleteByUserId(userId);
  }

  async listBankDetails(query = {}) {
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '10', 10), 100);
    const skip = (page - 1) * limit;
    const filter = {};
    if (query.status) filter.status = query.status;
    const { items, total } = await this.bankDetailRepo.findAndCount(filter, { skip, limit });
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getBankDetailById(id) {
    const detail = await this.bankDetailRepo.findById(id);
    if (!detail) throw new AppError('Bank detail not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return detail;
  }

  async reviewBankDetail(id, { status, rejectionReason = null }, adminUserId = null) {
    return this.bankDetailRepo.reviewById(id, {
      status,
      rejectionReason,
      verifiedBy: adminUserId,
      verifiedAt: new Date(),
    });
  }
}
