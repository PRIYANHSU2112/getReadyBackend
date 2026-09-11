import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { BookingService } from '../../services/booking-service/src/services/booking.service.js';
import { PricingEngine } from '../../services/booking-service/src/services/pricing.engine.js';
import { BeauticianAssignmentEngine } from '../../services/booking-service/src/services/assignment.engine.js';
import { CancellationEngine } from '../../services/booking-service/src/services/cancellation.engine.js';
import { BOOKING_STATUS, ITEM_STATUS } from '../../services/booking-service/src/models/booking.models.js';

describe('Booking Service — Complete Multi-Customer & Multi-Beautician Business Logic Test Suite', () => {
  let mockBookingRepo;
  let mockSlotRepo;
  let mockOutboxRepo;
  let mockSlotInventory;
  let mockEventPublisher;
  let bookingService;

  const defaultSettings = {
    multipleBeauticianEnabled: true,
    maxBeauticiansPerBooking: 2,
    maxCustomersPerBeautician: 4,
    maxServicesPerBeautician: 8,
    maxServiceDurationPerBeautician: 240,
    serviceUpgradeEnabled: true,
    minUpgradeDifference: 100,
    maxUpgradeDifference: 200,
    hygieneKitMandatory: true,
    hygieneKitPrice: 49,
    hygieneKitDefaultQuantity: 1,
    hygieneKitTitle: 'GetReady Certified Hygiene & Safety Kit',
    hygieneKitDescription: 'Sterilized disposables, sanitization kit, and single-use towels',
    hygieneKitIncludedItems: ['Disposable Bed Sheet', 'Face Mask', 'Sanitization Wipes', 'Gloves'],
    instantServiceEnabled: true,
    instantServiceMembersOnly: true,
    instantServiceMaxLeadTimeMinutes: 30,
    cancellationPolicy: {
      freeBeforeHours: 6,
      tier1Hours: 2,
      tier1Fee: 100,
      tier2Fee: 200,
      waiveIfDelayed: true,
      waiveIfUnassigned: true,
      policySummary: 'Free cancellation up to 6 hours before slot.',
    },
    couponEnabled: true,
    cashbackEnabled: true,
    cashbackPercentage: 10,
    pointsEnabled: true,
    pointsPercentage: 10,
  };

  beforeEach(() => {
    mockBookingRepo = {
      create: jest.fn().mockImplementation((data) => {
        const id = new mongoose.Types.ObjectId();
        const doc = {
          _id: id,
          ...data,
          save: jest.fn().mockImplementation(async function () {
            return this;
          }),
        };
        return Promise.resolve(doc);
      }),
      findById: jest.fn(),
      findByIdempotencyKey: jest.fn().mockResolvedValue(null),
      findUserBookings: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findAndCount: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findBeauticianAssignments: jest.fn(),
      updateAssignments: jest.fn(),
      updateItemStatus: jest.fn(),
    };

    mockSlotRepo = {
      atomicReserveSeat: jest.fn().mockResolvedValue({ _id: 'slot-123', isAvailable: true }),
      atomicReleaseSeat: jest.fn().mockResolvedValue({ _id: 'slot-123', isAvailable: true }),
    };

    mockOutboxRepo = {
      create: jest.fn().mockImplementation((data) => Promise.resolve({ _id: 'outbox-123', ...data })),
    };

    mockSlotInventory = {
      reserve: jest.fn().mockResolvedValue({ ok: true, holdToken: 'hold-token-xyz' }),
      release: jest.fn().mockResolvedValue({ ok: true }),
    };

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(true),
    };

    bookingService = new BookingService(
      mockBookingRepo,
      mockSlotRepo,
      mockOutboxRepo,
      mockSlotInventory,
      mockEventPublisher,
    );
  });

  // =========================================================================
  // 1. MULTI-CUSTOMER IN ONE BOOKING
  // =========================================================================
  describe('1. Multi-Customer in One Booking', () => {
    it('should create ONE booking, ONE invoice, ONE payable amount for 3 customer profiles (Self, Mother, Sister)', async () => {
      const accountOwnerId = 'usr_naveen_101';
      const participants = [
        { customerProfileId: 'prof_self', name: 'Naveen', relationship: 'Self', gender: 'MALE' },
        { customerProfileId: 'prof_mother', name: 'Sarita', relationship: 'Mother', gender: 'FEMALE' },
        { customerProfileId: 'prof_sister', name: 'Priya', relationship: 'Sister', gender: 'FEMALE' },
      ];

      const items = [
        { customerProfileId: 'prof_self', serviceId: 'svc_hair_spa', serviceName: 'Hair Spa', basePrice: 1249, quantity: 1, durationMinutes: 45 },
        { customerProfileId: 'prof_mother', serviceId: 'svc_facial', serviceName: 'Facial', basePrice: 799, quantity: 1, durationMinutes: 60 },
        { customerProfileId: 'prof_mother', serviceId: 'svc_cleanup', serviceName: 'Cleanup', basePrice: 499, quantity: 1, durationMinutes: 30 },
        { customerProfileId: 'prof_sister', serviceId: 'svc_waxing', serviceName: 'Waxing', basePrice: 599, quantity: 1, durationMinutes: 30 },
      ];

      const booking = await bookingService.createBooking(accountOwnerId, {
        participants,
        items,
        addressId: 'addr_101',
        addressSnapshot: { line1: 'Sector 62', city: 'Noida', pincode: '201301' },
        hygieneKitQuantity: 1,
        preferredBeauticianCount: 2,
        availableBeauticians: [
          { id: 'b_01', name: 'Pooja Verma' },
          { id: 'b_02', name: 'Anjali Sharma' },
        ],
      });

      // Assert ONE Booking
      expect(booking.accountOwnerId).toBe(accountOwnerId);
      expect(booking.bookingNumber).toMatch(/^GR/);
      expect(booking.participants.length).toBe(3);
      expect(booking.items.length).toBe(4);

      // Verify each item preserves correct customer profile mapping
      const selfItem = booking.items.find((i) => i.serviceId === 'svc_hair_spa');
      expect(selfItem.customerProfileId).toBe('prof_self');
      expect(selfItem.participantName).toBe('Naveen');

      const motherItems = booking.items.filter((i) => i.customerProfileId === 'prof_mother');
      expect(motherItems.length).toBe(2);
      expect(motherItems.map((i) => i.serviceName)).toEqual(['Facial', 'Cleanup']);

      const sisterItem = booking.items.find((i) => i.serviceId === 'svc_waxing');
      expect(sisterItem.customerProfileId).toBe('prof_sister');

      // Verify ONE pricing snapshot (1249 + 799 + 499 + 599 + 49 hygiene kit = 3195)
      expect(booking.pricing.servicesSubtotal).toBe(3146);
      expect(booking.pricing.hygieneKitTotal).toBe(49);
      expect(booking.pricing.subtotal).toBe(3195);
      expect(booking.pricing.payableAmount).toBe(3195);

      // Verify Transactional Outbox created for the single booking
      expect(mockOutboxRepo.create).toHaveBeenCalledTimes(1);
      expect(mockOutboxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregateType: 'Booking',
          eventType: 'BookingCreated',
          payload: expect.objectContaining({
            accountOwnerId: 'usr_naveen_101',
            payableAmount: 3195,
            participantCount: 3,
            itemCount: 4,
          }),
        }),
        null,
      );
    });
  });

  // =========================================================================
  // 2. HYGIENE KIT MANDATORY RULES
  // =========================================================================
  describe('2. Mandatory Hygiene Kit Rules', () => {
    it('should automatically add exactly ONE hygiene kit (₹49) once per booking, not per service or per customer', async () => {
      const items = [
        { customerProfileId: 'p1', serviceName: 'Service 1', basePrice: 500 },
        { customerProfileId: 'p1', serviceName: 'Service 2', basePrice: 500 },
        { customerProfileId: 'p2', serviceName: 'Service 3', basePrice: 500 },
        { customerProfileId: 'p3', serviceName: 'Service 4', basePrice: 500 },
      ];

      const calculation = await PricingEngine.calculate({
        items,
        hygieneKitQuantity: 1,
        settingsOverride: defaultSettings,
      });

      expect(calculation.hygieneKit.mandatory).toBe(true);
      expect(calculation.hygieneKit.quantity).toBe(1);
      expect(calculation.hygieneKit.unitPrice).toBe(49);
      expect(calculation.hygieneKit.total).toBe(49);
      expect(calculation.pricing.hygieneKitTotal).toBe(49);
    });

    it('should allow customer to increase hygiene kit quantity to 2 or more, but never drop below 1', async () => {
      // Increased to 3
      const calcQty3 = await PricingEngine.calculate({
        items: [{ serviceName: 'Facial', basePrice: 800 }],
        hygieneKitQuantity: 3,
        settingsOverride: defaultSettings,
      });
      expect(calcQty3.hygieneKit.quantity).toBe(3);
      expect(calcQty3.hygieneKit.total).toBe(147);

      // Attempted 0 or negative -> Must enforce minimum 1
      const calcQty0 = await PricingEngine.calculate({
        items: [{ serviceName: 'Facial', basePrice: 800 }],
        hygieneKitQuantity: 0,
        settingsOverride: defaultSettings,
      });
      expect(calcQty0.hygieneKit.quantity).toBe(1);
      expect(calcQty0.hygieneKit.total).toBe(49);
    });
  });

  // =========================================================================
  // 3. SERVICE UPGRADE ENGINE
  // =========================================================================
  describe('3. Service Upgrade Engine', () => {
    const catalogServices = [
      { id: 'svc_hair_spa_premium', name: 'Premium Hair Spa', categoryId: 'cat_hair', price: 1399 },
      { id: 'svc_hair_spa_cheap', name: 'Basic Hair Spa', categoryId: 'cat_hair', price: 1300 }, // diff = 51 (< 100)
      { id: 'svc_hair_spa_ultra', name: 'Ultra Luxury Hair Spa', categoryId: 'cat_hair', price: 1500 }, // diff = 251 (> 200)
      { id: 'svc_gold_facial', name: 'Gold Facial', categoryId: 'cat_facial', price: 1399 }, // different category
    ];

    it('should recommend upgrade when price difference is between ₹100 and ₹200 within same category', () => {
      const selected = { id: 'svc_hair_spa', name: 'Hair Spa', categoryId: 'cat_hair', price: 1249 };
      const upgrade = PricingEngine.findEligibleUpgrade(selected, catalogServices, defaultSettings);

      expect(upgrade).not.toBeNull();
      expect(upgrade.upgradeServiceName).toBe('Premium Hair Spa');
      expect(upgrade.basePrice).toBe(1249);
      expect(upgrade.upgradePrice).toBe(1399);
      expect(upgrade.priceDifference).toBe(150);
      expect(upgrade.recommended).toBe(true);
    });

    it('should NOT recommend upgrade if difference is below ₹100 or above ₹200', () => {
      // Only has diff of ₹51
      const selectedLow = { id: 'svc_hair_spa', name: 'Hair Spa', categoryId: 'cat_hair', price: 1249 };
      const candidatesLowOnly = [{ id: 'svc_hair_spa_cheap', name: 'Basic Hair Spa', categoryId: 'cat_hair', price: 1300 }];
      const upgradeLow = PricingEngine.findEligibleUpgrade(selectedLow, candidatesLowOnly, defaultSettings);
      expect(upgradeLow).toBeNull();

      // Only has diff of ₹251
      const candidatesHighOnly = [{ id: 'svc_hair_spa_ultra', name: 'Ultra Luxury Hair Spa', categoryId: 'cat_hair', price: 1500 }];
      const upgradeHigh = PricingEngine.findEligibleUpgrade(selectedLow, candidatesHighOnly, defaultSettings);
      expect(upgradeHigh).toBeNull();
    });

    it('should NOT recommend upgrade from a different category', () => {
      const selectedHair = { id: 'svc_hair_spa', name: 'Hair Spa', categoryId: 'cat_hair', price: 1249 };
      const candidatesFacialOnly = [{ id: 'svc_gold_facial', name: 'Gold Facial', categoryId: 'cat_facial', price: 1399 }];
      const upgradeDiffCat = PricingEngine.findEligibleUpgrade(selectedHair, candidatesFacialOnly, defaultSettings);
      expect(upgradeDiffCat).toBeNull();
    });

    it('should accurately calculate total when customer explicitly selects the upgrade', async () => {
      const items = [
        {
          customerProfileId: 'p1',
          serviceId: 'svc_hair_spa',
          serviceName: 'Hair Spa',
          basePrice: 1249,
          upgradeSelected: true,
          upgradeServiceId: 'svc_hair_spa_premium',
          upgradeServiceName: 'Premium Hair Spa',
          upgradePriceDifference: 150,
          quantity: 1,
        },
      ];

      const calculation = await PricingEngine.calculate({
        items,
        hygieneKitQuantity: 1,
        settingsOverride: defaultSettings,
      });

      expect(calculation.pricing.servicesSubtotal).toBe(1249);
      expect(calculation.pricing.upgradesTotal).toBe(150);
      expect(calculation.pricing.itemsSubtotal).toBe(1399);
      expect(calculation.pricing.subtotal).toBe(1399 + 49); // 1448
    });
  });

  // =========================================================================
  // 4. MEMBERSHIP & SCHEDULING (INSTANT VS SCHEDULED)
  // =========================================================================
  describe('4. Membership & Scheduling (Instant vs Scheduled)', () => {
    it('should reject Instant service booking for Non-Members', async () => {
      await expect(
        bookingService.createBooking('user_non_member', {
          schedulingMode: 'INSTANT',
          userHasMembership: false,
          membershipOptIn: false,
          participants: [{ customerProfileId: 'p1', name: 'User' }],
          items: [{ serviceName: 'Haircut', basePrice: 500 }],
          addressId: 'addr_1',
          addressSnapshot: { line1: 'Test' },
        }),
      ).rejects.toThrow('Instant service is available exclusively for Members');
    });

    it('should allow Instant service booking for Members', async () => {
      const booking = await bookingService.createBooking('user_member', {
        schedulingMode: 'INSTANT',
        userHasMembership: true,
        participants: [{ customerProfileId: 'p1', name: 'VIP User' }],
        items: [{ serviceName: 'Haircut', basePrice: 500 }],
        addressId: 'addr_1',
        addressSnapshot: { line1: 'Test' },
      });

      expect(booking.schedulingMode).toBe('INSTANT');
      expect(booking.status).toBe(BOOKING_STATUS.CONFIRMED);
    });
  });

  // =========================================================================
  // 5. MULTI-BEAUTICIAN ASSIGNMENT & VIEW ISOLATION
  // =========================================================================
  describe('5. Multi-Beautician Assignment & View Isolation', () => {
    it('should distribute customer profile items across 2 beauticians when preferred count is 2', async () => {
      const participants = [
        { customerProfileId: 'prof_self', name: 'Naveen' },
        { customerProfileId: 'prof_mother', name: 'Mother' },
        { customerProfileId: 'prof_sister', name: 'Sister' },
      ];

      const items = [
        { customerProfileId: 'prof_self', serviceName: 'Hair Spa', basePrice: 1249 },
        { customerProfileId: 'prof_mother', serviceName: 'Facial', basePrice: 799 },
        { customerProfileId: 'prof_mother', serviceName: 'Cleanup', basePrice: 499 },
        { customerProfileId: 'prof_sister', serviceName: 'Waxing', basePrice: 599 },
      ];

      const availableBeauticians = [
        { id: 'b_pooja', name: 'Pooja Verma' },
        { id: 'b_anjali', name: 'Anjali Sharma' },
      ];

      const assignment = await BeauticianAssignmentEngine.assign({
        participants,
        items,
        preferredBeauticianCount: 2,
        availableBeauticians,
        settingsOverride: defaultSettings,
      });

      expect(assignment.assignedBeauticianCount).toBe(2);
      expect(assignment.assignments.length).toBe(2);

      // Verify that all 4 items are assigned to one of the two beauticians
      const b1Items = assignment.items.filter((i) => i.assignedBeauticianId === 'b_pooja');
      const b2Items = assignment.items.filter((i) => i.assignedBeauticianId === 'b_anjali');

      expect(b1Items.length + b2Items.length).toBe(4);
      expect(b1Items.length).toBeGreaterThan(0);
      expect(b2Items.length).toBeGreaterThan(0);
    });

    it('should isolate beautician view so Beautician A only sees services assigned to them', async () => {
      const fullBooking = {
        _id: 'bk_1001',
        bookingNumber: 'GR10001',
        participants: [
          { _id: new mongoose.Types.ObjectId('65fc8e129182a1048b111001'), customerProfileId: 'p_mother', name: 'Mother' },
          { _id: new mongoose.Types.ObjectId('65fc8e129182a1048b111002'), customerProfileId: 'p_self', name: 'Self' },
        ],
        items: [
          {
            _id: 'item_1',
            participantId: '65fc8e129182a1048b111001',
            serviceName: 'Facial',
            assignedBeauticianId: 'b_pooja',
            durationMinutes: 60,
          },
          {
            _id: 'item_2',
            participantId: '65fc8e129182a1048b111002',
            serviceName: 'Hair Spa',
            assignedBeauticianId: 'b_anjali',
            durationMinutes: 45,
          },
        ],
      };

      mockBookingRepo.findBeauticianAssignments.mockResolvedValue({
        items: [fullBooking],
        total: 1,
      });

      // Query as Pooja
      const poojaResult = await bookingService.getBeauticianAssignments('b_pooja');
      expect(poojaResult.items[0].items.length).toBe(1);
      expect(poojaResult.items[0].items[0].serviceName).toBe('Facial');
      expect(poojaResult.items[0].myTotalDuration).toBe(60);
      // Ensure Anjali's Hair Spa was stripped out of Pooja's view
      expect(poojaResult.items[0].items.some((i) => i.serviceName === 'Hair Spa')).toBe(false);
    });
  });

  // =========================================================================
  // 6. UNIFIED OTP & SERVICE ITEM COMPLETION LIFECYCLE
  // =========================================================================
  describe('6. Unified OTP & Service Item Lifecycle', () => {
    it('should transition booking to STARTED upon valid single Start OTP verification', async () => {
      const mockBooking = {
        _id: 'bk_123',
        bookingNumber: 'GR123',
        startOtp: '4589',
        status: BOOKING_STATUS.CONFIRMED,
        items: [
          { _id: 'i1', status: ITEM_STATUS.PENDING },
          { _id: 'i2', status: ITEM_STATUS.ASSIGNED },
        ],
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      mockBookingRepo.findById.mockResolvedValue(mockBooking);

      const res = await bookingService.verifyStartOtp('bk_123', '4589');
      expect(res.status).toBe(BOOKING_STATUS.STARTED);
      expect(res.startOtpVerified).toBe(true);
      expect(res.items[0].status).toBe(ITEM_STATUS.STARTED);
      expect(res.items[1].status).toBe(ITEM_STATUS.STARTED);
    });

    it('should reject End OTP when any service item is still incomplete', async () => {
      const mockBooking = {
        _id: 'bk_123',
        bookingNumber: 'GR123',
        endOtp: '7821',
        status: BOOKING_STATUS.STARTED,
        items: [
          { _id: 'i1', serviceName: 'Facial', status: ITEM_STATUS.COMPLETED },
          { _id: 'i2', serviceName: 'Hair Spa', status: ITEM_STATUS.STARTED }, // Incomplete!
        ],
        save: jest.fn().mockResolvedValue(true),
      };
      mockBookingRepo.findById.mockResolvedValue(mockBooking);

      await expect(bookingService.verifyEndOtp('bk_123', '7821')).rejects.toThrow(
        'Cannot verify End OTP. 1 service item(s) are still in progress.',
      );
    });

    it('should complete booking and create outbox record only when ALL items are completed and End OTP verified', async () => {
      const mockBooking = {
        _id: 'bk_123',
        bookingNumber: 'GR123',
        accountOwnerId: 'usr_naveen',
        endOtp: '7821',
        status: BOOKING_STATUS.SERVICES_COMPLETED,
        pricing: { payableAmount: 2895, cashbackEarned: 289, pointsEarned: 289 },
        items: [
          { _id: 'i1', serviceName: 'Facial', status: ITEM_STATUS.COMPLETED },
          { _id: 'i2', serviceName: 'Hair Spa', status: ITEM_STATUS.COMPLETED },
        ],
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      mockBookingRepo.findById.mockResolvedValue(mockBooking);

      const completed = await bookingService.verifyEndOtp('bk_123', '7821');
      expect(completed.status).toBe(BOOKING_STATUS.COMPLETED);
      expect(completed.endOtpVerified).toBe(true);

      // Verify Transactional Outbox record for Cashback & Points Realization
      expect(mockOutboxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregateType: 'Booking',
          eventType: 'BookingCompleted',
          payload: expect.objectContaining({
            accountOwnerId: 'usr_naveen',
            cashbackEarned: 289,
            pointsEarned: 289,
          }),
        }),
        null,
      );
    });
  });

  // =========================================================================
  // 7. CANCELLATION ENGINE & WAIVERS
  // =========================================================================
  describe('7. Cancellation Engine & Waivers', () => {
    it('should charge ₹0 fee when cancelled > 6 hours before scheduled start', async () => {
      const scheduledFuture = new Date(Date.now() + 8 * 3600 * 1000); // 8 hours away
      const booking = {
        scheduledStartTime: scheduledFuture,
        beauticianAssignments: [{ beauticianId: 'b_1' }],
        status: 'CONFIRMED',
      };

      const result = await CancellationEngine.calculateFee(booking, { settingsOverride: defaultSettings });
      expect(result.fee).toBe(0);
      expect(result.feeWaived).toBe(false);
    });

    it('should charge ₹100 fee when cancelled between 2 and 6 hours before scheduled start', async () => {
      const scheduled3Hours = new Date(Date.now() + 3.5 * 3600 * 1000);
      const booking = {
        scheduledStartTime: scheduled3Hours,
        beauticianAssignments: [{ beauticianId: 'b_1' }],
        status: 'CONFIRMED',
      };

      const result = await CancellationEngine.calculateFee(booking, { settingsOverride: defaultSettings });
      expect(result.fee).toBe(100);
    });

    it('should charge ₹200 fee when cancelled within 2 hours of scheduled start', async () => {
      const scheduled1Hour = new Date(Date.now() + 1 * 3600 * 1000);
      const booking = {
        scheduledStartTime: scheduled1Hour,
        beauticianAssignments: [{ beauticianId: 'b_1' }],
        status: 'CONFIRMED',
      };

      const result = await CancellationEngine.calculateFee(booking, { settingsOverride: defaultSettings });
      expect(result.fee).toBe(200);
    });

    it('should waive cancellation fee to ₹0 if professional is delayed or unassigned, even within 2 hours', async () => {
      const scheduled1Hour = new Date(Date.now() + 1 * 3600 * 1000);
      const delayedBooking = {
        scheduledStartTime: scheduled1Hour,
        beauticianAssignments: [{ beauticianId: 'b_1' }],
        status: 'CONFIRMED',
      };

      // Delayed scenario
      const delayResult = await CancellationEngine.calculateFee(delayedBooking, {
        isDelayed: true,
        settingsOverride: defaultSettings,
      });
      expect(delayResult.fee).toBe(0);
      expect(delayResult.feeWaived).toBe(true);

      // Unassigned scenario
      const unassignedBooking = {
        scheduledStartTime: scheduled1Hour,
        beauticianAssignments: [],
        status: 'ASSIGNMENT_PENDING',
      };
      const unassignedResult = await CancellationEngine.calculateFee(unassignedBooking, {
        settingsOverride: defaultSettings,
      });
      expect(unassignedResult.fee).toBe(0);
      expect(unassignedResult.feeWaived).toBe(true);
    });
  });

  // =========================================================================
  // 8. FINAL ACCEPTANCE TEST SCENARIO (Section 56)
  // =========================================================================
  describe('8. Section 56 Final Acceptance Test Scenario', () => {
    it('should execute the full end-to-end multi-customer, multi-beautician lifecycle flawlessly', async () => {
      // 1. Account Owner: Naveen
      const accountOwnerId = 'usr_naveen_acceptance';

      // 2. Customer Profiles: Self, Mother, Sister
      const participants = [
        { customerProfileId: 'p_naveen', name: 'Naveen', relationship: 'Self' },
        { customerProfileId: 'p_sarita', name: 'Sarita', relationship: 'Mother' },
        { customerProfileId: 'p_priya', name: 'Priya', relationship: 'Sister' },
      ];

      // 3. Services with Hair Spa upgrade from ₹1249 to ₹1399 (+₹150)
      const items = [
        {
          customerProfileId: 'p_naveen',
          serviceId: 'svc_hair_spa',
          serviceName: 'Hair Spa',
          basePrice: 1249,
          upgradeSelected: true,
          upgradeServiceId: 'svc_hair_spa_prem',
          upgradeServiceName: 'Premium Hair Spa',
          upgradePriceDifference: 150,
        },
        { customerProfileId: 'p_sarita', serviceId: 'svc_facial', serviceName: 'Facial', basePrice: 799 },
        { customerProfileId: 'p_sarita', serviceId: 'svc_cleanup', serviceName: 'Cleanup', basePrice: 499 },
        { customerProfileId: 'p_priya', serviceId: 'svc_waxing', serviceName: 'Waxing', basePrice: 599 },
      ];

      // 4. Preview Booking API
      const preview = await bookingService.previewBooking(accountOwnerId, {
        participants,
        items,
        hygieneKitQuantity: 1,
        couponCode: 'FLAT300',
        preferredBeauticianCount: 2,
      });

      // Preview Assertions
      // Subtotal = (1249 + 150) + 799 + 499 + 599 + 49 (Kit) = 3345
      // Coupon = -300
      // Payable = 3045
      expect(preview.pricing.subtotal).toBe(3345);
      expect(preview.pricing.couponDiscount).toBe(300);
      expect(preview.pricing.payableAmount).toBe(3045);
      expect(preview.hygieneKit.quantity).toBe(1);
      expect(preview.hygieneKit.total).toBe(49);
      expect(preview.rewards.cashback).toBe(305); // 10% of 3045 rounded
      expect(preview.rewards.points).toBe(305);

      // 5. Confirm Booking Creation
      const createdBooking = await bookingService.createBooking(accountOwnerId, {
        participants,
        items,
        addressId: 'addr_home',
        addressSnapshot: { line1: 'Flat 402, Lotus Blvd', city: 'Noida' },
        hygieneKitQuantity: 1,
        couponCode: 'FLAT300',
        preferredBeauticianCount: 2,
        availableBeauticians: [
          { id: 'b_pooja', name: 'Pooja Verma' },
          { id: 'b_anjali', name: 'Anjali Sharma' },
        ],
      });

      expect(createdBooking.status).toBe(BOOKING_STATUS.CONFIRMED);
      expect(createdBooking.assignedBeauticianCount).toBe(2);
      expect(createdBooking.startOtp).toBeDefined();
      expect(createdBooking.endOtp).toBeDefined();

      // 6. Start OTP Verification
      mockBookingRepo.findById.mockResolvedValue(createdBooking);
      const started = await bookingService.verifyStartOtp(createdBooking._id, createdBooking.startOtp);
      expect(started.status).toBe(BOOKING_STATUS.STARTED);

      // 7. Complete Individual Service Items
      for (const item of createdBooking.items) {
        await bookingService.completeServiceItem(createdBooking._id, item._id, item.assignedBeauticianId);
      }

      // 8. End OTP Verification
      const completed = await bookingService.verifyEndOtp(createdBooking._id, createdBooking.endOtp);
      expect(completed.status).toBe(BOOKING_STATUS.COMPLETED);
      expect(completed.endOtpVerified).toBe(true);

      // 9. Verify Final Cashback and Points Crediting Outbox Domain Event
      expect(mockOutboxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'BookingCompleted',
          payload: expect.objectContaining({
            accountOwnerId: 'usr_naveen_acceptance',
            cashbackEarned: 305,
            pointsEarned: 305,
          }),
        }),
        null,
      );
    });
  });
});
