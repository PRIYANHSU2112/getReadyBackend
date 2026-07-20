import { describe, it, expect, jest } from '@jest/globals';
import { UserController } from '../../../modules/user/user.controller.js';

describe('UserController (unit)', () => {
  it('lists users with meta', async () => {
    const userService = {
      listUsers: jest.fn().mockResolvedValue({
        items: [{ email: 'a@b.com' }],
        meta: { total: 1, page: 1, limit: 10 },
      }),
    };
    const controller = new UserController(userService);
    const req = { query: {} };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await controller.list(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.any(Array),
        meta: expect.any(Object),
      }),
    );
  });
});
