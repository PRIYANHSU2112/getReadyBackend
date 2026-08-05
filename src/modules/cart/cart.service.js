import mongoose from 'mongoose';
import { BaseService } from '../../common/base/BaseService.js';
import { AppError } from '../../common/errors/AppError.js';
import { NotFoundError } from '../../common/errors/NotFoundError.js';
import { ValidationError } from '../../common/errors/ValidationError.js';
import { HttpStatus } from '../../common/constants/http-status.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import {
  CartItemType,
  ServiceStatus,
  BookForOthersMode,
} from '../../common/constants/enums.js';
import {
  MAX_CART_ITEMS,
  MAX_ITEM_QUANTITY,
  CART_CACHE_TTL_SECONDS,
  CART_TTL_DAYS,
} from '../../common/constants/cart.js';
import { PackageStatus } from '../package/package.enum.js';
import { computeCartPricing } from './cart.pricing-engine.js';
import { toCartDto } from './cart.mapper.js';

function toObjectId(id) {
  if (!id) return id;
  if (id instanceof mongoose.Types.ObjectId) return id;
  return new mongoose.Types.ObjectId(id);
}

function formatDurationLabel(minMinutes, maxMinutes) {
  if (minMinutes == null && maxMinutes == null) return null;
  if (minMinutes != null && maxMinutes != null && minMinutes !== maxMinutes) {
    if (minMinutes >= 60 || maxMinutes >= 60) {
      const minHrs = (minMinutes / 60).toFixed(minMinutes % 60 === 0 ? 0 : 1);
      const maxHrs = (maxMinutes / 60).toFixed(maxMinutes % 60 === 0 ? 0 : 1);
      return `${minHrs}-${maxHrs} hrs`;
    }
    return `${minMinutes}-${maxMinutes}m`;
  }
  const value = minMinutes ?? maxMinutes;
  if (value >= 60 && value % 60 === 0) return `${value / 60} hrs`;
  if (value >= 60) return `${(value / 60).toFixed(1)} hrs`;
  return `${value}m`;
}

function sellingPrice(entity) {
  const discounted = entity?.discountedPrice;
  if (discounted != null && discounted >= 0) return Number(discounted);
  return Number(entity?.price) || 0;
}

function serviceMrp(entity) {
  const price = Number(entity?.price);
  const unit = sellingPrice(entity);
  if (Number.isFinite(price) && price > unit) return price;
  return unit;
}

function packageMrp(entity) {
  const original = Number(entity?.originalPrice);
  const price = Number(entity?.price);
  const unit = sellingPrice(entity);
  if (Number.isFinite(original) && original > unit) return original;
  if (Number.isFinite(price) && price > unit) return price;
  return unit;
}

function packageSubtitle(pkg) {
  if (pkg.selectionNotice) return pkg.selectionNotice;
  const min = pkg.minSelectCount ?? 1;
  const max = pkg.maxSelectCount ?? min;
  if (min === max) return `Any ${max} · ${max} services`;
  return `Any ${min}-${max} · ${pkg.items?.length || 0} services`;
}

function resolvePackageItemServiceId(item) {
  const raw = item?.serviceId;
  if (!raw) return null;
  if (typeof raw === 'object' && raw._id) return raw._id.toString();
  return raw.toString();
}

function resolvePackageItemName(item) {
  const raw = item?.serviceId;
  if (raw && typeof raw === 'object' && raw.name) return raw.name;
  return 'Service';
}

function resolvePackageItemDuration(item) {
  const raw = item?.serviceId;
  if (raw && typeof raw === 'object' && raw.durationMinMinutes != null) {
    return raw.durationMinMinutes;
  }
  return null;
}

function memberKey(forMemberId) {
  if (forMemberId == null || forMemberId === '') return 'self';
  return String(forMemberId);
}

function buildMemberSnapshot(member) {
  if (!member) return null;
  return {
    name: member.name,
    relationship: member.relationship || null,
    avatarUrl: member.avatarUrl || null,
    phone: member.phone || null,
  };
}

function cloneSelectedServices(list = []) {
  return list.map((row) => ({
    serviceId: row.serviceId,
    name: row.name,
    durationMin: row.durationMin ?? null,
  }));
}

function clonePackageMeta(meta) {
  if (!meta) return null;
  return {
    subtitle: meta.subtitle ?? null,
    selectionRule: meta.selectionRule
      ? {
          minSelect: meta.selectionRule.minSelect ?? null,
          maxSelect: meta.selectionRule.maxSelect ?? null,
        }
      : null,
  };
}

export class CartService extends BaseService {
  /**
   * @param {import('./cart.repository.js').CartRepository} cartRepository
   * @param {object} serviceRepository
   * @param {object} packageRepository
   * @param {import('../../core/redis/cache.service.js').CacheService|null} cacheService
   * @param {{
   *   walletProvider: { getBalance(userId: string): Promise<number> },
   *   couponProvider: { resolveCoupon(code: string|null, ctx: object): Promise<{code:string,discountAmount:number}|null> },
   *   creditsProvider: { getBalance(userId: string): Promise<number> },
   *   cashbackProvider: { getBalance(userId: string): Promise<number> },
   * }} providers
   * @param {import('../member/member.repository.js').MemberRepository|null} memberRepository
   */
  constructor(
    cartRepository,
    serviceRepository,
    packageRepository,
    cacheService = null,
    providers = {},
    memberRepository = null,
  ) {
    super(null, cacheService);
    this.cartRepository = cartRepository;
    this.serviceRepository = serviceRepository;
    this.packageRepository = packageRepository;
    this.memberRepository = memberRepository;
    this.walletProvider = providers.walletProvider;
    this.couponProvider = providers.couponProvider;
    this.creditsProvider = providers.creditsProvider;
    this.cashbackProvider = providers.cashbackProvider;
  }

  async #resolveRecipient(userId, forMemberId) {
    if (forMemberId == null || forMemberId === '') {
      return { forMemberId: null, forMemberSnapshot: null };
    }
    if (!this.memberRepository) {
      throw new AppError(
        'Member not found',
        HttpStatus.NOT_FOUND,
        ErrorCodes.MEMBER_NOT_FOUND,
      );
    }
    const member = await this.memberRepository.findActiveByIdForUser(forMemberId, userId);
    if (!member) {
      throw new AppError(
        'Member not found',
        HttpStatus.NOT_FOUND,
        ErrorCodes.MEMBER_NOT_FOUND,
      );
    }
    return {
      forMemberId: toObjectId(forMemberId),
      forMemberSnapshot: buildMemberSnapshot(member),
    };
  }

  #cacheKey(userId) {
    return this.cacheKey('cart', 'user', userId);
  }

  async #invalidateAndCache(userId, dto) {
    const key = this.#cacheKey(userId);
    await this.invalidateCache(key);
    await this.setCached(key, dto, CART_CACHE_TTL_SECONDS);
  }

  #assertBenefitExclusive(benefits) {
    const hasCoupon = Boolean(benefits?.couponCode);
    const usesRewards =
      Boolean(benefits?.useWallet) ||
      Boolean(benefits?.useCredits) ||
      Boolean(benefits?.useCashback);

    if (hasCoupon && usesRewards) {
      throw new AppError(
        'Only one benefit per order — Points/Wallet or Coupon, not both',
        HttpStatus.CONFLICT,
        ErrorCodes.CART_BENEFIT_CONFLICT,
      );
    }
  }

  #touchExpiry(cartDoc) {
    const expires = new Date();
    expires.setDate(expires.getDate() + CART_TTL_DAYS);
    cartDoc.expiresAt = expires;
  }

  async #loadBenefitBalances(userId) {
    const [walletBalance, creditsBalance, cashbackBalance] = await Promise.all([
      this.walletProvider?.getBalance(userId) ?? 0,
      this.creditsProvider?.getBalance(userId) ?? 0,
      this.cashbackProvider?.getBalance(userId) ?? 0,
    ]);
    return {
      walletBalance: Number(walletBalance) || 0,
      creditsBalance: Number(creditsBalance) || 0,
      cashbackBalance: Number(cashbackBalance) || 0,
    };
  }

  async #resolveCouponDiscount(userId, cart, subtotal) {
    const code = cart.benefits?.couponCode || null;
    if (!code) return 0;
    const resolved = await this.couponProvider.resolveCoupon(code, { userId, subtotal });
    return Number(resolved?.discountAmount) || 0;
  }

  async #repriceAndPersist(cartDoc, userId) {
    this.#assertBenefitExclusive(cartDoc.benefits || {});
    this.#touchExpiry(cartDoc);

    const balances = await this.#loadBenefitBalances(userId);
    const draftPricing = computeCartPricing(cartDoc, {
      walletBalance: 0,
      creditsBalance: 0,
      cashbackBalance: 0,
      couponDiscount: 0,
    });
    const couponDiscount = await this.#resolveCouponDiscount(
      userId,
      cartDoc,
      draftPricing.subtotal,
    );

    cartDoc.pricing = computeCartPricing(cartDoc, {
      ...balances,
      couponDiscount,
    });

    await this.cartRepository.saveDocument(cartDoc);
    const dto = toCartDto(cartDoc, balances);
    await this.#invalidateAndCache(userId, dto);
    return dto;
  }

  async #getOrCreateDocument(userId) {
    let cartDoc = await this.cartRepository.findDocumentByUserId(userId);
    if (!cartDoc) {
      cartDoc = await this.cartRepository.createForUser(userId);
      // create returns a document
      if (typeof cartDoc.save !== 'function') {
        cartDoc = await this.cartRepository.findDocumentByUserId(userId);
      }
    }
    return cartDoc;
  }

  async getCart(userId) {
    const key = this.#cacheKey(userId);
    const cached = await this.getCached(key);
    if (cached) return cached;

    const cartDoc = await this.#getOrCreateDocument(userId);
    if (!cartDoc.pricing || !cartDoc.pricing.computedAt) {
      return this.#repriceAndPersist(cartDoc, userId);
    }

    const balances = await this.#loadBenefitBalances(userId);
    const dto = toCartDto(cartDoc, balances);
    await this.setCached(key, dto, CART_CACHE_TTL_SECONDS);
    return dto;
  }

  async #findBookableService(refId) {
    const service = await this.serviceRepository.findActiveById(refId);
    if (
      !service ||
      service.isActive === false ||
      service.status !== ServiceStatus.APPROVED ||
      service.price == null
    ) {
      throw new NotFoundError('Service not found or unavailable');
    }
    return service;
  }

  async #findBookablePackage(refId) {
    const pkg = await this.packageRepository.findPublicById(refId);
    if (!pkg || pkg.status !== PackageStatus.APPROVED) {
      throw new NotFoundError('Package not found or unavailable');
    }
    return pkg;
  }

  #buildServiceSnapshot(service) {
    return {
      name: service.name,
      thumbnail: service.thumbnail?.url || null,
      durationLabel: formatDurationLabel(
        service.durationMinMinutes,
        service.durationMaxMinutes,
      ),
      badges: service.badges || [],
      unitPrice: sellingPrice(service),
      mrp: serviceMrp(service),
      rating: service.ratingAvg ?? null,
      homeVisitFee: Number(service.homeVisitFee) || 0,
      extraCharge: 0,
    };
  }

  #buildPackageSnapshot(pkg, selectedExtraCharge = 0) {
    return {
      name: pkg.name,
      thumbnail: pkg.thumbnail?.url || null,
      durationLabel: formatDurationLabel(
        pkg.durationMinMinutes,
        pkg.durationMaxMinutes,
      ),
      badges: pkg.badges || [],
      unitPrice: sellingPrice(pkg),
      mrp: packageMrp(pkg),
      rating: pkg.ratingAvg ?? null,
      homeVisitFee: 0,
      extraCharge: selectedExtraCharge,
    };
  }

  #resolveSelectedServices(pkg, selectedServiceIds = []) {
    const catalogItems = pkg.items || [];
    const catalogById = new Map(
      catalogItems.map((item) => [resolvePackageItemServiceId(item), item]),
    );

    const mandatoryIds = catalogItems
      .filter((item) => item.isMandatory)
      .map((item) => resolvePackageItemServiceId(item));

    let ids = [...selectedServiceIds.map(String)];

    if (!ids.length) {
      ids = catalogItems
        .filter((item) => item.isDefaultSelected || item.isMandatory)
        .map((item) => resolvePackageItemServiceId(item));
    }

    for (const mandatoryId of mandatoryIds) {
      if (!ids.includes(mandatoryId)) ids.push(mandatoryId);
    }

    ids = [...new Set(ids)];

    const minSelect = pkg.minSelectCount ?? 1;
    const maxSelect = pkg.maxSelectCount ?? (catalogItems.length || 1);

    if (ids.length < minSelect || ids.length > maxSelect) {
      throw new AppError(
        `Package requires between ${minSelect} and ${maxSelect} services`,
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.CART_INVALID_SELECTION,
      );
    }

    for (const id of ids) {
      if (!catalogById.has(id)) {
        throw new AppError(
          'Selected service is not part of this package',
          HttpStatus.UNPROCESSABLE,
          ErrorCodes.CART_INVALID_SELECTION,
          true,
          [{ field: 'selectedServiceIds', message: `Invalid service ${id}` }],
        );
      }
    }

    let extraCharge = 0;
    const selectedServices = ids.map((id) => {
      const item = catalogById.get(id);
      extraCharge += Number(item.extraCharge) || 0;
      return {
        serviceId: toObjectId(id),
        name: resolvePackageItemName(item),
        durationMin: resolvePackageItemDuration(item),
      };
    });

    return { selectedServices, extraCharge };
  }

  async addItem(userId, payload) {
    const cartDoc = await this.#getOrCreateDocument(userId);
    const quantity = payload.quantity || 1;

    if (quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
      throw new ValidationError('Invalid quantity');
    }

    const recipient = await this.#resolveRecipient(userId, payload.forMemberId);
    const recipientKey = memberKey(recipient.forMemberId);

    const existing = cartDoc.items.find(
      (item) =>
        item.itemType === payload.itemType &&
        item.refId.toString() === payload.refId &&
        memberKey(item.forMemberId) === recipientKey &&
        payload.itemType === CartItemType.SERVICE,
    );

    if (existing && payload.itemType === CartItemType.SERVICE) {
      const nextQty = existing.quantity + quantity;
      if (nextQty > MAX_ITEM_QUANTITY) {
        throw new AppError(
          `Quantity cannot exceed ${MAX_ITEM_QUANTITY}`,
          HttpStatus.UNPROCESSABLE,
          ErrorCodes.VALIDATION_ERROR,
        );
      }
      existing.quantity = nextQty;
      return this.#repriceAndPersist(cartDoc, userId);
    }

    if (cartDoc.items.length >= MAX_CART_ITEMS) {
      throw new AppError(
        `Cart cannot exceed ${MAX_CART_ITEMS} items`,
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.CART_ITEM_LIMIT,
      );
    }

    if (payload.itemType === CartItemType.SERVICE) {
      const service = await this.#findBookableService(payload.refId);
      cartDoc.items.push({
        itemType: CartItemType.SERVICE,
        refId: toObjectId(payload.refId),
        quantity,
        snapshot: this.#buildServiceSnapshot(service),
        packageMeta: null,
        selectedServices: [],
        forMemberId: recipient.forMemberId,
        forMemberSnapshot: recipient.forMemberSnapshot,
      });
    } else {
      const pkg = await this.#findBookablePackage(payload.refId);
      const { selectedServices, extraCharge } = this.#resolveSelectedServices(
        pkg,
        payload.selectedServiceIds || [],
      );
      cartDoc.items.push({
        itemType: CartItemType.PACKAGE,
        refId: toObjectId(payload.refId),
        quantity,
        snapshot: this.#buildPackageSnapshot(pkg, extraCharge),
        packageMeta: {
          subtitle: packageSubtitle(pkg),
          selectionRule: {
            minSelect: pkg.minSelectCount ?? 1,
            maxSelect: pkg.maxSelectCount ?? 1,
          },
        },
        selectedServices,
        forMemberId: recipient.forMemberId,
        forMemberSnapshot: recipient.forMemberSnapshot,
      });
    }

    return this.#repriceAndPersist(cartDoc, userId);
  }

  #findLine(cartDoc, lineId) {
    const line = cartDoc.items.id(lineId);
    if (!line) {
      throw new NotFoundError('Cart item not found');
    }
    return line;
  }

  async updateItemQuantity(userId, lineId, quantity) {
    const cartDoc = await this.#getOrCreateDocument(userId);
    const line = this.#findLine(cartDoc, lineId);

    if (quantity === 0) {
      line.deleteOne();
      return this.#repriceAndPersist(cartDoc, userId);
    }

    if (quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
      throw new ValidationError(`Quantity must be between 1 and ${MAX_ITEM_QUANTITY}`);
    }

    line.quantity = quantity;
    return this.#repriceAndPersist(cartDoc, userId);
  }

  async removeItem(userId, lineId) {
    const cartDoc = await this.#getOrCreateDocument(userId);
    const line = this.#findLine(cartDoc, lineId);
    line.deleteOne();
    return this.#repriceAndPersist(cartDoc, userId);
  }

  async updatePackageSelections(userId, lineId, selectedServiceIds) {
    const cartDoc = await this.#getOrCreateDocument(userId);
    const line = this.#findLine(cartDoc, lineId);

    if (line.itemType !== CartItemType.PACKAGE) {
      throw new ValidationError('Selections can only be updated for package items');
    }

    const pkg = await this.#findBookablePackage(line.refId.toString());
    const { selectedServices, extraCharge } = this.#resolveSelectedServices(
      pkg,
      selectedServiceIds,
    );

    line.selectedServices = selectedServices;
    line.snapshot = this.#buildPackageSnapshot(pkg, extraCharge);
    line.packageMeta = {
      subtitle: packageSubtitle(pkg),
      selectionRule: {
        minSelect: pkg.minSelectCount ?? 1,
        maxSelect: pkg.maxSelectCount ?? 1,
      },
    };

    return this.#repriceAndPersist(cartDoc, userId);
  }

  async updateInstructions(userId, specialInstructions) {
    const cartDoc = await this.#getOrCreateDocument(userId);
    const value =
      specialInstructions == null || specialInstructions === ''
        ? null
        : String(specialInstructions).trim();
    cartDoc.specialInstructions = value;
    return this.#repriceAndPersist(cartDoc, userId);
  }

  async updateBenefits(userId, payload) {
    const cartDoc = await this.#getOrCreateDocument(userId);
    const benefits = {
      useWallet: cartDoc.benefits?.useWallet ?? false,
      couponCode: cartDoc.benefits?.couponCode ?? null,
      useCredits: cartDoc.benefits?.useCredits ?? false,
      useCashback: cartDoc.benefits?.useCashback ?? false,
      membershipOptIn: cartDoc.benefits?.membershipOptIn ?? false,
    };

    if (payload.useWallet !== undefined) benefits.useWallet = payload.useWallet;
    if (payload.useCredits !== undefined) benefits.useCredits = payload.useCredits;
    if (payload.useCashback !== undefined) benefits.useCashback = payload.useCashback;
    if (payload.membershipOptIn !== undefined) {
      benefits.membershipOptIn = payload.membershipOptIn;
    }
    if (payload.couponCode !== undefined) {
      benefits.couponCode =
        payload.couponCode == null || payload.couponCode === ''
          ? null
          : String(payload.couponCode).trim().toUpperCase();
    }

    this.#assertBenefitExclusive(benefits);
    cartDoc.benefits = benefits;
    return this.#repriceAndPersist(cartDoc, userId);
  }

  async updateRecipient(userId, lineId, forMemberId) {
    const cartDoc = await this.#getOrCreateDocument(userId);
    const line = this.#findLine(cartDoc, lineId);
    const recipient = await this.#resolveRecipient(userId, forMemberId);

    // If another SERVICE line already matches ref+recipient, merge quantities
    if (line.itemType === CartItemType.SERVICE) {
      const duplicate = cartDoc.items.find(
        (item) =>
          item._id.toString() !== lineId &&
          item.itemType === CartItemType.SERVICE &&
          item.refId.toString() === line.refId.toString() &&
          memberKey(item.forMemberId) === memberKey(recipient.forMemberId),
      );
      if (duplicate) {
        const nextQty = duplicate.quantity + line.quantity;
        if (nextQty > MAX_ITEM_QUANTITY) {
          throw new AppError(
            `Quantity cannot exceed ${MAX_ITEM_QUANTITY}`,
            HttpStatus.UNPROCESSABLE,
            ErrorCodes.VALIDATION_ERROR,
          );
        }
        duplicate.quantity = nextQty;
        line.deleteOne();
        return this.#repriceAndPersist(cartDoc, userId);
      }
    }

    line.forMemberId = recipient.forMemberId;
    line.forMemberSnapshot = recipient.forMemberSnapshot;
    return this.#repriceAndPersist(cartDoc, userId);
  }

  async bookForOthers(userId, { memberIds, mode = BookForOthersMode.SAME_SERVICES }) {
    if (mode !== BookForOthersMode.SAME_SERVICES) {
      throw new ValidationError('Only SAME_SERVICES mode is supported');
    }

    const cartDoc = await this.#getOrCreateDocument(userId);
    const selfLines = cartDoc.items.filter((item) => !item.forMemberId);

    if (!selfLines.length) {
      throw new AppError(
        'Add services for yourself first before booking the same services for others',
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.CART_NO_SELF_ITEMS,
      );
    }

    const uniqueMemberIds = [...new Set((memberIds || []).map(String))];
    const recipients = [];
    for (const memberId of uniqueMemberIds) {
      recipients.push(await this.#resolveRecipient(userId, memberId));
    }

    const clonesNeeded = selfLines.length * recipients.length;
    if (cartDoc.items.length + clonesNeeded > MAX_CART_ITEMS) {
      throw new AppError(
        `Cart cannot exceed ${MAX_CART_ITEMS} items`,
        HttpStatus.UNPROCESSABLE,
        ErrorCodes.CART_ITEM_LIMIT,
      );
    }

    for (const recipient of recipients) {
      for (const source of selfLines) {
        // Skip if this member already has the same SERVICE line — bump qty instead
        if (source.itemType === CartItemType.SERVICE) {
          const existing = cartDoc.items.find(
            (item) =>
              item.itemType === CartItemType.SERVICE &&
              item.refId.toString() === source.refId.toString() &&
              memberKey(item.forMemberId) === memberKey(recipient.forMemberId),
          );
          if (existing) {
            const nextQty = existing.quantity + source.quantity;
            if (nextQty > MAX_ITEM_QUANTITY) {
              throw new AppError(
                `Quantity cannot exceed ${MAX_ITEM_QUANTITY}`,
                HttpStatus.UNPROCESSABLE,
                ErrorCodes.VALIDATION_ERROR,
              );
            }
            existing.quantity = nextQty;
            continue;
          }
        }

        cartDoc.items.push({
          itemType: source.itemType,
          refId: source.refId,
          quantity: source.quantity,
          snapshot: {
            name: source.snapshot.name,
            thumbnail: source.snapshot.thumbnail ?? null,
            durationLabel: source.snapshot.durationLabel ?? null,
            badges: [...(source.snapshot.badges || [])],
            unitPrice: source.snapshot.unitPrice,
            mrp: source.snapshot.mrp ?? null,
            rating: source.snapshot.rating ?? null,
            homeVisitFee: source.snapshot.homeVisitFee ?? 0,
            extraCharge: source.snapshot.extraCharge ?? 0,
          },
          packageMeta: clonePackageMeta(source.packageMeta),
          selectedServices: cloneSelectedServices(source.selectedServices),
          forMemberId: recipient.forMemberId,
          forMemberSnapshot: recipient.forMemberSnapshot,
        });
      }
    }

    return this.#repriceAndPersist(cartDoc, userId);
  }

  async clear(userId) {
    const cartDoc = await this.#getOrCreateDocument(userId);
    cartDoc.items = [];
    cartDoc.specialInstructions = null;
    cartDoc.benefits = {
      useWallet: false,
      couponCode: null,
      useCredits: false,
      useCashback: false,
      membershipOptIn: false,
    };
    cartDoc.checkedOutAt = null;
    return this.#repriceAndPersist(cartDoc, userId);
  }
}
