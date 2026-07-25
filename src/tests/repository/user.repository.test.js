import { describe, it, expect, beforeEach } from '@jest/globals';
import { registerMongoHooks } from '../mongo.js';
import { UserRepository } from '../../modules/user/user.repository.js';
import { UserModel } from '../../modules/user/user.model.js';

registerMongoHooks();

describe('UserRepository', () => {
  let repo;

  beforeEach(() => {
    repo = new UserRepository(UserModel);
  });

  it('creates and finds by email', async () => {
    await repo.create({
      name: 'Repo User',
      email: 'repo@example.com',
      password: 'password123',
      role: 'admin',
    });

    const found = await repo.findByEmail('repo@example.com');
    expect(found).toBeTruthy();
    expect(found.email).toBe('repo@example.com');
  });

  it('soft deletes a user', async () => {
    const created = await repo.create({
      name: 'Soft',
      email: 'soft@example.com',
      password: 'password123',
      role: 'admin',
    });

    const deleted = await repo.softDelete(created._id);
    expect(deleted.deletedAt).toBeTruthy();
    expect(deleted.isActive).toBe(false);
  });
});
