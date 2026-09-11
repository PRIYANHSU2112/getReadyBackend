import { logger } from '@getready/logger';
import { IdempotencyModel } from '../models/idempotency.model.js';
import { IdempotencyService } from '@getready/rabbitmq';

export class NotificationConsumer {
  constructor(eventConsumer, notificationService) {
    this.consumer = eventConsumer;
    this.notificationService = notificationService;
    this.idempotency = new IdempotencyService(IdempotencyModel, 'notification-service');
  }

  async start() {
    await this.consumer.consume(
      [
        'UserRegistered',
        'BookingCreated',
        'BookingConfirmed',
        'BookingCancelled',
        'PaymentSucceeded',
        'WalletCredited',
        'WalletDebited',
      ],
      this.handleEvent.bind(this),
    );
    logger.info('NotificationConsumer listening for domain events');
  }

  async handleEvent(envelope) {
    const { eventType, eventId, data } = envelope;

    await this.idempotency.runIdempotent(eventId, eventType, async () => {
      logger.info({ eventType, eventId, data }, 'Processing notification for event');

      switch (eventType) {
        case 'UserRegistered': {
          if (data.userId) {
            await this.notificationService.sendNotification({
              userId: data.userId,
              title: 'Welcome to GetReady!',
              body: `Hello ${data.name || 'there'}, your account is ready. Explore our beauty and salon services!`,
              data: { eventId, type: 'WELCOME' },
            });
          }
          break;
        }
        case 'BookingCreated': {
          if (data.userId) {
            await this.notificationService.sendNotification({
              userId: data.userId,
              title: 'Booking Placed',
              body: `Your booking #${data.bookingNumber || data.bookingId} has been created. Total: ₹${data.payableAmount || data.totalAmount || 0}`,
              data: { eventId, bookingId: data.bookingId },
            });
          }
          break;
        }
        case 'BookingConfirmed': {
          if (data.userId) {
            await this.notificationService.sendNotification({
              userId: data.userId,
              title: 'Booking Confirmed!',
              body: `Your booking #${data.bookingNumber || data.bookingId} is confirmed for ${data.bookingDate || 'the selected slot'}.`,
              data: { eventId, bookingId: data.bookingId },
            });
          }
          break;
        }
        case 'BookingCancelled': {
          if (data.userId) {
            await this.notificationService.sendNotification({
              userId: data.userId,
              title: 'Booking Cancelled',
              body: `Booking #${data.bookingId} has been cancelled.`,
              data: { eventId, bookingId: data.bookingId },
            });
          }
          break;
        }
        case 'PaymentSucceeded': {
          if (data.userId) {
            await this.notificationService.sendNotification({
              userId: data.userId,
              title: 'Payment Successful',
              body: `Payment of ₹${data.amount} received successfully.`,
              data: { eventId, paymentId: data.paymentId },
            });
          }
          break;
        }
        case 'WalletCredited': {
          if (data.userId) {
            await this.notificationService.sendNotification({
              userId: data.userId,
              title: 'Wallet Credited',
              body: `₹${data.amount} has been credited to your wallet. Current balance: ₹${data.balance}`,
              data: { eventId },
            });
          }
          break;
        }
        case 'WalletDebited': {
          if (data.userId) {
            await this.notificationService.sendNotification({
              userId: data.userId,
              title: 'Wallet Debited',
              body: `₹${data.amount} has been debited from your wallet. Current balance: ₹${data.balance}`,
              data: { eventId },
            });
          }
          break;
        }
        default:
          break;
      }
    });
  }
}
