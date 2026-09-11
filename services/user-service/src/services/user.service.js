import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { AppError, HttpStatus, ErrorCodes } from '@getready/errors';
import { EVENT_TYPES } from '@getready/rabbitmq';

export class UserService {
  /**
   * @param {import('../repositories/user.repository.js').UserRepository} userRepository
   * @param {import('./storage.service.js').StorageService} storageService
   * @param {import('./rbac.service.js').RbacService} rbacService
   * @param {import('@getready/rabbitmq').EventPublisher|null} eventPublisher
   */
  constructor(userRepository, storageService, rbacService, eventPublisher = null) {
    this.userRepository = userRepository;
    this.storageService = storageService;
    this.rbacService = rbacService;
    this.eventPublisher = eventPublisher;
  }

  #sanitize(user) {
    if (!user) return user;
    const obj = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
    delete obj.password;
    if (obj._id) obj.id = obj._id.toString();
    return obj;
  }

  async generateUniqueReferralCode() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const existing = await this.userRepository.findByReferralCode(code);
      if (!existing) return code;
    }
    throw new AppError('Could not generate referral code', HttpStatus.INTERNAL_ERROR, ErrorCodes.INTERNAL_ERROR);
  }

  async #resolveReferrer(referrerCode) {
    if (!referrerCode) return null;
    const referrer = await this.userRepository.findByReferralCode(referrerCode);
    if (!referrer) {
      throw new AppError('Invalid referral code', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
    return referrer._id;
  }

  async countByRole(roleSlug) {
    return this.userRepository.countActive({ role: roleSlug });
  }

  async createUser(data) {
    const { referralCode: referrerCode, ...rest } = data;

    if (!rest.email) delete rest.email;
    if (!rest.phone) delete rest.phone;

    const [existingEmail, existingPhone] = await Promise.all([
      rest.email ? this.userRepository.findByEmail(rest.email, { includeDeleted: true, lean: true }) : null,
      rest.phone ? this.userRepository.findByPhone(rest.phone, { includeDeleted: true, lean: true }) : null,
    ]);

    if (existingEmail) throw new AppError('Email already registered', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
    if (existingPhone) throw new AppError('Phone already registered', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);

    const referredBy = await this.#resolveReferrer(referrerCode);
    const ownReferralCode = await this.generateUniqueReferralCode();

    const user = await this.userRepository.create({
      ...rest,
      referredBy,
      referralCode: ownReferralCode,
    });

    const sanitized = this.#sanitize(user);

    if (this.eventPublisher) {
      this.eventPublisher.publish('user.created', EVENT_TYPES.USER_CREATED, {
        userId: sanitized.id,
        name: sanitized.name,
        email: sanitized.email,
        phone: sanitized.phone,
        role: sanitized.role,
        referralCode: sanitized.referralCode,
      }).catch(() => {});
    }

    return sanitized;
  }

  async findOrCreateMobileUser({ phone, role = 'customer', name, referralCode, fcmToken }) {
    let user = await this.userRepository.findByPhone(phone, { role, lean: false });
    if (user) {
      if (fcmToken) user.fcmToken = fcmToken;
      user.phoneVerifiedAt = new Date();
      user.lastLoginAt = new Date();
      await user.save();
      return this.#sanitize(user);
    }

    const referredBy = await this.#resolveReferrer(referralCode);
    const ownReferralCode = await this.generateUniqueReferralCode();

    user = await this.userRepository.create({
      name: name || 'User',
      phone,
      role,
      referredBy,
      referralCode: ownReferralCode,
      fcmToken: fcmToken || null,
      phoneVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    });

    const sanitized = this.#sanitize(user);

    if (this.eventPublisher) {
      this.eventPublisher.publish('user.created', EVENT_TYPES.USER_CREATED, {
        userId: sanitized.id,
        name: sanitized.name,
        phone: sanitized.phone,
        role: sanitized.role,
      }).catch(() => {});
    }

    return sanitized;
  }

  async findByEmailForAuth(email) {
    const user = await this.userRepository.findByEmail(email, { includePassword: true, lean: true });
    if (!user) return null;
    return {
      ...user,
      id: user._id.toString(),
      passwordHash: user.password,
    };
  }

  async getUserById(id) {
    const user = await this.userRepository.findActiveById(id);
    if (!user) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    return this.#sanitize(user);
  }

  async listUsers(query = {}) {
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '10', 10), 100);
    const skip = (page - 1) * limit;

    const filter = { deletedAt: null };
    if (query.role) filter.role = query.role.toLowerCase();
    if (query.status) filter.status = query.status.toUpperCase();
    if (query.isActive !== undefined) filter.isActive = query.isActive === 'true' || query.isActive === true;
    if (query.search) {
      const regex = new RegExp(query.search, 'i');
      filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
    }

    const { items, total } = await this.userRepository.searchAndCount(filter, { skip, limit, sort: '-createdAt' });

    return {
      items: items.map((u) => this.#sanitize(u)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateUser(id, data = {}, file = null) {
    const payload = { ...data };

    if (file && this.storageService) {
      const existingUser = await this.userRepository.findById(id).catch(() => null);
      const oldKey = existingUser?.profileImage?.publicId || existingUser?.profileImage?.key;
      const uploaded = await this.storageService.replace(file, oldKey, 'users/profile', true);
      payload.profileImage = {
        url: uploaded.url,
        publicId: uploaded.key,
        key: uploaded.key,
      };
      payload.profileImageUrl = uploaded.url;
    }

    if (payload.password) {
      payload.password = await bcrypt.hash(payload.password, 12);
    }

    const updated = await this.userRepository.updateById(id, payload);
    if (!updated) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);

    const sanitized = this.#sanitize(updated);

    if (this.eventPublisher) {
      this.eventPublisher.publish('user.updated', EVENT_TYPES.USER_UPDATED, {
        userId: id,
        name: sanitized.name,
        email: sanitized.email,
        phone: sanitized.phone,
      }).catch(() => {});
    }

    return sanitized;
  }

  async updateLastLogin(id, extra = {}) {
    const updated = await this.userRepository.updateById(id, {
      lastLoginAt: new Date(),
      ...extra,
    });
    return this.#sanitize(updated);
  }

  async setPasswordByEmail(email, newPassword) {
    const user = await this.userRepository.findByEmail(email, { includePassword: true, lean: false });
    if (!user) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    user.password = newPassword;
    await user.save();
    return this.#sanitize(user);
  }

  async deleteUser(id) {
    const deleted = await this.userRepository.softDelete(id);
    if (!deleted) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);

    if (this.eventPublisher) {
      this.eventPublisher.publish('user.deleted', EVENT_TYPES.USER_DELETED, {
        userId: id,
      }).catch(() => {});
    }

    return true;
  }
}
