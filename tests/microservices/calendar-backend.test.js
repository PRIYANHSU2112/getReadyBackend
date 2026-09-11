import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { CalendarService } from '../../services/booking-service/src/services/calendar.service.js';
import { BookingService } from '../../services/booking-service/src/services/booking.service.js';
import { BOOKING_STATUS } from '../../services/booking-service/src/models/booking.models.js';

describe('Calendar & Scheduling Backend Engine — Comprehensive Test Suite', () => {
  let mockBookingRepo;
  let mockSlotRepo;
  let mockOutboxRepo;
  let mockSlotInventory;
  let mockEventPublisher;
  let calendarService;
  let bookingService;

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
      findCalendarAppointments: jest.fn(),
      getDayLevelCounts: jest.fn(),
      getSummaryStats: jest.fn(),
      findOverlappingBookings: jest.fn(),
      rescheduleBooking: jest.fn(),
      completeBooking: jest.fn(),
      findByIdempotencyKey: jest.fn().mockResolvedValue(null),
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

    calendarService = new CalendarService(mockBookingRepo, mockSlotRepo, mockEventPublisher);
    bookingService = new BookingService(mockBookingRepo, mockSlotRepo, mockOutboxRepo, mockSlotInventory, mockEventPublisher);
  });

  // -------------------------------------------------------------------------
  // 1 & 2 & 3: Calendar Transformation & Appointment Response Contract
  // -------------------------------------------------------------------------
  describe('Appointment Response & Transformation', () => {
    it('transforms raw DB booking into rich standard calendar appointment format', () => {
      const rawBooking = {
        _id: new mongoose.Types.ObjectId('650000000000000000000001'),
        bookingNumber: 'GR902100',
        userId: 'user-001',
        accountOwnerId: 'user-001',
        scheduledDate: '2026-09-11',
        scheduledStartTime: new Date('2026-09-11T10:00:00Z'),
        scheduledEndTime: new Date('2026-09-11T11:00:00Z'),
        status: BOOKING_STATUS.CONFIRMED,
        paymentStatus: 'PAID',
        paymentMethod: 'online',
        items: [
          {
            serviceId: 'srv-101',
            serviceName: 'Hydra Glow Facial',
            durationMinutes: 60,
            unitPrice: 1499,
          },
        ],
        participants: [
          {
            customerProfileId: 'cust-101',
            name: 'Rita Sharma',
            mobileNumber: '9876543210',
          },
        ],
        beauticianAssignments: [
          {
            beauticianId: 'beau-201',
            beauticianName: 'Neha Kapoor',
          },
        ],
        addressId: 'addr-301',
        addressSnapshot: {
          addressLine1: 'Flat 402, Lotus Heights',
          city: 'Mumbai',
          pincode: '400050',
        },
        pricing: {
          payableAmount: 1499,
        },
        specialInstructions: 'Please ring bell twice',
      };

      const transformed = calendarService.transformAppointment(rawBooking);

      expect(transformed.id).toBe('650000000000000000000001');
      expect(transformed.bookingNumber).toBe('GR902100');
      expect(transformed.date).toBe('2026-09-11');
      expect(transformed.startTime).toBe('10:00');
      expect(transformed.endTime).toBe('11:00');
      expect(transformed.durationMinutes).toBe(60);
      expect(transformed.status).toBe('CONFIRMED');
      expect(transformed.paymentStatus).toBe('PAID');
      expect(transformed.service.name).toBe('Hydra Glow Facial');
      expect(transformed.customer.name).toBe('Rita Sharma');
      expect(transformed.customer.phone).toBe('9876543210');
      expect(transformed.beautician.name).toBe('Neha Kapoor');
      expect(transformed.amount).toBe(1499);
      expect(transformed.hasConflict).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 4 & 5: Conflict Detection Engine
  // -------------------------------------------------------------------------
  describe('Conflict Detection Logic', () => {
    it('detects overlapping appointments for the SAME beautician on the same date', () => {
      const appointments = [
        {
          id: 'app-1',
          bookingId: 'GR-001',
          bookingNumber: 'GR-001',
          date: '2026-09-11',
          startTime: '10:00',
          endTime: '11:00',
          status: 'CONFIRMED',
          beautician: { id: 'beau-neha', name: 'Neha', assignments: [{ beauticianId: 'beau-neha' }] },
          customer: { name: 'Rita' },
          hasConflict: false,
          conflicts: [],
        },
        {
          id: 'app-2',
          bookingId: 'GR-002',
          bookingNumber: 'GR-002',
          date: '2026-09-11',
          startTime: '10:30',
          endTime: '11:30',
          status: 'CONFIRMED',
          beautician: { id: 'beau-neha', name: 'Neha', assignments: [{ beauticianId: 'beau-neha' }] },
          customer: { name: 'Pooja' },
          hasConflict: false,
          conflicts: [],
        },
      ];

      const evaluated = calendarService.attachConflicts(appointments);

      expect(evaluated[0].hasConflict).toBe(true);
      expect(evaluated[1].hasConflict).toBe(true);
      expect(evaluated[0].conflicts[0].bookingId).toBe('GR-002');
      expect(evaluated[1].conflicts[0].bookingId).toBe('GR-001');
      expect(evaluated[0].conflicts[0].type).toBe('BEAUTICIAN_OVERLAP');
    });

    it('does NOT mark conflict for DIFFERENT beauticians at the same time', () => {
      const appointments = [
        {
          id: 'app-1',
          bookingId: 'GR-001',
          bookingNumber: 'GR-001',
          date: '2026-09-11',
          startTime: '10:00',
          endTime: '11:00',
          status: 'CONFIRMED',
          beautician: { id: 'beau-neha', name: 'Neha', assignments: [{ beauticianId: 'beau-neha' }] },
          customer: { name: 'Rita' },
          hasConflict: false,
          conflicts: [],
        },
        {
          id: 'app-2',
          bookingId: 'GR-002',
          bookingNumber: 'GR-002',
          date: '2026-09-11',
          startTime: '10:00',
          endTime: '11:00',
          status: 'CONFIRMED',
          beautician: { id: 'beau-priya', name: 'Priya', assignments: [{ beauticianId: 'beau-priya' }] },
          customer: { name: 'Pooja' },
          hasConflict: false,
          conflicts: [],
        },
      ];

      const evaluated = calendarService.attachConflicts(appointments);

      expect(evaluated[0].hasConflict).toBe(false);
      expect(evaluated[1].hasConflict).toBe(false);
      expect(evaluated[0].conflicts).toHaveLength(0);
      expect(evaluated[1].conflicts).toHaveLength(0);
    });

    it('does NOT mark conflict for sequential non-overlapping times (10:00-11:00 and 11:00-12:00)', () => {
      const appointments = [
        {
          id: 'app-1',
          bookingId: 'GR-001',
          date: '2026-09-11',
          startTime: '10:00',
          endTime: '11:00',
          status: 'CONFIRMED',
          beautician: { id: 'beau-neha', assignments: [{ beauticianId: 'beau-neha' }] },
          hasConflict: false,
          conflicts: [],
        },
        {
          id: 'app-2',
          bookingId: 'GR-002',
          date: '2026-09-11',
          startTime: '11:00',
          endTime: '12:00',
          status: 'CONFIRMED',
          beautician: { id: 'beau-neha', assignments: [{ beauticianId: 'beau-neha' }] },
          hasConflict: false,
          conflicts: [],
        },
      ];

      const evaluated = calendarService.attachConflicts(appointments);

      expect(evaluated[0].hasConflict).toBe(false);
      expect(evaluated[1].hasConflict).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 6 & 7: Multi-View Calendar Queries (Month, Week, Day, Agenda)
  // -------------------------------------------------------------------------
  describe('Multi-View Calendar Query API', () => {
    it('returns Month view with appointments, dayCounts, and KPI summary', async () => {
      mockBookingRepo.findCalendarAppointments.mockResolvedValue({
        items: [
          {
            _id: 'b1',
            bookingNumber: 'GR-100',
            scheduledDate: '2026-09-11',
            scheduledStartTime: new Date('2026-09-11T10:00:00Z'),
            scheduledEndTime: new Date('2026-09-11T11:00:00Z'),
            status: 'CONFIRMED',
            items: [{ serviceName: 'Manicure' }],
            participants: [{ name: 'Ananya' }],
            beauticianAssignments: [{ beauticianId: 'b-1', beauticianName: 'Neha' }],
          },
        ],
        total: 1,
      });

      mockBookingRepo.getDayLevelCounts.mockResolvedValue({
        '2026-09-11': { total: 1, confirmed: 1, pending: 0, completed: 0, cancelled: 0 },
      });

      mockBookingRepo.getSummaryStats.mockResolvedValue({
        total: 1,
        confirmed: 1,
        pending: 0,
        completed: 0,
        cancelled: 0,
        rescheduled: 0,
        revenue: 1499,
        trends: { total: 10, confirmed: 15 },
      });

      const result = await calendarService.getCalendar({
        view: 'month',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      });

      expect(result.view).toBe('month');
      expect(result.startDate).toBe('2026-09-01');
      expect(result.endDate).toBe('2026-09-30');
      expect(result.appointments).toHaveLength(1);
      expect(result.dayCounts['2026-09-11'].confirmed).toBe(1);
      expect(result.summary.total).toBe(1);
    });

    it('returns Week view bounded from Monday to Sunday', async () => {
      mockBookingRepo.findCalendarAppointments.mockResolvedValue({ items: [], total: 0 });
      mockBookingRepo.getDayLevelCounts.mockResolvedValue({});
      mockBookingRepo.getSummaryStats.mockResolvedValue({ total: 0 });

      const result = await calendarService.getCalendar({
        view: 'week',
        startDate: '2026-09-07',
      });

      expect(result.view).toBe('week');
      expect(result.startDate).toBe('2026-09-07');
      expect(result.endDate).toBe('2026-09-13');
    });

    it('returns Day view for specific date', async () => {
      mockBookingRepo.findCalendarAppointments.mockResolvedValue({ items: [], total: 0 });
      mockBookingRepo.getDayLevelCounts.mockResolvedValue({});
      mockBookingRepo.getSummaryStats.mockResolvedValue({ total: 0 });

      const result = await calendarService.getCalendar({
        view: 'day',
        date: '2026-09-11',
      });

      expect(result.view).toBe('day');
      expect(result.date).toBe('2026-09-11');
      expect(result.startDate).toBe('2026-09-11');
      expect(result.endDate).toBe('2026-09-11');
    });

    it('returns Agenda view grouped by date', async () => {
      mockBookingRepo.findCalendarAppointments.mockResolvedValue({
        items: [
          {
            _id: 'b1',
            bookingNumber: 'GR-101',
            scheduledDate: '2026-09-11',
            scheduledStartTime: new Date('2026-09-11T10:00:00Z'),
            scheduledEndTime: new Date('2026-09-11T11:00:00Z'),
            status: 'CONFIRMED',
            items: [{ serviceName: 'Pedicure' }],
            participants: [{ name: 'Kavita' }],
            beauticianAssignments: [],
          },
          {
            _id: 'b2',
            bookingNumber: 'GR-102',
            scheduledDate: '2026-09-12',
            scheduledStartTime: new Date('2026-09-12T14:00:00Z'),
            scheduledEndTime: new Date('2026-09-12T15:00:00Z'),
            status: 'CONFIRMED',
            items: [{ serviceName: 'Hair Spa' }],
            participants: [{ name: 'Simran' }],
            beauticianAssignments: [],
          },
        ],
        total: 2,
      });
      mockBookingRepo.getDayLevelCounts.mockResolvedValue({});
      mockBookingRepo.getSummaryStats.mockResolvedValue({ total: 2 });

      const result = await calendarService.getCalendar({
        view: 'agenda',
        startDate: '2026-09-11',
        endDate: '2026-09-20',
      });

      expect(result.view).toBe('agenda');
      expect(result.groupedByDate['2026-09-11']).toHaveLength(1);
      expect(result.groupedByDate['2026-09-12']).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // 8: Today Appointments API
  // -------------------------------------------------------------------------
  describe("Today's Appointments API", () => {
    it("returns today's appointments ordered chronologically", async () => {
      mockBookingRepo.findCalendarAppointments.mockResolvedValue({
        items: [
          {
            _id: 'b2',
            bookingNumber: 'GR-102',
            scheduledDate: '2026-09-11',
            scheduledStartTime: new Date('2026-09-11T14:00:00Z'),
            scheduledEndTime: new Date('2026-09-11T15:00:00Z'),
            status: 'CONFIRMED',
            items: [],
            participants: [],
            beauticianAssignments: [],
          },
          {
            _id: 'b1',
            bookingNumber: 'GR-101',
            scheduledDate: '2026-09-11',
            scheduledStartTime: new Date('2026-09-11T09:30:00Z'),
            scheduledEndTime: new Date('2026-09-11T10:30:00Z'),
            status: 'CONFIRMED',
            items: [],
            participants: [],
            beauticianAssignments: [],
          },
        ],
        total: 2,
      });

      const result = await calendarService.getTodayAppointments({ date: '2026-09-11' });

      expect(result.appointments).toHaveLength(2);
      expect(result.appointments[0].bookingNumber).toBe('GR-101'); // 09:30 before 14:00
      expect(result.appointments[1].bookingNumber).toBe('GR-102');
    });
  });

  // -------------------------------------------------------------------------
  // 9: Beautician Availability API
  // -------------------------------------------------------------------------
  describe('Beautician Availability API', () => {
    it('marks time slots unavailable when overlapping booking exists', async () => {
      mockBookingRepo.findOverlappingBookings.mockResolvedValue([
        {
          _id: 'b1',
          bookingNumber: 'GR-BUSY',
          scheduledDate: '2026-09-11',
          scheduledStartTime: new Date('2026-09-11T11:00:00Z'),
          scheduledEndTime: new Date('2026-09-11T12:00:00Z'),
        },
      ]);

      const result = await calendarService.getAvailability({
        date: '2026-09-11',
        beauticianId: 'beau-101',
        durationMinutes: 60,
      });

      expect(result.date).toBe('2026-09-11');
      expect(result.slots.length).toBeGreaterThan(0);

      const slot10 = result.slots.find((s) => s.startTime === '10:00');
      const slot11 = result.slots.find((s) => s.startTime === '11:00');

      expect(slot10.available).toBe(true);
      expect(slot11.available).toBe(false);
      expect(slot11.bookingId).toBe('GR-BUSY');
    });
  });

  // -------------------------------------------------------------------------
  // 10 & 11: Reschedule Booking with Conflict Prevention
  // -------------------------------------------------------------------------
  describe('Reschedule Booking', () => {
    it('prevents rescheduling if new time conflicts with beauticians existing booking', async () => {
      mockBookingRepo.findById.mockResolvedValue({
        _id: new mongoose.Types.ObjectId('650000000000000000000001'),
        status: BOOKING_STATUS.CONFIRMED,
        scheduledDate: '2026-09-11',
        beauticianAssignments: [{ beauticianId: 'beau-neha' }],
        items: [{ durationMinutes: 60 }],
      });

      mockBookingRepo.findOverlappingBookings.mockResolvedValue([
        {
          _id: 'other-booking-id',
          bookingNumber: 'GR-OTHER',
        },
      ]);

      await expect(
        calendarService.rescheduleBooking('650000000000000000000001', {
          date: '2026-09-15',
          startTime: '14:00',
          beauticianId: 'beau-neha',
        }),
      ).rejects.toThrow('Beautician is already booked during this time interval');
    });

    it('successfully reschedules when no conflict exists', async () => {
      mockBookingRepo.findById.mockResolvedValue({
        _id: new mongoose.Types.ObjectId('650000000000000000000001'),
        bookingNumber: 'GR-123456',
        accountOwnerId: 'user-001',
        status: BOOKING_STATUS.CONFIRMED,
        scheduledDate: '2026-09-11',
        beauticianAssignments: [{ beauticianId: 'beau-neha' }],
        items: [{ durationMinutes: 60, serviceName: 'Cleanup' }],
        participants: [{ name: 'Pooja' }],
      });

      mockBookingRepo.findOverlappingBookings.mockResolvedValue([]);

      mockBookingRepo.rescheduleBooking.mockResolvedValue({
        _id: '650000000000000000000001',
        bookingNumber: 'GR-123456',
        accountOwnerId: 'user-001',
        scheduledDate: '2026-09-15',
        scheduledStartTime: new Date('2026-09-15T14:00:00Z'),
        scheduledEndTime: new Date('2026-09-15T15:00:00Z'),
        status: BOOKING_STATUS.RESCHEDULED,
        items: [{ serviceName: 'Cleanup' }],
        participants: [{ name: 'Pooja' }],
        beauticianAssignments: [{ beauticianId: 'beau-neha', beauticianName: 'Neha' }],
      });

      const updated = await calendarService.rescheduleBooking('650000000000000000000001', {
        date: '2026-09-15',
        startTime: '14:00',
        beauticianId: 'beau-neha',
        reason: 'Customer requested afternoon appointment',
      });

      expect(updated.date).toBe('2026-09-15');
      expect(updated.startTime).toBe('14:00');
      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 12: Complete Booking
  // -------------------------------------------------------------------------
  describe('Complete Booking', () => {
    it('marks booking completed and publishes completion event', async () => {
      mockBookingRepo.findById.mockResolvedValue({
        _id: new mongoose.Types.ObjectId('650000000000000000000001'),
        status: BOOKING_STATUS.STARTED,
      });

      mockBookingRepo.completeBooking.mockResolvedValue({
        _id: '650000000000000000000001',
        bookingNumber: 'GR-123456',
        accountOwnerId: 'user-001',
        status: BOOKING_STATUS.COMPLETED,
        items: [{ serviceName: 'Facial', status: 'COMPLETED' }],
        participants: [{ name: 'Pooja' }],
        beauticianAssignments: [],
      });

      const completed = await calendarService.completeBooking('650000000000000000000001', {
        notes: 'Admin completed service successfully',
      });

      expect(completed.status).toBe('COMPLETED');
      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });
  });
});
