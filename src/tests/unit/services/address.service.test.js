import { describe, it, expect, jest } from '@jest/globals';
import { AddressService } from '../../../modules/address/address.service.js';
import { AppError } from '../../../common/errors/AppError.js';
import { MAX_ADDRESSES_PER_USER } from '../../../common/constants/address.js';

describe('AddressService (unit)', () => {
  it(`rejects when user already has ${MAX_ADDRESSES_PER_USER} addresses`, async () => {
    const addressRepository = {
      countActiveByUser: jest.fn().mockResolvedValue(MAX_ADDRESSES_PER_USER),
      clearDefaultForUser: jest.fn(),
      create: jest.fn(),
    };
    const service = new AddressService(addressRepository);

    await expect(
      service.createMine('user1', {
        fullName: 'A',
        phone: '+919876543210',
        line1: 'Line',
        city: 'City',
        state: 'State',
        pincode: '560001',
      }),
    ).rejects.toBeInstanceOf(AppError);

    expect(addressRepository.create).not.toHaveBeenCalled();
  });

  it('promotes newest address when deleting default', async () => {
    const addressRepository = {
      findActiveByIdForUser: jest.fn().mockResolvedValue({
        _id: 'addr1',
        userId: 'user1',
        isDefault: true,
      }),
      softDeleteForUser: jest.fn().mockResolvedValue({}),
      findLatestActiveForUser: jest.fn().mockResolvedValue({ _id: 'addr2' }),
      updateById: jest.fn().mockResolvedValue({ _id: 'addr2', isDefault: true }),
    };
    const service = new AddressService(addressRepository);

    await service.deleteMine('user1', 'addr1');

    expect(addressRepository.softDeleteForUser).toHaveBeenCalledWith('addr1', 'user1');
    expect(addressRepository.updateById).toHaveBeenCalledWith('addr2', { isDefault: true });
  });

  it('returns 404-style NotFound when address missing for user', async () => {
    const addressRepository = {
      findActiveByIdForUser: jest.fn().mockResolvedValue(null),
    };
    const service = new AddressService(addressRepository);

    await expect(service.getMineById('user1', 'deadbeefdeadbeefdeadbeef')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
