import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ServiceService } from '../../../modules/service/service.service.js';
import { AppError } from '../../../common/errors/AppError.js';
import {
  UserRole,
  ServiceStatus,
  ServiceDiscountType,
  ServiceChangeRequestStatus,
} from '../../../common/constants/enums.js';

describe('ServiceService (unit)', () => {
  let serviceRepository;
  let changeRequestRepository;
  let categoryRepository;
  let cacheService;
  let service;

  const admin = { id: 'admin1', role: UserRole.ADMIN };
  const beautician = { id: 'beau1', role: UserRole.BEAUTICIAN };

  beforeEach(() => {
    serviceRepository = {
      findBySlug: jest.fn().mockResolvedValue(null),
      findActiveById: jest.fn(),
      findByIdAny: jest.fn(),
      create: jest.fn(),
      updateById: jest.fn(),
      listPublicSlim: jest.fn(),
      countPublic: jest.fn(),
      findPublicBySlug: jest.fn(),
      model: {
        findOne: jest.fn(),
        updateOne: jest.fn(),
      },
    };
    changeRequestRepository = {
      findPendingByServiceId: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      updateById: jest.fn(),
      findByIdAny: jest.fn(),
      model: {
        findOne: jest.fn(),
      },
    };
    categoryRepository = {
      findActiveById: jest.fn().mockResolvedValue({
        _id: 'cat1',
        isActive: true,
        deletedAt: null,
      }),
    };
    cacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      delByPattern: jest.fn(),
    };
    service = new ServiceService(
      serviceRepository,
      changeRequestRepository,
      categoryRepository,
      cacheService,
      null,
    );
  });

  it('computes discounted price for PERCENTAGE and FIXED', () => {
    expect(
      service.computeDiscountedPrice(1000, ServiceDiscountType.PERCENTAGE, 10),
    ).toBe(900);
    expect(
      service.computeDiscountedPrice(1000, ServiceDiscountType.FIXED, 150),
    ).toBe(850);
    expect(
      service.computeDiscountedPrice(1000, ServiceDiscountType.NONE, 0),
    ).toBe(1000);
  });

  it('beautician create is PENDING_APPROVAL without price', async () => {
    serviceRepository.create.mockResolvedValue({
      _id: 's1',
      name: 'Haircut',
      slug: 'haircut',
      status: ServiceStatus.PENDING_APPROVAL,
      price: null,
      createdBy: beautician.id,
    });

    await service.create(
      { name: 'Haircut', categoryId: '507f1f77bcf86cd799439011', price: 500 },
      beautician,
    );

    expect(serviceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ServiceStatus.PENDING_APPROVAL,
        price: null,
      }),
    );
  });

  it('beautician update creates change request and does not update live', async () => {
    serviceRepository.findActiveById.mockResolvedValue({
      _id: 's1',
      name: 'Haircut',
      slug: 'haircut',
      shortDescription: 'old',
      createdBy: beautician.id,
      deletedAt: null,
      categoryId: '507f1f77bcf86cd799439011',
    });
    changeRequestRepository.create.mockResolvedValue({
      _id: 'cr1',
      serviceId: 's1',
      requestedBy: beautician.id,
      status: ServiceChangeRequestStatus.PENDING,
      changes: { shortDescription: 'new' },
      previousValues: { shortDescription: 'old' },
      changedFields: ['shortDescription'],
    });

    const result = await service.update(
      's1',
      { shortDescription: 'new', price: 999 },
      beautician,
    );

    expect(serviceRepository.updateById).not.toHaveBeenCalled();
    expect(changeRequestRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: expect.objectContaining({ shortDescription: 'new' }),
      }),
    );
    expect(result.liveUnchanged).toBe(true);
    expect(result.changeRequest.changes.price).toBeUndefined();
  });

  it('approve create requires admin and sets price', async () => {
    serviceRepository.findActiveById.mockResolvedValue({
      _id: 's1',
      status: ServiceStatus.PENDING_APPROVAL,
    });
    serviceRepository.updateById.mockResolvedValue({
      _id: 's1',
      status: ServiceStatus.APPROVED,
      price: 1200,
      discountedPrice: 1200,
    });

    await service.approveCreate('s1', { price: 1200 }, admin);
    expect(serviceRepository.updateById).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({
        status: ServiceStatus.APPROVED,
        price: 1200,
      }),
    );
  });

  it('reject change request requires reason and leaves service alone', async () => {
    changeRequestRepository.findByIdAny.mockResolvedValue({
      _id: 'cr1',
      status: ServiceChangeRequestStatus.PENDING,
    });
    changeRequestRepository.updateById.mockResolvedValue({
      _id: 'cr1',
      status: ServiceChangeRequestStatus.REJECTED,
      rejectedReason: 'Bad images here',
      changes: {},
      previousValues: {},
    });

    await service.rejectChangeRequest(
      'cr1',
      { rejectedReason: 'Bad images here' },
      admin,
    );
    expect(serviceRepository.updateById).not.toHaveBeenCalled();
    expect(serviceRepository.model.updateOne).not.toHaveBeenCalled();
  });

  it('buildDiff returns panel-ready rows', () => {
    const diff = service.buildDiff(
      { name: 'A' },
      { name: 'B' },
    );
    expect(diff).toEqual([
      expect.objectContaining({
        field: 'name',
        previousValue: 'A',
        newValue: 'B',
        type: 'string',
      }),
    ]);
  });

  it('listPublic caches payload', async () => {
    serviceRepository.listPublicSlim.mockResolvedValue([{ id: '1', name: 'X' }]);
    serviceRepository.countPublic.mockResolvedValue(1);

    const first = await service.listPublic({});
    const second = await service.listPublic({});
    expect(first.items).toHaveLength(1);
    expect(second.items).toHaveLength(1);
    expect(serviceRepository.listPublicSlim).toHaveBeenCalledTimes(1);
  });
});
