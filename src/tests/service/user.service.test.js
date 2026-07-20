import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UserService } from '../../modules/user/user.service.js';
import { EventType } from '../../common/constants/enums.js';
import { AppError } from '../../common/errors/AppError.js';
import { NotFoundError } from '../../common/errors/NotFoundError.js';

describe('UserService', () => {
  let userRepository;
  let eventBus;
  let cacheService;
  let jwtUtil;
  let service;

  beforeEach(() => {
    userRepository = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findActiveById: jest.fn(),
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
    jwtUtil = { sign: jest.fn().mockReturnValue('token') };
    service = new UserService(userRepository, eventBus, cacheService, jwtUtil);
  });

  it('creates a user and emits user.created', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.create.mockResolvedValue({
      _id: 'abc',
      name: 'Ada',
      email: 'ada@example.com',
      role: 'user',
      toJSON() {
        return { _id: 'abc', name: 'Ada', email: 'ada@example.com', role: 'user' };
      },
    });

    const result = await service.createUser({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'password123',
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
      service.createUser({ name: 'Ada', email: 'ada@example.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('throws NotFoundError when user missing', async () => {
    userRepository.findActiveById.mockResolvedValue(null);
    await expect(service.getUserById('507f1f77bcf86cd799439011')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
