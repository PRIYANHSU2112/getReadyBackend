import { jest } from '@jest/globals';
import { BeauticianProfileService } from '../../services/beautician-service/src/services/beautician.services.js';
import { UserService } from '../../services/user-service/src/services/user.service.js';
import { MemberService } from '../../services/user-service/src/services/member.service.js';
import { ValidationError, AppError } from '../../packages/errors/index.js';

describe('Admin Beautician & Customer Management Lifecycle Test Suite', () => {
  let mockBeauticianRepo;
  let mockUserClient;
  let mockBankRepo;
  let mockRabbitPublisher;
  let beauticianService;

  let mockUserRepo;
  let mockUserRabbitPublisher;
  let userService;

  let mockMemberRepo;
  let mockMemberRabbitPublisher;
  let memberService;

  beforeEach(() => {
    // Beautician service dependencies
    let storedProfile = null;
    mockBeauticianRepo = {
      create: jest.fn().mockImplementation((doc) => {
        storedProfile = { _id: 'beautician-aisha-999', ...doc };
        return Promise.resolve(storedProfile);
      }),
      findById: jest.fn().mockImplementation((id) => Promise.resolve(storedProfile)),
      findByUserId: jest.fn(),
      updateById: jest.fn(),
      updateByUserId: jest.fn().mockImplementation((userId, doc) => {
        storedProfile = { _id: 'beautician-aisha-999', userId, ...doc };
        return Promise.resolve(storedProfile);
      }),
      findKycPending: jest.fn(),
      findNear: jest.fn(),
    };

    const mockWorkHistoryRepo = {
      findByProfileId: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
    };

    const mockCertificateRepo = {
      findByProfileId: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
    };

    mockUserClient = {
      findOrCreateBeauticianUser: jest.fn().mockResolvedValue({
        id: 'user-aisha-123',
        _id: 'user-aisha-123',
        name: 'Aisha Sheikh',
        phone: '+919876543210',
        email: 'sasha.m@stylist.com',
        role: 'beautician',
        status: 'ACTIVE',
      }),
      createUserAccount: jest.fn().mockResolvedValue({
        _id: 'user-aisha-123',
        name: 'Aisha Sheikh',
        phone: '+919876543210',
        email: 'sasha.m@stylist.com',
        role: 'beautician',
        status: 'ACTIVE',
      }),
      getUserById: jest.fn().mockResolvedValue({
        _id: 'user-aisha-123',
        name: 'Aisha Sheikh',
        phone: '+919876543210',
        status: 'ACTIVE',
      }),
    };

    mockBankRepo = {
      findByBeauticianId: jest.fn(),
      findByUserId: jest.fn().mockResolvedValue(null),
      upsertByUserId: jest.fn().mockResolvedValue({}),
      upsert: jest.fn(),
    };

    mockRabbitPublisher = {
      publish: jest.fn().mockResolvedValue(true),
    };

    beauticianService = new BeauticianProfileService(
      mockBeauticianRepo,
      mockWorkHistoryRepo,
      mockCertificateRepo,
      mockBankRepo,
      null, // storageService
      mockUserClient,
      mockRabbitPublisher
    );

    // User service dependencies
    mockUserRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByPhone: jest.fn(),
      findByEmail: jest.fn(),
      findByReferralCode: jest.fn().mockResolvedValue(null),
      updateById: jest.fn(),
      findActiveById: jest.fn(),
    };

    mockUserRabbitPublisher = {
      publish: jest.fn().mockResolvedValue(true),
    };

    userService = new UserService(
      mockUserRepo,
      null, // storageService
      null, // rbacService
      mockUserRabbitPublisher
    );

    // Member service dependencies
    mockMemberRepo = {
      create: jest.fn(),
      findActiveByUserId: jest.fn(),
      findActiveByIdForUser: jest.fn(),
      updateById: jest.fn(),
      softDelete: jest.fn(),
    };

    mockMemberRabbitPublisher = {
      publish: jest.fn().mockResolvedValue(true),
    };

    memberService = new MemberService(
      mockMemberRepo,
      mockMemberRabbitPublisher
    );
  });

  describe('1. Beautician Admin Creation & Draft Lifecycle (Aisha Sheikh Scenario)', () => {
    test('should create Beautician in DRAFT status with user identity linked', async () => {
      const aishaDraftData = {
        name: 'Aisha Sheikh',
        phone: '+919876543210',
        email: 'sasha.m@stylist.com',
        gender: 'female',
        dateOfBirth: '1995-07-30',
        languages: ['Hindi', 'English', 'Urdu'],
        address: {
          line1: 'Flat 402, Green Valley Apartments',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400050',
          coordinates: [72.8258, 18.9750],
        },
        serviceRadiusKm: 8,
        workingHours: { start: '09:00', end: '18:00' },
        workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        skills: [
          { skillId: 'skill-hair-col', skillName: 'Hair Coloring', proficiency: 'expert', yearsOfExperience: 4, isActive: true },
          { skillId: 'skill-makeup', skillName: 'Makeup', proficiency: 'expert', yearsOfExperience: 5, isActive: true },
          { skillId: 'skill-nail-art', skillName: 'Nail Arts', proficiency: 'advanced', yearsOfExperience: 3, isActive: true },
          { skillId: 'skill-facial', skillName: 'Facial', proficiency: 'expert', yearsOfExperience: 4, isActive: true },
        ],
        experience: [
          { companyName: 'Elite Salon & Spa', role: 'Senior Hair Stylist', startDate: '2020-01-01', endDate: '2023-12-31', isCurrent: false },
        ],
        certifications: [
          { name: 'Bridal Certification', issuingOrganization: 'Beauty Academy', issueDate: '2020-05-15', verificationStatus: 'VERIFIED' },
        ],
        status: 'DRAFT',
      };

      mockBeauticianRepo.findByUserId.mockResolvedValue(null);

      const result = await beauticianService.adminCreateProfile(aishaDraftData, 'admin-super-01');

      expect(mockUserClient.findOrCreateBeauticianUser).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Aisha Sheikh', phone: '+919876543210' })
      );
      expect(result.verificationStatus).toBe('DRAFT');
      expect(result.serviceRadiusKm).toBe(8);
      expect(result.skills).toHaveLength(4);
      expect(mockRabbitPublisher.publish).toHaveBeenCalledWith(
        'beautician.created',
        expect.anything(),
        expect.objectContaining({ profileId: 'beautician-aisha-999', createdBy: 'admin-super-01' })
      );
    });

    test('should reuse existing profile if user already has a beautician record (preventing duplicate creation)', async () => {
      mockBeauticianRepo.findByUserId.mockResolvedValue({ _id: 'existing-id', userId: 'user-aisha-123' });

      const result = await beauticianService.adminCreateProfile({ phone: '+919876543210', name: 'Aisha Sheikh', isDraft: true }, 'admin-01');
      expect(result).toBeDefined();
      expect(mockBeauticianRepo.updateByUserId).toHaveBeenCalledWith('user-aisha-123', expect.anything());
    });
  });

  describe('2. KYC Document Verification & Mandatory Rejection Reason', () => {
    test('should approve KYC document and update verification status', async () => {
      const mockProfile = {
        _id: 'beautician-aisha-999',
        userId: 'user-aisha-123',
        documents: [
          { _id: 'doc-aadhaar-front', documentType: 'aadhaar_front', status: 'PENDING' },
          { _id: 'doc-aadhaar-back', documentType: 'aadhaar_back', status: 'PENDING' },
        ],
        verificationStatus: 'UNDER_REVIEW',
        save: jest.fn().mockResolvedValue(true),
      };

      mockBeauticianRepo.findById.mockResolvedValue(mockProfile);

      const updated = await beauticianService.reviewKycDocument(
        'beautician-aisha-999',
        'doc-aadhaar-front',
        { status: 'VERIFIED', rejectionReason: null },
        'admin-kyc-reviewer'
      );

      const frontDoc = updated.documents.find((d) => d._id === 'doc-aadhaar-front');
      expect(frontDoc.status).toBe('VERIFIED');
      expect(frontDoc.verifiedBy).toBe('admin-kyc-reviewer');
      expect(frontDoc.verifiedAt).toBeDefined();
    });

    test('should reject KYC document with mandatory rejection reason', async () => {
      const mockProfile = {
        _id: 'beautician-aisha-999',
        userId: 'user-aisha-123',
        documents: [
          { _id: 'doc-aadhaar-back', documentType: 'aadhaar_back', status: 'PENDING' },
        ],
        verificationStatus: 'UNDER_REVIEW',
        save: jest.fn().mockResolvedValue(true),
      };

      mockBeauticianRepo.findById.mockResolvedValue(mockProfile);

      const rejectionReason = 'ID Proof (Back Side): Image is blurry. Please upload a clearer image.';
      const updated = await beauticianService.reviewKycDocument(
        'beautician-aisha-999',
        'doc-aadhaar-back',
        { status: 'REJECTED', rejectionReason },
        'admin-kyc-reviewer'
      );

      const backDoc = updated.documents.find((d) => d._id === 'doc-aadhaar-back');
      expect(backDoc.status).toBe('REJECTED');
      expect(backDoc.rejectionReason).toBe(rejectionReason);
    });

    test('should fail if document is rejected without rejection reason', async () => {
      const mockProfile = {
        _id: 'beautician-aisha-999',
        documents: [{ _id: 'doc-aadhaar-back', status: 'PENDING' }],
      };
      mockBeauticianRepo.findById.mockResolvedValue(mockProfile);

      await expect(
        beauticianService.reviewKycDocument(
          'beautician-aisha-999',
          'doc-aadhaar-back',
          { status: 'REJECTED', rejectionReason: '' },
          'admin-kyc-reviewer'
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('3. Service Eligibility & Operational Status Control', () => {
    test('should update eligible service IDs for bookable dispatching', async () => {
      const mockProfile = {
        _id: 'beautician-aisha-999',
        eligibleServiceIds: [],
        save: jest.fn().mockResolvedValue(true),
      };
      mockBeauticianRepo.findById.mockResolvedValue(mockProfile);

      const eligibleServices = ['srv-hair-spa-01', 'srv-facial-glow-02', 'srv-bridal-03'];
      const result = await beauticianService.updateEligibleServices(
        'beautician-aisha-999',
        eligibleServices,
        'admin-ops'
      );

      expect(result.eligibleServiceIds).toEqual(eligibleServices);
    });

    test('should suspend beautician and emit rabbitmq domain event', async () => {
      const mockProfile = {
        _id: 'beautician-aisha-999',
        userId: 'user-aisha-123',
        verificationStatus: 'APPROVED',
        operationalStatus: 'AVAILABLE',
        save: jest.fn().mockResolvedValue(true),
      };
      mockBeauticianRepo.findById.mockResolvedValue(mockProfile);

      const result = await beauticianService.updateStatus(
        'beautician-aisha-999',
        {
          status: 'SUSPENDED',
          operationalStatus: 'SUSPENDED',
          rejectionReason: 'Policy violation during service delivery',
        },
        'admin-ops'
      );

      expect(result.verificationStatus).toBe('SUSPENDED');
      expect(result.operationalStatus).toBe('SUSPENDED');
      expect(result.rejectionReason).toBe('Policy violation during service delivery');
      expect(mockRabbitPublisher.publish).toHaveBeenCalledWith(
        'beautician.suspended',
        expect.anything(),
        expect.objectContaining({ profileId: 'beautician-aisha-999' })
      );
    });
  });

  describe('4. Customer Admin & Multi-Profile Separation (Customer A Scenario)', () => {
    test('should create customer account with status ACTIVE', async () => {
      const customerData = {
        name: 'Customer A',
        phone: '+919812345678',
        email: 'customer.a@example.com',
        gender: 'female',
        status: 'ACTIVE',
      };

      mockUserRepo.findByPhone.mockResolvedValue(null);
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.create.mockImplementation((doc) => Promise.resolve({ _id: 'cust-a-001', ...doc }));

      const result = await userService.createUser(customerData);

      expect(result.id).toBe('cust-a-001');
      expect(result.status).toBe('ACTIVE');
      expect(mockUserRabbitPublisher.publish).toHaveBeenCalledWith(
        'user.created',
        expect.anything(),
        expect.objectContaining({ userId: 'cust-a-001', phone: '+919812345678' })
      );
    });

    test('should maintain separate family member profiles (Self, Mother, Sister) under one account', async () => {
      const familyMembers = [
        { _id: 'mem-self-1', name: 'Customer A (Self)', relationship: 'Self', age: 28, skinType: 'Oily', hairType: 'Straight' },
        { _id: 'mem-mom-2', name: 'Mother', relationship: 'Mother', age: 54, skinType: 'Dry', hairType: 'Wavy' },
        { _id: 'mem-sis-3', name: 'Sister', relationship: 'Sister', age: 24, skinType: 'Combination', hairType: 'Curly' },
      ];

      mockMemberRepo.findActiveByUserId.mockResolvedValue(familyMembers);

      const members = await memberService.listForUser('cust-a-001');
      expect(members).toHaveLength(3);
      expect(members.map(m => m.relationship)).toEqual(['Self', 'Mother', 'Sister']);
    });

    test('should isolate Beauty Passport history per member profile', async () => {
      const motherPassport = {
        _id: 'mem-mom-2',
        name: 'Mother',
        relationship: 'Mother',
        skinType: 'Dry',
        hairType: 'Wavy',
        allergies: ['Peanuts'],
        beautyPassport: {
          serviceHistory: [
            { serviceName: 'Hydra Dew Facial', date: '2026-08-10', beauticianName: 'Aisha Sheikh' },
          ],
          skinConcerns: ['Fine lines', 'Pigmentation'],
        },
      };

      mockMemberRepo.findActiveByIdForUser.mockImplementation((memberId, userId) => {
        if (memberId === 'mem-mom-2') return Promise.resolve(motherPassport);
        return Promise.resolve({ _id: memberId, name: 'Self', relationship: 'Self' });
      });

      const passport = await memberService.getBeautyPassport('mem-mom-2', 'cust-a-001');
      expect(passport.profileId).toBe('mem-mom-2');
      expect(passport.skinType).toBe('Dry');
      expect(passport.beautyPassport.serviceHistory[0].serviceName).toBe('Hydra Dew Facial');
    });
  });
});
