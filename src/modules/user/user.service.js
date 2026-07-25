import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { BaseService } from '../../common/base/BaseService.js';
import { AppError } from '../../common/errors/AppError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import { EventType } from '../../common/constants/enums.js';
import { buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import {
  parseListQuery,
  buildAppliedFilters,
  USER_SORT_FIELDS,
} from '../../common/helpers/list-query.helper.js';

export class UserService extends BaseService {
  /**
   * @param {import('./user.repository.js').UserRepository} userRepository
   * @param {import('../../core/events/EventBus.js').EventBus|null} eventBus
   * @param {import('../../core/redis/cache.service.js').CacheService|null} cacheService
   * @param {import('../../core/storage/StorageService.js').StorageService|null} storageService
   * @param {{ assertActiveRoleSlug?: Function }|null} roleService
   */
  constructor(
    userRepository,
    eventBus = null,
    cacheService = null,
    storageService = null,
    roleService = null,
  ) {
    super(eventBus, cacheService);
    this.userRepository = userRepository;
    this.storageService = storageService;
    this.roleService = roleService;
  }

  async #assertRoleSlug(slug) {
    if (!slug) return;
    if (this.roleService?.assertActiveRoleSlug) {
      await this.roleService.assertActiveRoleSlug(slug);
    }
  }

  async countByRole(slug) {
    if (!slug) return 0;
    return this.userRepository.countActive({ role: slug });
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
    throw new AppError(
      'Could not generate referral code',
      HttpStatus.INTERNAL_ERROR,
      ErrorCodes.INTERNAL_ERROR,
    );
  }

  async #resolveReferrer(referrerCode) {
    if (!referrerCode) return null;
    const referrer = await this.userRepository.findByReferralCode(referrerCode);
    if (!referrer) {
      throw new AppError('Invalid referral code', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
    return referrer._id;
  }

  async createUser(data) {
    const { referralCode: referrerCode, ...rest } = data;

    if (!rest.email) delete rest.email;
    if (!rest.phone) delete rest.phone;

    const [existingEmail, existingPhone] = await Promise.all([
      rest.email
        ? this.userRepository.findByEmail(rest.email, { includeDeleted: true, lean: true })
        : Promise.resolve(null),
      rest.phone
        ? this.userRepository.findByPhone(rest.phone, { includeDeleted: true, lean: true })
        : Promise.resolve(null),
      rest.role ? this.#assertRoleSlug(rest.role) : Promise.resolve(null),
    ]);

    if (existingEmail) {
      throw new AppError('Email already registered', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
    }
    if (existingPhone) {
      throw new AppError('Phone already registered', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
    }

    const referredBy = await this.#resolveReferrer(referrerCode);
    const ownReferralCode = await this.generateUniqueReferralCode();

    const user = await this.userRepository.create({
      ...rest,
      referredBy,
      referralCode: ownReferralCode,
    });
    const sanitized = this.#sanitize(user);
    this.emit(EventType.USER_CREATED, { user: sanitized });
    return sanitized;
  }

  async findOrCreateMobileUser({ phone, role, name, referralCode, fcmToken }) {
    let user = await this.userRepository.findByPhone(phone, { role, lean: false });
    if (user) {
      if (fcmToken) {
        user.fcmToken = fcmToken;
      }
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
    this.emit(EventType.USER_CREATED, { user: sanitized });
    return sanitized;
  }

  async findByEmailForAuth(email) {
    return this.userRepository.findByEmail(email, { includePassword: true, lean: false });
  }

  async findByPhone(phone, role) {
    return this.userRepository.findByPhone(phone, { role, lean: true });
  }

  async getUserById(id) {
    const cacheKey = this.cacheKey('user', id);
    const cached = await this.getCached(cacheKey);
    if (cached) return cached;

    const user = await this.userRepository.findActiveById(id);
    const found = this.ensureFound(user, 'User not found');
    const sanitized = this.#sanitize(found);
    await this.setCached(cacheKey, sanitized, 30);
    return sanitized;
  }

  async getMe(userId) {
    return this.getUserById(userId);
  }

  async listUsers(query) {
    const pagination = parseListQuery(query, {
      allowedSortFields: USER_SORT_FIELDS,
      defaultSort: '-createdAt',
    });
    const filter = this.userRepository.buildListFilter(query);

    const { items, total } = await this.userRepository.searchAndCount(filter, {
      skip: pagination.skip,
      limit: pagination.limit,
      sort: pagination.sort,
    });

    const meta = {
      ...buildPaginationMeta(total, pagination),
      sort: pagination.sort,
      filters: buildAppliedFilters(query, [
        'search',
        'role',
        'isActive',
        'gender',
        'createdFrom',
        'createdTo',
        'hasReferral',
      ]),
    };

    return {
      items: items.map((u) => this.#sanitize(u)),
      meta,
    };
  }

  async updateUser(id, data = {}, file = null) {
    const payload = { ...(data || {}) };

    if (payload.isActive === 'true') payload.isActive = true;
    if (payload.isActive === 'false') payload.isActive = false;

    if (file) {
      if (!this.storageService) {
        throw new AppError(
          'Storage service is not configured',
          HttpStatus.INTERNAL_ERROR,
          ErrorCodes.INTERNAL_ERROR,
        );
      }

      const existing = await this.userRepository.findActiveById(id);
      this.ensureFound(existing, 'User not found');

      const uploaded = await this.storageService.upload(file);
      payload.profileImage = {
        url: uploaded.url,
        publicId: uploaded.key,
      };

      if (existing.profileImage?.publicId) {
        try {
          await this.storageService.delete(existing.profileImage.publicId);
        } catch {
          // best-effort cleanup of previous object
        }
      }
    }

    if (!Object.keys(payload).length) {
      throw new AppError(
        'No fields to update',
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    if (payload.email || payload.phone) {
      const [existingEmail, existingPhone] = await Promise.all([
        payload.email
          ? this.userRepository.findByEmail(payload.email, { includeDeleted: true, lean: true })
          : Promise.resolve(null),
        payload.phone
          ? this.userRepository.findByPhone(payload.phone, { includeDeleted: true, lean: true })
          : Promise.resolve(null),
      ]);
      if (existingEmail && existingEmail._id.toString() !== id) {
        throw new AppError('Email already in use', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
      }
      if (existingPhone && existingPhone._id.toString() !== id) {
        throw new AppError('Phone already in use', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
      }
    }

    if (payload.password) {
      payload.password = await bcrypt.hash(payload.password, 12);
    }

    if (payload.role) {
      await this.#assertRoleSlug(payload.role);
    }

    const updated = await this.userRepository.updateById(id, payload);
    const found = this.ensureFound(updated, 'User not found');
    const sanitized = this.#sanitize(found);
    await this.invalidateCache(this.cacheKey('user', id));
    this.emit(EventType.USER_UPDATED, { user: sanitized });
    return sanitized;
  }

  async updateMe(userId, data, file = null) {
    return this.updateUser(userId, data, file);
  }

  async updateLastLogin(userId, extra = {}) {
    const updated = await this.userRepository.updateById(userId, {
      lastLoginAt: new Date(),
      ...extra,
    });
    await this.invalidateCache(this.cacheKey('user', userId));
    return this.#sanitize(updated);
  }

  async setPasswordByEmail(email, newPassword) {
    const user = await this.userRepository.findByEmail(email, { includePassword: true, lean: false });
    this.ensureFound(user, 'User not found');
    user.password = newPassword;
    await user.save();
    await this.invalidateCache(this.cacheKey('user', user._id.toString()));
    return this.#sanitize(user);
  }

  async deleteUser(id) {
    const deleted = await this.userRepository.softDelete(id);
    this.ensureFound(deleted, 'User not found');
    await this.invalidateCache(this.cacheKey('user', id));
    this.emit(EventType.USER_DELETED, { userId: id });
    return true;
  }
}
