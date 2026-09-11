import mongoose from 'mongoose';
import { AppError, NotFoundError, ValidationError } from '@getready/errors';
import { CartItemType, MAX_ITEM_QUANTITY, CART_CURRENCY } from '../models/cart.model.js';
import { computeCartPricing } from '../pricing/cart.pricing-engine.js';
import { toCartDto } from './cart.mapper.js';

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  return new mongoose.Types.ObjectId(id);
}

export class CartService {
  constructor(cartRepository, catalogClient, redisClient = null) {
    this.cartRepository = cartRepository;
    this.catalogClient = catalogClient;
    this.redis = redisClient;
  }

  async getCart(userId) {
    let cart = await this.cartRepository.findByUserId(userId);
    if (!cart) {
      cart = await this.cartRepository.createForUser(userId);
    }
    await this.recalculate(cart);
    return toCartDto(cart);
  }

  async clearCart(userId) {
    await this.cartRepository.deleteByUserId(userId);
    const newCart = await this.cartRepository.createForUser(userId);
    return toCartDto(newCart);
  }

  async recalculate(cart) {
    const pricing = computeCartPricing(cart, { currency: CART_CURRENCY });
    cart.pricing = pricing;
    await this.cartRepository.save(cart);
  }

  async addItem(userId, { itemType, refId, quantity = 1, forMemberId = null, selectedServiceIds = [] }) {
    let cart = await this.cartRepository.findByUserId(userId);
    if (!cart) {
      cart = await this.cartRepository.createForUser(userId);
    }

    let snapshot = null;
    let packageMeta = null;
    let selectedServices = [];

    if (itemType === CartItemType.SERVICE) {
      const service = await this.catalogClient.getServiceById(refId);
      if (!service) throw new NotFoundError('Service not found');
      snapshot = {
        name: service.name,
        thumbnail: service.thumbnail || service.imageUrl || null,
        durationLabel: service.durationLabel || `${service.durationMinMinutes || 30}m`,
        badges: service.badges || [],
        unitPrice: Number(service.discountedPrice ?? service.price ?? 0),
        mrp: Number(service.price ?? service.discountedPrice ?? 0),
        rating: Number(service.rating?.average || 4.8),
        homeVisitFee: Number(service.homeVisitFee || 0),
        extraCharge: Number(service.extraCharge || 0),
      };
    } else if (itemType === CartItemType.PACKAGE) {
      const pkg = await this.catalogClient.getPackageById(refId);
      if (!pkg) throw new NotFoundError('Package not found');
      snapshot = {
        name: pkg.name,
        thumbnail: pkg.thumbnail || pkg.imageUrl || null,
        durationLabel: pkg.durationLabel || '60m',
        badges: pkg.badges || [],
        unitPrice: Number(pkg.discountedPrice ?? pkg.price ?? 0),
        mrp: Number(pkg.originalPrice ?? pkg.price ?? 0),
        rating: Number(pkg.rating?.average || 4.9),
        homeVisitFee: Number(pkg.homeVisitFee || 0),
        extraCharge: Number(pkg.extraCharge || 0),
      };
      packageMeta = {
        subtitle: pkg.subtitle || `${pkg.items?.length || 0} services`,
        selectionRule: {
          minSelect: pkg.minSelectCount || 1,
          maxSelect: pkg.maxSelectCount || pkg.items?.length || 1,
        },
      };
      if (Array.isArray(pkg.items)) {
        selectedServices = pkg.items.map((item) => ({
          serviceId: item.serviceId?._id || item.serviceId,
          name: item.serviceId?.name || 'Service',
          durationMin: item.serviceId?.durationMinMinutes || null,
        }));
      }
    } else {
      throw new ValidationError('Invalid itemType');
    }

    const existingIndex = cart.items.findIndex(
      (item) =>
        item.itemType === itemType &&
        String(item.refId) === String(refId) &&
        String(item.forMemberId || '') === String(forMemberId || ''),
    );

    if (existingIndex > -1) {
      const newQty = cart.items[existingIndex].quantity + quantity;
      if (newQty > MAX_ITEM_QUANTITY) {
        throw new ValidationError(`Maximum quantity is ${MAX_ITEM_QUANTITY}`);
      }
      cart.items[existingIndex].quantity = newQty;
      cart.items[existingIndex].snapshot = snapshot;
    } else {
      cart.items.push({
        itemType,
        refId: toObjectId(refId),
        quantity,
        snapshot,
        packageMeta,
        selectedServices,
        forMemberId: toObjectId(forMemberId),
      });
    }

    await this.recalculate(cart);
    return toCartDto(cart);
  }

  async updateItemQuantity(userId, lineId, quantity) {
    const cart = await this.cartRepository.findByUserId(userId);
    if (!cart) throw new NotFoundError('Cart not found');

    const itemIndex = cart.items.findIndex((item) => String(item._id) === String(lineId));
    if (itemIndex === -1) throw new NotFoundError('Cart item not found');

    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else if (quantity > MAX_ITEM_QUANTITY) {
      throw new ValidationError(`Maximum quantity is ${MAX_ITEM_QUANTITY}`);
    } else {
      cart.items[itemIndex].quantity = quantity;
    }

    await this.recalculate(cart);
    return toCartDto(cart);
  }

  async removeItem(userId, lineId) {
    return this.updateItemQuantity(userId, lineId, 0);
  }

  async updateInstructions(userId, specialInstructions) {
    const cart = await this.cartRepository.findByUserId(userId);
    if (!cart) throw new NotFoundError('Cart not found');

    cart.specialInstructions = specialInstructions;
    await this.recalculate(cart);
    return toCartDto(cart);
  }

  async updateBenefits(userId, benefits) {
    const cart = await this.cartRepository.findByUserId(userId);
    if (!cart) throw new NotFoundError('Cart not found');

    cart.benefits = { ...cart.benefits, ...benefits };
    await this.recalculate(cart);
    return toCartDto(cart);
  }

  async updateHygieneKit(userId, count) {
    const cart = await this.cartRepository.findByUserId(userId);
    if (!cart) throw new NotFoundError('Cart not found');

    cart.hygieneKit = {
      hygieneKitId: cart.hygieneKit?.hygieneKitId || null,
      count: Math.max(1, count),
    };
    await this.recalculate(cart);
    return toCartDto(cart);
  }

  async syncCart(userId, items = []) {
    let cart = await this.cartRepository.findByUserId(userId);
    if (!cart) {
      cart = await this.cartRepository.createForUser(userId);
    }
    cart.items = [];
    for (const item of items) {
      await this.addItem(userId, item);
    }
    return this.getCart(userId);
  }

  async updatePackageSelections(userId, lineId, selectedServices = []) {
    const cart = await this.cartRepository.findByUserId(userId);
    if (!cart) throw new NotFoundError('Cart not found');

    const item = cart.items.find((i) => String(i._id) === String(lineId));
    if (!item) throw new NotFoundError('Cart item not found');

    item.selectedServices = selectedServices;
    await this.recalculate(cart);
    return toCartDto(cart);
  }

  async updateRecipient(userId, lineId, forMemberId) {
    const cart = await this.cartRepository.findByUserId(userId);
    if (!cart) throw new NotFoundError('Cart not found');

    const item = cart.items.find((i) => String(i._id) === String(lineId));
    if (!item) throw new NotFoundError('Cart item not found');

    item.forMemberId = toObjectId(forMemberId);
    await this.recalculate(cart);
    return toCartDto(cart);
  }

  async bookForOthers(userId, { mode, memberId }) {
    const cart = await this.cartRepository.findByUserId(userId);
    if (!cart) throw new NotFoundError('Cart not found');

    const targetMemberId = toObjectId(memberId);
    for (const item of cart.items) {
      item.forMemberId = targetMemberId;
    }
    await this.recalculate(cart);
    return toCartDto(cart);
  }
}
