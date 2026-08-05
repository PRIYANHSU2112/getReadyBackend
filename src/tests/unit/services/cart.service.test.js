import { describe, it, expect, jest } from '@jest/globals';
import { CartService } from '../../../modules/cart/cart.service.js';
import { CartItemType, ServiceStatus } from '../../../common/constants/enums.js';
import { ErrorCodes } from '../../../common/constants/error-codes.js';
import { AppError } from '../../../common/errors/AppError.js';

function makeCartDoc(overrides = {}) {
  const items = overrides.items || [];
  const doc = {
    userId: '507f1f77bcf86cd799439011',
    items,
    specialInstructions: null,
    benefits: {
      useWallet: false,
      couponCode: null,
      useCredits: false,
      useCashback: false,
      membershipOptIn: false,
      ...(overrides.benefits || {}),
    },
    pricing: null,
    expiresAt: null,
    checkedOutAt: null,
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };

  doc.items.id = (lineId) => doc.items.find((i) => i._id?.toString() === lineId) || null;
  return doc;
}

describe('CartService (unit)', () => {
  it('rejects coupon + wallet together', async () => {
    const cartDoc = makeCartDoc();
    const cartRepository = {
      findDocumentByUserId: jest.fn().mockResolvedValue(cartDoc),
      saveDocument: jest.fn().mockImplementation(async (d) => d),
    };
    const service = new CartService(
      cartRepository,
      {},
      {},
      null,
      {
        walletProvider: { getBalance: async () => 100 },
        couponProvider: { resolveCoupon: async () => null },
        creditsProvider: { getBalance: async () => 0 },
        cashbackProvider: { getBalance: async () => 0 },
      },
    );

    await expect(
      service.updateBenefits('507f1f77bcf86cd799439011', {
        useWallet: true,
        couponCode: 'FIRST100',
      }),
    ).rejects.toMatchObject({
      code: ErrorCodes.CART_BENEFIT_CONFLICT,
    });
  });

  it('adds service and merges quantity for same refId', async () => {
    const existingLine = {
      _id: { toString: () => '64f0c2a1b4e1c2d3e4f50701' },
      itemType: CartItemType.SERVICE,
      refId: { toString: () => '64f0c2a1b4e1c2d3e4f50710' },
      quantity: 1,
      forMemberId: null,
      forMemberSnapshot: null,
      snapshot: {
        name: 'Facial',
        unitPrice: 500,
        mrp: 600,
        homeVisitFee: 0,
        extraCharge: 0,
        badges: [],
      },
      selectedServices: [],
      packageMeta: null,
      deleteOne: jest.fn(),
    };
    const cartDoc = makeCartDoc({ items: [existingLine] });

    const cartRepository = {
      findDocumentByUserId: jest.fn().mockResolvedValue(cartDoc),
      saveDocument: jest.fn().mockImplementation(async (d) => d),
    };
    const serviceRepository = {
      findActiveById: jest.fn(),
    };

    const service = new CartService(
      cartRepository,
      serviceRepository,
      {},
      {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
      },
      {
        walletProvider: { getBalance: async () => 0 },
        couponProvider: { resolveCoupon: async () => null },
        creditsProvider: { getBalance: async () => 0 },
        cashbackProvider: { getBalance: async () => 0 },
      },
    );

    const dto = await service.addItem('507f1f77bcf86cd799439011', {
      itemType: CartItemType.SERVICE,
      refId: '64f0c2a1b4e1c2d3e4f50710',
      quantity: 2,
    });

    expect(existingLine.quantity).toBe(3);
    expect(serviceRepository.findActiveById).not.toHaveBeenCalled();
    expect(dto.pricing.subtotal).toBe(1500);
  });

  it('creates new service line when not already in cart', async () => {
    const cartDoc = makeCartDoc({ items: [] });
    cartDoc.items.push = Array.prototype.push.bind(cartDoc.items);

    const cartRepository = {
      findDocumentByUserId: jest.fn().mockResolvedValue(cartDoc),
      saveDocument: jest.fn().mockImplementation(async (d) => d),
    };
    const serviceRepository = {
      findActiveById: jest.fn().mockResolvedValue({
        _id: '64f0c2a1b4e1c2d3e4f50710',
        name: 'Classic facial',
        status: ServiceStatus.APPROVED,
        isActive: true,
        price: 999,
        discountedPrice: 899,
        badges: ['trending'],
        thumbnail: { url: 'https://cdn.example.com/a.jpg' },
        durationMinMinutes: 60,
        durationMaxMinutes: 90,
        homeVisitFee: 100,
        ratingAvg: 4.8,
      }),
    };

    const service = new CartService(
      cartRepository,
      serviceRepository,
      {},
      {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
      },
      {
        walletProvider: { getBalance: async () => 0 },
        couponProvider: { resolveCoupon: async () => null },
        creditsProvider: { getBalance: async () => 0 },
        cashbackProvider: { getBalance: async () => 0 },
      },
    );

    const dto = await service.addItem('507f1f77bcf86cd799439011', {
      itemType: CartItemType.SERVICE,
      refId: '64f0c2a1b4e1c2d3e4f50710',
      quantity: 1,
    });

    expect(cartDoc.items).toHaveLength(1);
    expect(dto.items[0].snapshot.unitPrice).toBe(899);
    expect(dto.pricing.visitFee).toBe(100);
    expect(dto.pricing.grandTotal).toBe(999);
  });

  it('throws AppError on missing line', async () => {
    const cartDoc = makeCartDoc({ items: [] });
    const cartRepository = {
      findDocumentByUserId: jest.fn().mockResolvedValue(cartDoc),
    };
    const service = new CartService(cartRepository, {}, {}, null, {
      walletProvider: { getBalance: async () => 0 },
      couponProvider: { resolveCoupon: async () => null },
      creditsProvider: { getBalance: async () => 0 },
      cashbackProvider: { getBalance: async () => 0 },
    });

    await expect(
      service.removeItem('507f1f77bcf86cd799439011', '64f0c2a1b4e1c2d3e4f50701'),
    ).rejects.toBeInstanceOf(AppError);
  });
});
