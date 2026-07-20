import { describe, it, expect, jest } from '@jest/globals';
import { UserController } from '../../modules/user/user.controller.js';
import { HttpStatus } from '../../common/constants/http-status.js';

describe('UserController', () => {
  it('returns created user', async () => {
    const userService = {
      createUser: jest.fn().mockResolvedValue({ id: '1', email: 'a@b.com' }),
    };
    const controller = new UserController(userService);
    const req = { body: { name: 'A', email: 'a@b.com', password: 'password123' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await controller.create(req, res);

    expect(userService.createUser).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.any(Object) }),
    );
  });
});
