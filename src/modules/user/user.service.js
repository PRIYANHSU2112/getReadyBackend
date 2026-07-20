import bcrypt from 'bcryptjs';
import { BaseService } from '../../common/base/BaseService.js';
import { AppError } from '../../common/errors/AppError.js';
import { UnauthorizedError } from '../../common/errors/UnauthorizedError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import { EventType } from '../../common/constants/enums.js';
import { parsePagination, buildPaginationMeta } from '../../common/helpers/pagination.helper.js';

export class UserService extends BaseService {
  /**
   * @param {import('./user.repository.js').UserRepository} userRepository
   * @param {import('../../core/events/EventBus.js').EventBus|null} eventBus
   * @param {import('../../core/redis/cache.service.js').CacheService|null} cacheService
   * @param {import('../../common/utils/jwt.util.js').JwtUtil|null} jwtUtil
   */
  constructor(userRepository, eventBus = null, cacheService = null, jwtUtil = null) {
    super(eventBus, cacheService);
    this.userRepository = userRepository;
    this.jwtUtil = jwtUtil;
  }

  #sanitize(user) {
    if (!user) return user;
    const obj = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
    delete obj.password;
    return obj;
  }

  async createUser(data) {
    const existing = await this.userRepository.findByEmail(data.email);
    if (existing) {
      throw new AppError('Email already registered', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
    }

    const user = await this.userRepository.create(data);
    const sanitized = this.#sanitize(user);
    this.emit(EventType.USER_CREATED, { user: sanitized });
    return sanitized;
  }

  async login(email, password) {
    const user = await this.userRepository.findByEmail(email, { includePassword: true });
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const match = await user.comparePassword(password);
    if (!match) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!this.jwtUtil) {
      throw new AppError('JWT util not configured', HttpStatus.INTERNAL_ERROR);
    }

    const token = this.jwtUtil.sign({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    return { token, user: this.#sanitize(user) };
  }

  async getUserById(id) {
    const cacheKey = this.cacheKey('user', id);
    const cached = await this.getCached(cacheKey);
    if (cached) return cached;

    const user = await this.userRepository.findActiveById(id);
    const found = this.ensureFound(user, 'User not found');
    const sanitized = this.#sanitize(found);
    await this.setCached(cacheKey, sanitized);
    return sanitized;
  }

  async listUsers(query) {
    const pagination = parsePagination(query);
    const filter = {};
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.userRepository.search(filter, {
        skip: pagination.skip,
        limit: pagination.limit,
        sort: pagination.sort,
      }),
      this.userRepository.countActive(filter),
    ]);

    return {
      items: items.map((u) => this.#sanitize(u)),
      meta: buildPaginationMeta(total, pagination),
    };
  }

  async updateUser(id, data) {
    if (data.email) {
      const existing = await this.userRepository.findByEmail(data.email);
      if (existing && existing._id.toString() !== id) {
        throw new AppError('Email already in use', HttpStatus.CONFLICT, ErrorCodes.CONFLICT);
      }
    }

    if (data.password) {
      data.password = await bcrypt.hash(data.password, 12);
    }

    const updated = await this.userRepository.updateById(id, data);
    const found = this.ensureFound(updated, 'User not found');
    const sanitized = this.#sanitize(found);
    await this.invalidateCache(this.cacheKey('user', id));
    this.emit(EventType.USER_UPDATED, { user: sanitized });
    return sanitized;
  }

  async deleteUser(id) {
    const deleted = await this.userRepository.softDelete(id);
    this.ensureFound(deleted, 'User not found');
    await this.invalidateCache(this.cacheKey('user', id));
    this.emit(EventType.USER_DELETED, { userId: id });
    return true;
  }
}
