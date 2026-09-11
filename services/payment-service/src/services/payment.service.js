import crypto from 'crypto';
import Razorpay from 'razorpay';
import { AppError, NotFoundError, ValidationError, ConflictError } from '@getready/errors';
import { PaymentStatus, PaymentMethod } from '../models/payment.model.js';
import { config } from '../config/index.js';
import { paymentsSuccessTotal, paymentsFailedTotal } from '@getready/metrics';
import { logger } from '@getready/logger';

export class PaymentService {
  constructor(paymentRepository, publisher = null) {
    this.paymentRepository = paymentRepository;
    this.publisher = publisher;

    if (
      config.razorpay.keyId &&
      config.razorpay.keyId !== 'rzp_test_mock_key' &&
      config.razorpay.keySecret &&
      config.razorpay.keySecret !== 'mock_secret'
    ) {
      this.razorpayClient = new Razorpay({
        key_id: config.razorpay.keyId,
        key_secret: config.razorpay.keySecret,
      });
    } else {
      this.razorpayClient = null;
    }
  }

  async createOrder({ userId, bookingId = null, amount, currency = 'INR', idempotencyKey = null, metadata = {} }) {
    if (amount <= 0) throw new ValidationError('Payment amount must be positive');

    if (idempotencyKey) {
      const existing = await this.paymentRepository.findByRazorpayOrderId(idempotencyKey);
      if (existing) return existing;
    }

    const amountInPaise = Math.round(amount * 100);
    let orderId = `order_rzp_${Date.now()}`;

    if (this.razorpayClient) {
      const rzpOrder = await this.razorpayClient.orders.create({
        amount: amountInPaise,
        currency,
        receipt: `rcpt_${bookingId || userId}_${Date.now()}`,
        notes: { userId: String(userId), bookingId: String(bookingId || '') },
      });
      orderId = rzpOrder.id;
    }

    const payment = await this.paymentRepository.create({
      userId,
      bookingId,
      amount,
      currency,
      status: PaymentStatus.PENDING,
      paymentMethod: PaymentMethod.RAZORPAY,
      razorpayOrderId: orderId,
      idempotencyKey,
      metadata,
    });

    if (this.publisher) {
      await this.publisher.publishDomainEvent('PaymentInitiated', {
        paymentId: payment._id,
        userId,
        bookingId,
        amount,
        orderId,
      }, { aggregateId: String(payment._id) });
    }

    return {
      paymentId: payment._id,
      orderId,
      amount,
      currency,
      keyId: config.razorpay.keyId,
    };
  }

  async verifyPayment({ orderId, paymentId, signature, userId }) {
    const payment = await this.paymentRepository.findByRazorpayOrderId(orderId);
    if (!payment) throw new NotFoundError('Payment order not found');

    if (payment.status === PaymentStatus.SUCCESS) {
      return payment;
    }

    // Verify signature if configured
    if (this.razorpayClient && signature) {
      const body = orderId + '|' + paymentId;
      const expectedSignature = crypto
        .createHmac('sha256', config.razorpay.keySecret)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature !== signature) {
        payment.status = PaymentStatus.FAILED;
        payment.failureReason = 'Invalid payment signature';
        await this.paymentRepository.save(payment);
        paymentsFailedTotal.inc({ service: 'payment-service', method: payment.paymentMethod, gateway: 'RAZORPAY', reason: 'SIGNATURE_MISMATCH' });
        throw new ValidationError('Invalid payment signature');
      }
    }

    payment.status = PaymentStatus.SUCCESS;
    payment.razorpayPaymentId = paymentId;
    payment.razorpaySignature = signature;
    await this.paymentRepository.save(payment);

    paymentsSuccessTotal.inc({ service: 'payment-service', method: payment.paymentMethod, gateway: 'RAZORPAY', currency: payment.currency || 'INR' });

    if (this.publisher) {
      await this.publisher.publishDomainEvent('PaymentSucceeded', {
        paymentId: payment._id,
        userId: payment.userId,
        bookingId: payment.bookingId,
        amount: payment.amount,
        razorpayPaymentId: paymentId,
        razorpayOrderId: orderId,
      }, { aggregateId: String(payment._id) });
    }

    return payment;
  }

  async processWebhook(payload, signature) {
    if (config.razorpay.webhookSecret && config.razorpay.webhookSecret !== 'mock_webhook_secret') {
      const expectedSignature = crypto
        .createHmac('sha256', config.razorpay.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (expectedSignature !== signature) {
        throw new ValidationError('Invalid webhook signature');
      }
    }

    const event = payload.event;
    if (event === 'payment.captured') {
      const paymentEntity = payload.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      if (orderId) {
        const payment = await this.paymentRepository.findByRazorpayOrderId(orderId);
        if (payment && payment.status === PaymentStatus.PENDING) {
          payment.status = PaymentStatus.SUCCESS;
          payment.razorpayPaymentId = paymentEntity.id;
          await this.paymentRepository.save(payment);

          paymentsSuccessTotal.inc({ service: 'payment-service', method: payment.paymentMethod, gateway: 'RAZORPAY', currency: payment.currency || 'INR' });

          if (this.publisher) {
            await this.publisher.publishDomainEvent('PaymentSucceeded', {
              paymentId: payment._id,
              userId: payment.userId,
              bookingId: payment.bookingId,
              amount: payment.amount,
              razorpayPaymentId: paymentEntity.id,
              razorpayOrderId: orderId,
            }, { aggregateId: String(payment._id) });
          }
        }
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = payload.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      if (orderId) {
        const payment = await this.paymentRepository.findByRazorpayOrderId(orderId);
        if (payment && payment.status === PaymentStatus.PENDING) {
          payment.status = PaymentStatus.FAILED;
          payment.failureReason = paymentEntity.error_description || 'Payment failed';
          await this.paymentRepository.save(payment);

          paymentsFailedTotal.inc({ service: 'payment-service', method: payment.paymentMethod, gateway: 'RAZORPAY', reason: payment.failureReason });

          if (this.publisher) {
            await this.publisher.publishDomainEvent('PaymentFailed', {
              paymentId: payment._id,
              userId: payment.userId,
              bookingId: payment.bookingId,
              amount: payment.amount,
              reason: payment.failureReason,
            }, { aggregateId: String(payment._id) });
          }
        }
      }
    }

    return { received: true };
  }

  async refundPayment(paymentId, { amount, reason }) {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) throw new NotFoundError('Payment not found');

    if (payment.status !== PaymentStatus.SUCCESS) {
      throw new ValidationError('Only successful payments can be refunded');
    }

    const refundAmount = amount || payment.amount;
    if (refundAmount > payment.amount) {
      throw new ValidationError('Refund amount cannot exceed payment amount');
    }

    if (this.razorpayClient && payment.razorpayPaymentId) {
      await this.razorpayClient.payments.refund(payment.razorpayPaymentId, {
        amount: Math.round(refundAmount * 100),
        notes: { reason: reason || 'Customer refund' },
      });
    }

    payment.refundAmount += refundAmount;
    payment.status = payment.refundAmount >= payment.amount ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
    await this.paymentRepository.save(payment);

    if (this.publisher) {
      await this.publisher.publishDomainEvent('PaymentRefunded', {
        paymentId: payment._id,
        userId: payment.userId,
        bookingId: payment.bookingId,
        amount: refundAmount,
        reason,
      }, { aggregateId: String(payment._id) });
    }

    return payment;
  }

  async getPaymentById(id) {
    const payment = await this.paymentRepository.findById(id);
    if (!payment) throw new NotFoundError('Payment not found');
    return payment;
  }

  async listPayments(queryParams = {}) {
    const {
      page = 1,
      limit = 25,
      search,
      status,
      method,
      paymentMethod,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = queryParams;

    const filter = {};

    if (status && status !== 'all' && status !== 'ALL') {
      filter.status = status.toUpperCase();
    }

    const selectedMethod = method || paymentMethod;
    if (selectedMethod && selectedMethod !== 'all') {
      filter.paymentMethod = selectedMethod.toUpperCase();
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { paymentNumber: regex },
        { razorpayOrderId: regex },
        { razorpayPaymentId: regex },
      ];
    }

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const parsedLimit = Math.min(Math.max(1, parseInt(limit, 10) || 25), 100);
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);

    return this.paymentRepository.findWithPagination({
      filter,
      page: parsedPage,
      limit: parsedLimit,
      sortBy,
      sortOrder,
    });
  }

  async getKpis() {
    return this.paymentRepository.getKpis();
  }

  async createPaymentManual(data) {
    const amount = Number(data.amount || 0);
    if (amount <= 0) throw new ValidationError('Amount must be greater than 0');

    return this.paymentRepository.create({
      userId: data.userId || '650000000000000000000001',
      bookingId: data.bookingId || null,
      amount,
      currency: data.currency || 'INR',
      status: (data.status || 'SUCCESS').toUpperCase(),
      paymentMethod: (data.method || data.paymentMethod || 'RAZORPAY').toUpperCase(),
      metadata: data.metadata || {},
    });
  }

  async updatePayment(id, data) {
    const payment = await this.paymentRepository.update(id, data);
    if (!payment) throw new NotFoundError('Payment not found');
    return payment;
  }

  async deletePayment(id) {
    const payment = await this.paymentRepository.update(id, { status: PaymentStatus.FAILED });
    if (!payment) throw new NotFoundError('Payment not found');
    return { id, deleted: true };
  }
}
