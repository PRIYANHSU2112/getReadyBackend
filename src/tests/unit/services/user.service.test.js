import { describe, it, expect, jest } from '@jest/globals';
import { UserService } from '../../../modules/user/user.service.js';
import { EventType } from '../../../common/constants/enums.js';
import { AppError } from '../../../common/errors/AppError.js';

describe('UserService (unit)', () => {
  it('creates user via mocked repository', async () => {
    const userRepository = {
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        _id: '1',
        name: 'Test',
        email: 't@example.com',
        role: 'user',
        toJSON() {
          return { _id: '1', name: 'Test', email: 't@example.com', role: 'user' };
        },
      }),
    };
    const eventBus = { emit: jest.fn() };
    const service = new UserService(userRepository, eventBus, null, null);

    const user = await service.createUser({
      name: 'Test',
      email: 't@example.com',
      password: 'password123',
    });

    expect(user.email).toBe('t@example.com');
    expect(eventBus.emit).toHaveBeenCalledWith(EventType.USER_CREATED, expect.any(Object));
  });

  it('throws on duplicate email', async () => {
    const userRepository = {
      findByEmail: jest.fn().mockResolvedValue({ _id: '1' }),
    };
    const service = new UserService(userRepository);
    await expect(
      service.createUser({ name: 'A', email: 'a@b.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
