import { logger } from '@getready/logger';
import { IdempotencyService } from '@getready/rabbitmq';
import { IdempotencyRecordModel } from '../models/booking.models.js';

export class BookingConsumer {
  /**
   * @param {import('@getready/rabbitmq').EventConsumer} eventConsumer
   * @param {import('../services/booking.service.js').BookingService} bookingService
   */
  constructor(eventConsumer, bookingService) {
    this.eventConsumer = eventConsumer;
    this.bookingService = bookingService;
    this.idempotency = new IdempotencyService(IdempotencyRecordModel, 'booking-service');
  }

  async start() {
    await this.eventConsumer.subscribe(
      'booking-service.payment-events',
      ['payment.succeeded', 'payment.failed'],
      async (envelope) => {
        const { eventId, eventType, data } = envelope;

        await this.idempotency.process(eventId, eventType, async () => {
          logger.info({ eventId, eventType, bookingId: data.bookingId }, 'BookingService processing payment event');

          if (eventType === 'PaymentSucceeded' && data.bookingId) {
            await this.bookingService.confirmBooking(data.bookingId, {
              paymentId: data.paymentId,
            });
          } else if (eventType === 'PaymentFailed' && data.bookingId) {
            await this.bookingService.cancelBooking(data.bookingId, {
              cancellationReason: data.reason || 'Payment failed',
            });
          }
        });
      },
    );
  }
}
