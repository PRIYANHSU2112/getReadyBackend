import { logger } from '@getready/logger';
import { IdempotencyModel } from '../models/idempotency.model.js';
import { IdempotencyService } from '@getready/rabbitmq';
import { WalletTransactionCategory } from '../models/wallet.enum.js';

export class WalletConsumer {
  constructor(eventConsumer, walletService) {
    this.consumer = eventConsumer;
    this.walletService = walletService;
    this.idempotency = new IdempotencyService(IdempotencyModel, 'wallet-service');
  }

  async start() {
    await this.consumer.subscribe(
      'wallet-service.events',
      [
        'payment.succeeded',
        'payment.refunded',
        'booking.cancelled',
        'booking.created',
        'booking.completed',
      ],
      this.handleEvent.bind(this),
    );
    logger.info('WalletConsumer listening for payment & booking events');
  }

  async handleEvent(envelope) {
    const { eventType, eventId, data } = envelope;

    await this.idempotency.process(eventId, eventType, async () => {
      logger.info({ eventType, eventId, data }, 'Processing event in wallet-service');

      switch (eventType) {
        case 'BookingCreated': {
          if (data.accountOwnerId && data.walletDeduction > 0) {
            await this.walletService.debitWallet(
              data.accountOwnerId,
              data.walletDeduction,
              WalletTransactionCategory.BOOKING_PAYMENT,
              data.bookingId,
              `Wallet payment for booking #${data.bookingNumber || data.bookingId}`,
              { eventId },
            );
          }
          break;
        }
        case 'BookingCompleted': {
          const ownerId = data.accountOwnerId || data.userId;
          if (ownerId && data.cashbackEarned > 0) {
            await this.walletService.creditWallet(
              ownerId,
              data.cashbackEarned,
              WalletTransactionCategory.CASHBACK,
              data.bookingId,
              `Cashback reward for completed booking #${data.bookingNumber || data.bookingId}`,
              { eventId },
            );
          }
          if (ownerId && data.pointsEarned > 0) {
            await this.walletService.addPoints(
              ownerId,
              data.pointsEarned,
              `Reward points for completed booking #${data.bookingNumber || data.bookingId}`,
              data.bookingId,
            );
          }
          break;
        }
        case 'PaymentRefunded': {
          if (data.userId && data.amount) {
            await this.walletService.creditWallet(
              data.userId,
              data.amount,
              WalletTransactionCategory.BOOKING_REFUND,
              data.bookingId || data.paymentId,
              'Refund for booking/payment',
              { eventId },
            );
          }
          break;
        }
        case 'BookingCancelled': {
          if (data.refundToWallet && data.userId && data.refundAmount > 0) {
            await this.walletService.creditWallet(
              data.userId,
              data.refundAmount,
              WalletTransactionCategory.BOOKING_REFUND,
              data.bookingId,
              `Refund for cancelled booking #${data.bookingId}`,
              { eventId },
            );
          }
          break;
        }
        default:
          break;
      }
    });
  }
}
