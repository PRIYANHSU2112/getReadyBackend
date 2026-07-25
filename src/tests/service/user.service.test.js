import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UserService } from '../../modules/user/user.service.js';
import { EventType } from '../../common/constants/enums.js';
import { AppError } from '../../common/errors/AppError.js';
import { NotFoundError } from '../../common/errors/NotFoundError.js';

describe('UserService', () => {
  let userRepository;
  let eventBus;
  let cacheService;
  let service;

  beforeEach(() => {
    userRepository = {
      findByEmail: jest.fn(),
      findByPhone: jest.fn(),
      findByReferralCode: jest.fn(),
      create: jest.fn(),
      findActiveById: jest.fn(),
      buildListFilter: jest.fn().mockReturnValue({ deletedAt: null }),
      search: jest.fn(),
      countActive: jest.fn(),
      updateById: jest.fn(),
      softDelete: jest.fn(),
    };
    eventBus = { emit: jest.fn() };
    cacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      del: jest.fn(),
    };
    service = new UserService(userRepository, eventBus, cacheService);
  });

  it('creates a user and emits user.created', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.findByPhone.mockResolvedValue(null);
    userRepository.findByReferralCode.mockResolvedValue(null);
    userRepository.create.mockResolvedValue({
      _id: 'abc',
      name: 'Ada',
      email: 'ada@example.com',
      role: 'customer',
      referralCode: 'REF12345',
      toJSON() {
        return {
          _id: 'abc',
          name: 'Ada',
          email: 'ada@example.com',
          role: 'customer',
          referralCode: 'REF12345',
        };
      },
    });

    const result = await service.createUser({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'password123',
      phone: '+919876543210',
      role: 'customer',
    });

    expect(result.email).toBe('ada@example.com');
    expect(eventBus.emit).toHaveBeenCalledWith(
      EventType.USER_CREATED,
      expect.objectContaining({ user: expect.any(Object) }),
    );
  });

  it('rejects duplicate email', async () => {
    userRepository.findByEmail.mockResolvedValue({ _id: '1', email: 'ada@example.com' });
    await expect(
      service.createUser({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'password123',
        phone: '+919876543210',
        role: 'customer',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('throws NotFoundError when user missing', async () => {
    userRepository.findActiveById.mockResolvedValue(null);
    await expect(service.getUserById('507f1f77bcf86cd799439011')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
