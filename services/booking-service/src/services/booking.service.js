import mongoose from 'mongoose';
import crypto from 'crypto';
import { AppError, HttpStatus, ErrorCodes } from '@getready/errors';
import { EVENT_TYPES } from '@getready/rabbitmq';
import { getTraceContext } from '@getready/tracing';
import { PricingEngine } from './pricing.engine.js';
import { BeauticianAssignmentEngine } from './assignment.engine.js';
import { CancellationEngine } from './cancellation.engine.js';
import { getOrCreateBookingSettings } from '../models/booking-settings.model.js';
import { BOOKING_STATUS, ITEM_STATUS } from '../models/booking.models.js';

function generate4DigitOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export class BookingService {
  /**
   * @param {import('../repositories/booking.repositories.js').BookingRepository} bookingRepo
   * @param {import('../repositories/booking.repositories.js').SlotRepository} slotRepo
   * @param {import('../repositories/booking.repositories.js').BookingOutboxRepository} outboxRepo
   * @param {import('../inventory/slot.inventory.js').SlotInventory} slotInventory
   * @param {import('@getready/rabbitmq').EventPublisher|null} eventPublisher
   */
  constructor(bookingRepo, slotRepo, outboxRepo, slotInventory, eventPublisher = null) {
    this.bookingRepo = bookingRepo;
    this.slotRepo = slotRepo;
    this.outboxRepo = outboxRepo;
    this.slotInventory = slotInventory;
    this.eventPublisher = eventPublisher;
  }

  async #runInSession(fn) {
    let session = null;
    try {
      if (mongoose.connection.readyState === 1) {
        session = await mongoose.startSession();
        session.startTransaction();
        const result = await fn(session);
        await session.commitTransaction();
        return result;
      }
      return fn(null);
    } catch (err) {
      if (session && session.inTransaction()) {
        await session.abortTransaction();
      }
      if (
        err.message &&
        (err.message.includes('replica set') || err.message.includes('standalone'))
      ) {
        return fn(null);
      }
      throw err;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  /**
   * Pre-booking calculation and review preview API
   */
  async previewBooking(accountOwnerId, data) {
    const settings = await getOrCreateBookingSettings();

    const {
      items = [],
      participants = [],
      hygieneKitQuantity = 1,
      membershipOptIn = false,
      userHasMembership = false,
      couponCode = null,
      useWallet = false,
      walletBalance = 0,
      usePoints = false,
      pointsBalance = 0,
      useCashback = false,
      cashbackBalance = 0,
      schedulingMode = 'SCHEDULED',
      preferredBeauticianCount = 1,
    } = data;

    // 1. Authoritative Pricing Calculation
    const pricingResult = await PricingEngine.calculate({
      items,
      hygieneKitQuantity,
      membershipOptIn,
      userHasMembership,
      couponCode,
      useWallet,
      walletBalance,
      usePoints,
      pointsBalance,
      useCashback,
      cashbackBalance,
      settingsOverride: settings,
    });

    // 2. Instant Service Evaluation (Members-Only Gate)
    const isMember = Boolean(userHasMembership || membershipOptIn);
    const instantAvailable = Boolean(settings.instantServiceEnabled && isMember);
    const instantMessage = isMember
      ? 'Instant Service available (within 30 minutes).'
      : settings.instantServiceNoticeMessage || 'Instant Service – Members Only.';

    // 3. Multi-Beautician Preference
    const maxBeauticians = Number(settings.maxBeauticiansPerBooking || 2);
    const selectedBeauticians = Math.min(maxBeauticians, Math.max(1, Number(preferredBeauticianCount || 1)));

    return {
      bookingSummary: {
        accountOwnerId,
        participantCount: Math.max(1, participants.length),
        itemCount: items.length,
      },
      participants,
      items: pricingResult.items,
      hygieneKit: pricingResult.hygieneKit,
      membership: {
        eligible: true,
        planName: 'GetReady Glow Club',
        offerPrice: 499,
        originalPrice: 999,
        savings: 500,
        isMember,
        benefits: [
          'Instant 30-min Service Booking',
          '10% Flat Discount on all Services',
          'Zero Cancellation Fees',
          '2x Cashback Points',
        ],
      },
      scheduling: {
        instant: {
          available: instantAvailable,
          membersOnly: true,
          message: instantMessage,
          leadTimeMinutes: settings.instantServiceMaxLeadTimeMinutes || 30,
        },
        scheduled: {
          available: true,
        },
      },
      beauticianPreference: {
        available: settings.multipleBeauticianEnabled,
        selected: selectedBeauticians,
        maximum: maxBeauticians,
        message:
          selectedBeauticians > 1
            ? '2 Beauticians (Faster Service) – Subject to Availability.'
            : '1 Beautician Assigned.',
      },
      coupon: {
        available: Boolean(settings.couponEnabled),
        applied: pricingResult.appliedCoupon,
      },
      rewards: pricingResult.rewards,
      cancellationPolicy: {
        summary: settings.cancellationPolicy?.policySummary,
        freeBeforeHours: settings.cancellationPolicy?.freeBeforeHours || 6,
      },
      pricing: pricingResult.pricing,
    };
  }

  /**
   * Authoritative Final Booking Creation
   */
  async createBooking(accountOwnerId, data) {
    const {
      idempotencyKey = null,
      schedulingMode = 'SCHEDULED',
      slotId = null,
      scheduledDate,
      scheduledStartTime = null,
      scheduledEndTime = null,
      holdToken = null,
      participants = [],
      items = [],
      addressId,
      addressSnapshot,
      hygieneKitQuantity = 1,
      membershipOptIn = false,
      userHasMembership = false,
      couponCode = null,
      useWallet = false,
      walletBalance = 0,
      usePoints = false,
      pointsBalance = 0,
      useCashback = false,
      cashbackBalance = 0,
      paymentMethod = 'online',
      preferredBeauticianCount = 1,
      specialInstructions = null,
      availableBeauticians = [],
    } = data;

    // 1. Idempotency Check
    if (idempotencyKey) {
      const existing = await this.bookingRepo.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    // 2. Server-side validation of Customer Profiles & Items
    if (!participants || participants.length === 0) {
      throw new AppError('At least one customer profile participant is required', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
    if (!items || items.length === 0) {
      throw new AppError('At least one service item is required', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
    if (!addressId || !addressSnapshot) {
      throw new AppError('Address is required for home visit service', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }

    const settings = await getOrCreateBookingSettings();

    // Instant Service validation: Members only
    const isMember = Boolean(userHasMembership || membershipOptIn);
    if (schedulingMode === 'INSTANT' && settings.instantServiceMembersOnly && !isMember) {
      throw new AppError('Instant service is available exclusively for Members', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
    }

    // Release soft-hold if token provided
    if (holdToken && slotId) {
      await this.slotInventory.release({ holdToken, userId: accountOwnerId, slotId, partySize: participants.length });
    }

    // 3. Authoritative Pricing Recalculation (Server-Side Source of Truth)
    const pricingResult = await PricingEngine.calculate({
      items,
      hygieneKitQuantity,
      membershipOptIn,
      userHasMembership,
      couponCode,
      useWallet,
      walletBalance,
      usePoints,
      pointsBalance,
      useCashback,
      cashbackBalance,
      settingsOverride: settings,
    });

    // 4. Map and validate participant IDs for items
    const participantMap = new Map();
    const formattedParticipants = participants.map((p) => {
      const pId = new mongoose.Types.ObjectId();
      const profileId = p.customerProfileId || p.id || p._id?.toString() || pId.toString();
      const participantObj = {
        _id: pId,
        customerProfileId: profileId,
        name: p.name || 'Self',
        relationship: p.relationship || 'Self',
        gender: p.gender || 'FEMALE',
        age: p.age || null,
        mobileNumber: p.mobileNumber || null,
        skinType: p.skinType || null,
        hairType: p.hairType || null,
        allergies: p.allergies || [],
        notes: p.notes || null,
      };
      participantMap.set(profileId, participantObj);
      return participantObj;
    });

    const defaultParticipant = formattedParticipants[0];

    const formattedItems = pricingResult.items.map((item) => {
      const pProfileId = item.customerProfileId || item.forMemberId || defaultParticipant.customerProfileId;
      const matchedP = participantMap.get(pProfileId) || defaultParticipant;

      return {
        _id: new mongoose.Types.ObjectId(),
        participantId: matchedP._id,
        customerProfileId: matchedP.customerProfileId,
        participantName: matchedP.name,
        itemType: item.itemType || 'SERVICE',
        serviceId: item.serviceId || item.refId,
        serviceName: item.serviceName || item.name,
        categoryId: item.categoryId || null,
        categoryName: item.categoryName || null,
        basePrice: item.basePrice,
        upgradeServiceId: item.upgradeServiceId || null,
        upgradeServiceName: item.upgradeServiceName || null,
        upgradePriceDifference: item.upgradePriceDifference || 0,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        durationMinutes: item.durationMinutes || 30,
        status: ITEM_STATUS.PENDING,
      };
    });

    // 5. Multi-Beautician Assignment Engine Execution
    const assignmentResult = await BeauticianAssignmentEngine.assign({
      participants: formattedParticipants,
      items: formattedItems,
      preferredBeauticianCount,
      availableBeauticians,
      settingsOverride: settings,
    });

    // 6. Generate Booking Number and Single Common OTPs
    const bookingNumber = `GR${Date.now().toString().slice(-6)}${crypto.randomBytes(1).toString('hex').toUpperCase()}`;
    const startOtp = generate4DigitOtp();
    const endOtp = generate4DigitOtp();

    const traceCtx = getTraceContext();
    const eventId = crypto.randomUUID();

    // 7. Atomic ACID Transaction for Booking + Outbox + Slot
    const result = await this.#runInSession(async (session) => {
      if (slotId) {
        const reservedSlot = await this.slotRepo.atomicReserveSeat(slotId, formattedParticipants.length, session);
        if (!reservedSlot) {
          throw new AppError('Selected slot is no longer available', HttpStatus.UNPROCESSABLE_ENTITY, ErrorCodes.BOOKING_SLOT_UNAVAILABLE);
        }
      }

      const initialStatus = BOOKING_STATUS.CONFIRMED;

      const booking = await this.bookingRepo.create(
        {
          bookingNumber,
          userId: accountOwnerId,
          accountOwnerId,
          schedulingMode,
          slotId: slotId || null,
          scheduledDate: scheduledDate || new Date().toISOString().split('T')[0],
          scheduledStartTime: scheduledStartTime ? new Date(scheduledStartTime) : new Date(),
          scheduledEndTime: scheduledEndTime ? new Date(scheduledEndTime) : new Date(Date.now() + 60 * 60 * 1000),
          preferredBeauticianCount: assignmentResult.preferredBeauticianCount,
          assignedBeauticianCount: assignmentResult.assignedBeauticianCount,
          addressId,
          addressSnapshot,
          participants: formattedParticipants,
          items: assignmentResult.items,
          beauticianAssignments: assignmentResult.assignments,
          hygieneKit: pricingResult.hygieneKit,
          pricing: pricingResult.pricing,
          couponCode: couponCode || null,
          specialInstructions: specialInstructions || null,
          startOtp,
          endOtp,
          status: initialStatus,
          paymentStatus: pricingResult.pricing.payableAmount === 0 ? 'PAID' : 'PENDING',
          paymentMethod,
          idempotencyKey: idempotencyKey || null,
          statusHistory: [
            {
              status: initialStatus,
              timestamp: new Date(),
              actor: 'CUSTOMER',
              reason: 'Initial booking creation',
            },
          ],
        },
        session,
      );

      // Create Transactional Outbox Record for Guaranteed Delivery
      await this.outboxRepo.create(
        {
          eventId,
          aggregateType: 'Booking',
          aggregateId: booking._id.toString(),
          eventType: EVENT_TYPES.BOOKING_CREATED,
          eventVersion: 1,
          routingKey: 'booking.created',
          payload: {
            bookingId: booking._id.toString(),
            bookingNumber: booking.bookingNumber,
            accountOwnerId,
            payableAmount: pricingResult.pricing.payableAmount,
            walletDeduction: pricingResult.pricing.walletDeduction,
            cashbackEarned: pricingResult.pricing.cashbackEarned,
            pointsEarned: pricingResult.pricing.pointsEarned,
            participantCount: formattedParticipants.length,
            itemCount: assignmentResult.items.length,
            assignedBeauticians: assignmentResult.assignments.map((a) => a.beauticianId),
          },
          correlationId: traceCtx.correlationId,
          causationId: traceCtx.requestId,
          status: 'PENDING',
        },
        session,
      );

      return booking;
    });

    // Proactive RabbitMQ publish
    if (this.eventPublisher) {
      this.eventPublisher
        .publish('booking.created', EVENT_TYPES.BOOKING_CREATED, {
          bookingId: result._id.toString(),
          bookingNumber: result.bookingNumber,
          accountOwnerId,
          payableAmount: pricingResult.pricing.payableAmount,
          walletDeduction: pricingResult.pricing.walletDeduction,
        })
        .catch(() => {});
    }

    return result;
  }

  async getById(id, userId = null, userRole = null) {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) {
      throw new AppError('Booking not found', HttpStatus.NOT_FOUND, ErrorCodes.BOOKING_NOT_FOUND);
    }
    return booking;
  }

  async listUserBookings(accountOwnerId, query = {}) {
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '10', 10), 100);
    const skip = (page - 1) * limit;
    const { items, total } = await this.bookingRepo.findUserBookings(accountOwnerId, { skip, limit });
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async listAdminBookings(query = {}) {
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '10', 10), 100);
    const skip = (page - 1) * limit;
    const filter = {};

    if (query.status) filter.status = query.status;
    if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
    if (query.schedulingMode) filter.schedulingMode = query.schedulingMode;
    if (query.beauticianId) filter['beauticianAssignments.beauticianId'] = query.beauticianId;
    if (query.scheduledDate) filter.scheduledDate = query.scheduledDate;

    // Date range filter
    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
      if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
    }

    // Amount range filter
    if (query.minAmount || query.maxAmount) {
      filter['pricing.payableAmount'] = {};
      if (query.minAmount) filter['pricing.payableAmount'].$gte = Number(query.minAmount);
      if (query.maxAmount) filter['pricing.payableAmount'].$lte = Number(query.maxAmount);
    }

    // Multi-customer filter
    if (query.isMultiCustomer === 'true' || query.isMultiCustomer === true) {
      filter['participants.1'] = { $exists: true };
    } else if (query.isMultiCustomer === 'false' || query.isMultiCustomer === false) {
      filter['participants.1'] = { $exists: false };
    }

    // Multi-beautician filter
    if (query.isMultiBeautician === 'true' || query.isMultiBeautician === true) {
      filter.assignedBeauticianCount = { $gte: 2 };
    }

    // Search query
    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      const regex = new RegExp(s, 'i');
      filter.$or = [
        { bookingNumber: regex },
        { accountOwnerId: regex },
        { 'addressSnapshot.name': regex },
        { 'addressSnapshot.phone': regex },
        { 'participants.name': regex },
        { 'items.serviceName': regex },
      ];
    }

    const { items, total } = await this.bookingRepo.findAndCount(filter, { skip, limit });
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Beautician View Isolation
   * Returns ONLY the services and participants assigned to the specific beautician
   */
  async getBeauticianAssignments(beauticianId, query = {}) {
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '10', 10), 100);
    const skip = (page - 1) * limit;

    const { items, total } = await this.bookingRepo.findBeauticianAssignments(beauticianId, { skip, limit });

    const isolatedBookings = items.map((b) => {
      const myItems = (b.items || []).filter((i) => i.assignedBeauticianId === beauticianId);
      const myParticipantIds = new Set(myItems.map((i) => i.participantId?.toString()));
      const myParticipants = (b.participants || []).filter((p) => myParticipantIds.has(p._id?.toString()));

      return {
        ...b,
        items: myItems,
        participants: myParticipants,
        myTotalDuration: myItems.reduce((acc, cur) => acc + (cur.durationMinutes || 30), 0),
      };
    });

    return { items: isolatedBookings, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Single Start OTP Verification
   * Starts service execution for all assigned items
   */
  async verifyStartOtp(id, otp) {
    const booking = await this.getById(id);

    if (booking.status === BOOKING_STATUS.COMPLETED || booking.status === BOOKING_STATUS.CANCELLED) {
      throw new AppError(`Cannot start booking in status ${booking.status}`, HttpStatus.BAD_REQUEST, ErrorCodes.BAD_REQUEST);
    }

    if (booking.startOtp !== String(otp).trim()) {
      booking.otpAttempts = (booking.otpAttempts || 0) + 1;
      await booking.save();
      throw new AppError('Invalid Start OTP', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    // Transition booking and all pending items to STARTED
    booking.startOtpVerified = true;
    booking.startOtpVerifiedAt = new Date();
    booking.status = BOOKING_STATUS.STARTED;

    booking.items.forEach((item) => {
      if (item.status === ITEM_STATUS.PENDING || item.status === ITEM_STATUS.ASSIGNED) {
        item.status = ITEM_STATUS.STARTED;
        item.startedAt = new Date();
      }
    });

    booking.statusHistory.push({
      status: BOOKING_STATUS.STARTED,
      timestamp: new Date(),
      actor: 'BEAUTICIAN',
      reason: 'Start OTP successfully verified',
    });

    await booking.save();

    if (this.eventPublisher) {
      this.eventPublisher
        .publish('booking.started', EVENT_TYPES.BOOKING_STARTED, {
          bookingId: booking._id.toString(),
          bookingNumber: booking.bookingNumber,
          accountOwnerId: booking.accountOwnerId,
        })
        .catch(() => {});
    }

    return booking;
  }

  /**
   * Beautician marks individual service item complete
   */
  async completeServiceItem(bookingId, itemId, beauticianId, notes = null) {
    const booking = await this.getById(bookingId);
    const item = booking.items.find((i) => i._id.toString() === itemId.toString());

    if (!item) {
      throw new AppError('Booking item not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
    }

    item.status = ITEM_STATUS.COMPLETED;
    item.completedAt = new Date();
    if (notes) item.beauticianNotes = notes;

    // Check if all items in the booking are complete
    const allCompleted = booking.items.every((i) => i.status === ITEM_STATUS.COMPLETED);
    if (allCompleted) {
      booking.status = BOOKING_STATUS.SERVICES_COMPLETED;
      booking.statusHistory.push({
        status: BOOKING_STATUS.SERVICES_COMPLETED,
        timestamp: new Date(),
        actor: 'BEAUTICIAN',
        reason: 'All individual service items completed. Ready for End OTP.',
      });
    }

    await booking.save();

    if (this.eventPublisher) {
      this.eventPublisher
        .publish('booking.service.completed', EVENT_TYPES.BOOKING_SERVICE_COMPLETED, {
          bookingId: booking._id.toString(),
          itemId,
          serviceName: item.serviceName,
          allCompleted,
        })
        .catch(() => {});
    }

    return { booking, item, allCompleted };
  }

  /**
   * Single End OTP Verification
   * Strictly unlocks ONLY when all assigned service items are complete
   */
  async verifyEndOtp(id, otp) {
    const booking = await this.getById(id);

    if (booking.status === BOOKING_STATUS.COMPLETED) {
      return booking;
    }

    // STRICT CHECK: Verify that EVERY item is marked COMPLETED
    const incompleteItems = booking.items.filter((i) => i.status !== ITEM_STATUS.COMPLETED);
    if (incompleteItems.length > 0) {
      throw new AppError(
        `Cannot verify End OTP. ${incompleteItems.length} service item(s) are still in progress.`,
        HttpStatus.BAD_REQUEST,
        ErrorCodes.BAD_REQUEST,
      );
    }

    if (booking.endOtp !== String(otp).trim()) {
      throw new AppError('Invalid End OTP', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
    }

    const traceCtx = getTraceContext();
    const eventId = crypto.randomUUID();

    const result = await this.#runInSession(async (session) => {
      booking.endOtpVerified = true;
      booking.endOtpVerifiedAt = new Date();
      booking.status = BOOKING_STATUS.COMPLETED;
      booking.statusHistory.push({
        status: BOOKING_STATUS.COMPLETED,
        timestamp: new Date(),
        actor: 'CUSTOMER',
        reason: 'End OTP verified. Service successfully completed.',
      });

      await booking.save({ session });

      // Create Outbox event for Cashback & Points Realization (Credited to Account Owner)
      await this.outboxRepo.create(
        {
          eventId,
          aggregateType: 'Booking',
          aggregateId: booking._id.toString(),
          eventType: EVENT_TYPES.BOOKING_COMPLETED,
          eventVersion: 1,
          routingKey: 'booking.completed',
          payload: {
            bookingId: booking._id.toString(),
            bookingNumber: booking.bookingNumber,
            accountOwnerId: booking.accountOwnerId,
            payableAmount: booking.pricing.payableAmount,
            cashbackEarned: booking.pricing.cashbackEarned,
            pointsEarned: booking.pricing.pointsEarned,
            completedAt: new Date(),
          },
          correlationId: traceCtx.correlationId,
          causationId: traceCtx.requestId,
          status: 'PENDING',
        },
        session,
      );

      return booking;
    });

    // Proactive publish
    if (this.eventPublisher) {
      this.eventPublisher
        .publish('booking.completed', EVENT_TYPES.BOOKING_COMPLETED, {
          bookingId: result._id.toString(),
          bookingNumber: result.bookingNumber,
          accountOwnerId: result.accountOwnerId,
          cashbackEarned: result.pricing.cashbackEarned,
          pointsEarned: result.pricing.pointsEarned,
        })
        .catch(() => {});
    }

    return result;
  }

  /**
   * Cancel Booking with dynamic cancellation fee calculation
   */
  async cancelBooking(id, accountOwnerId, { reason = 'User requested cancellation', isDelayed = false } = {}) {
    const booking = await this.getById(id);

    if (booking.status === BOOKING_STATUS.COMPLETED || booking.status === BOOKING_STATUS.CANCELLED) {
      return booking;
    }

    // Dynamic fee calculation
    const feeResult = await CancellationEngine.calculateFee(booking, { isDelayed });

    const result = await this.#runInSession(async (session) => {
      if (booking.slotId) {
        await this.slotRepo.atomicReleaseSeat(
          booking.slotId._id || booking.slotId,
          booking.participants.length,
          session,
        );
      }

      booking.status = BOOKING_STATUS.CANCELLED;
      booking.cancellation = {
        cancelledAt: new Date(),
        cancelledBy: accountOwnerId,
        reason,
        fee: feeResult.fee,
        feeWaived: feeResult.feeWaived,
        waiveReason: feeResult.waiveReason,
      };
      booking.statusHistory.push({
        status: BOOKING_STATUS.CANCELLED,
        timestamp: new Date(),
        actor: accountOwnerId,
        reason,
        metadata: feeResult,
      });

      await booking.save({ session });
      return booking;
    });

    if (this.eventPublisher) {
      this.eventPublisher
        .publish('booking.cancelled', EVENT_TYPES.BOOKING_CANCELLED, {
          bookingId: id,
          bookingNumber: result.bookingNumber,
          accountOwnerId: result.accountOwnerId,
          cancellationFee: feeResult.fee,
          reason,
        })
        .catch(() => {});
    }

    return result;
  }

  /**
   * Admin Manual Beautician Assignment / Reassignment
   */
  async adminAssignBeauticians(bookingId, assignments, assignedBy = 'ADMIN', adminActor = 'ADMIN') {
    const booking = await this.getById(bookingId);

    const sourceEnum = ['AUTO', 'ADMIN', 'SYSTEM'].includes(assignedBy) ? assignedBy : 'ADMIN';

    const updatedAssignments = assignments.map((a) => ({
      beauticianId: a.beauticianId,
      beauticianName: a.beauticianName,
      assignedItemIds: a.assignedItemIds || [],
      assignmentStatus: 'ASSIGNED',
      assignedBy: sourceEnum,
      assignedAt: new Date(),
    }));

    // Update items with assigned beautician
    const itemMap = new Map();
    updatedAssignments.forEach((a) => {
      (a.assignedItemIds || []).forEach((itemId) => {
        itemMap.set(itemId.toString(), { id: a.beauticianId, name: a.beauticianName });
      });
    });

    booking.items.forEach((item) => {
      const match = itemMap.get(item._id.toString());
      if (match) {
        item.assignedBeauticianId = match.id;
        item.assignedBeauticianName = match.name;
        item.status = ITEM_STATUS.ASSIGNED;
      }
    });

    booking.beauticianAssignments = updatedAssignments;
    booking.assignedBeauticianCount = updatedAssignments.length;
    booking.status = BOOKING_STATUS.ASSIGNED;
    booking.statusHistory.push({
      status: BOOKING_STATUS.ASSIGNED,
      timestamp: new Date(),
      actor: adminActor || 'ADMIN',
      reason: 'Admin assigned beauticians',
    });

    await booking.save();
    return booking;
  }
}
