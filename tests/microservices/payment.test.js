import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PaymentService } from '../../services/payment-service/src/services/payment.service.js';
import { PaymentStatus } from '../../services/payment-service/src/models/payment.model.js';

describe('Payment Service Test Suite', () => {
  let paymentRepo;
  let publisher;
  let paymentService;

  beforeEach(() => {
    paymentRepo = {
      create: jest.fn().mockImplementation((data) => ({
        _id: '65fc8e129182a1048b111777',
        ...data,
      })),
      findByRazorpayOrderId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn().mockImplementation((doc) => doc),
    };

    publisher = {
      publishDomainEvent: jest.fn().mockResolvedValue(true),
    };

    paymentService = new PaymentService(paymentRepo, publisher);
    paymentService.razorpayClient = null; // Use mock order generator in tests
  });

  it('should create payment order and publish PaymentInitiated', async () => {
    const res = await paymentService.createOrder({
      userId: '65fc8e129182a1048b111002',
      amount: 499,
      bookingId: '65fc8e129182a1048b111333',
    });

    expect(res.paymentId).toBe('65fc8e129182a1048b111777');
    expect(res.amount).toBe(499);
    expect(publisher.publishDomainEvent).toHaveBeenCalledWith(
      'PaymentInitiated',
      expect.objectContaining({ amount: 499, userId: '65fc8e129182a1048b111002' }),
      expect.any(Object),
    );
  });

  it('should verify payment without error when signature matches', async () => {
    const mockPayment = {
      _id: '65fc8e129182a1048b111777',
      userId: '65fc8e129182a1048b111002',
      amount: 499,
      status: PaymentStatus.PENDING,
      paymentMethod: 'RAZORPAY',
      currency: 'INR',
      save: jest.fn().mockResolvedValue(true),
    };

    paymentRepo.findByRazorpayOrderId.mockResolvedValue(mockPayment);

    const verified = await paymentService.verifyPayment({
      orderId: 'order_test_123',
      paymentId: 'pay_test_123',
      signature: '',
      userId: '65fc8e129182a1048b111002',
    });

    expect(verified.status).toBe(PaymentStatus.SUCCESS);
    expect(publisher.publishDomainEvent).toHaveBeenCalledWith(
      'PaymentSucceeded',
      expect.objectContaining({ paymentId: '65fc8e129182a1048b111777' }),
      expect.any(Object),
    );
  });
});
