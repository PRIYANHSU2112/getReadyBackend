import { AppError, HttpStatus, ErrorCodes } from '@getready/errors';
import { EVENT_TYPES } from '@getready/rabbitmq';

export class AddressService {
  constructor(addressRepository, eventPublisher = null) {
    this.addressRepository = addressRepository;
    this.eventPublisher = eventPublisher;
  }

  async listForUser(userId) {
    return this.addressRepository.findActiveByUserId(userId);
  }

  async getById(id, userId) {
    const address = await this.addressRepository.findActiveById(id, userId);
    if (!address) throw new AppError('Address not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return address;
  }

  async create(userId, data) {
    const created = await this.addressRepository.create({ ...data, userId });
    if (this.eventPublisher) {
      this.eventPublisher.publish('address.created', EVENT_TYPES.ADDRESS_CREATED, {
        addressId: created._id.toString(),
        userId,
        city: created.city,
        pincode: created.pincode,
      }).catch(() => {});
    }
    return created;
  }

  async update(id, userId, data) {
    const updated = await this.addressRepository.updateById(id, userId, data);
    if (!updated) throw new AppError('Address not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    if (this.eventPublisher) {
      this.eventPublisher.publish('address.updated', EVENT_TYPES.ADDRESS_UPDATED, {
        addressId: id,
        userId,
      }).catch(() => {});
    }
    return updated;
  }

  async remove(id, userId) {
    const deleted = await this.addressRepository.softDelete(id, userId);
    if (!deleted) throw new AppError('Address not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return true;
  }

  async setDefault(id, userId) {
    const updated = await this.addressRepository.setDefault(id, userId);
    if (!updated) throw new AppError('Address not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return updated;
  }
}
