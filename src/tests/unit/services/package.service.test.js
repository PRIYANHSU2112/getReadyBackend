import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PackageService } from '../../../modules/package/package.service.js';
import {
  PackageStatus,
  PackageChangeRequestStatus,
  PackageType,
} from '../../../modules/package/package.enum.js';

describe('PackageService (unit)', () => {
  let packageService;
  let mockPackageRepo;
  let mockCategoryRepo;

  beforeEach(() => {
    mockPackageRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
      updateById: jest.fn(),
      listPublicSlim: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      createChangeRequest: jest.fn(),
      findChangeRequestById: jest.fn(),
      updateChangeRequestStatus: jest.fn(),
    };
    mockCategoryRepo = {
      findBySlug: jest.fn().mockResolvedValue({ _id: 'cat123', slug: 'bridal' }),
    };

    packageService = new PackageService(mockPackageRepo, mockCategoryRepo, null, null);
  });

  it('admin create package publishes immediately as APPROVED', async () => {
    const adminUser = { id: 'admin1', role: 'admin' };
    const payload = {
      name: 'Bridal Bliss Combo',
      items: [{ serviceId: '507f1f77bcf86cd799439011', categoryId: '507f1f77bcf86cd799439012' }],
      price: 1500,
    };

    mockPackageRepo.create.mockImplementation(async (data) => ({
      _id: 'pkg123',
      ...data,
    }));

    const result = await packageService.createPackage(payload, adminUser);
    expect(result.status).toBe(PackageStatus.APPROVED);
    expect(result.price).toBe(1500);
    expect(result.slug).toBe('bridal-bliss-combo');
  });

  it('beautician create package sets status PENDING_APPROVAL and approxPrice only', async () => {
    const beauticianUser = { id: 'b1', role: 'beautician' };
    const payload = {
      name: 'Party Glam Package',
      items: [{ serviceId: '507f1f77bcf86cd799439011', categoryId: '507f1f77bcf86cd799439012' }],
      approxPrice: 1200,
    };

    mockPackageRepo.create.mockImplementation(async (data) => ({
      _id: 'pkg124',
      ...data,
    }));

    const result = await packageService.createPackage(payload, beauticianUser);
    expect(result.status).toBe(PackageStatus.PENDING_APPROVAL);
    expect(result.approxPrice).toBe(1200);
    expect(result.price).toBeNull();
  });

  it('beautician update creates change request and leaves live package untouched', async () => {
    const beauticianUser = { id: 'b1', role: 'beautician' };
    const existingPackage = {
      _id: 'pkg123',
      name: 'Old Name',
      shortDescription: 'Old Desc',
    };

    mockPackageRepo.findById.mockResolvedValue(existingPackage);
    mockPackageRepo.createChangeRequest.mockResolvedValue({
      _id: 'cr123',
      packageId: 'pkg123',
      status: PackageChangeRequestStatus.PENDING,
    });

    const res = await packageService.updatePackage(
      'pkg123',
      { name: 'New Name' },
      beauticianUser,
    );

    expect(res.isChangeRequest).toBe(true);
    expect(res.liveUnchanged).toBe(true);
    expect(mockPackageRepo.createChangeRequest).toHaveBeenCalled();
  });

  it('admin approvePackage sets status to APPROVED and updates price', async () => {
    const adminUser = { id: 'admin1', role: 'admin' };
    mockPackageRepo.findById.mockResolvedValue({ _id: 'pkg123', status: PackageStatus.PENDING_APPROVAL });
    mockPackageRepo.updateById.mockResolvedValue({
      _id: 'pkg123',
      status: PackageStatus.APPROVED,
      price: 2000,
    });

    const result = await packageService.approvePackage('pkg123', { price: 2000 }, adminUser);
    expect(result.status).toBe(PackageStatus.APPROVED);
    expect(result.price).toBe(2000);
  });
});
