import { describe, it, expect } from '@jest/globals';
import { AppError, ValidationError, NotFoundError, HttpStatus, ErrorCodes } from '@getready/errors';
import { generateCorrelationId, getTraceContext, runWithTraceContext } from '@getready/tracing';
import { createEventEnvelope } from '@getready/rabbitmq';

describe('Shared Packages Test Suite', () => {
  describe('@getready/errors', () => {
    it('should create AppError with proper defaults', () => {
      const err = new AppError('Something went wrong', HttpStatus.BAD_REQUEST, ErrorCodes.BAD_REQUEST);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('BAD_REQUEST');
      expect(err.isOperational).toBe(true);
    });

    it('should format ValidationError correctly', () => {
      const err = new ValidationError('Invalid input', [{ field: 'email', message: 'required' }]);
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(err.details).toHaveLength(1);
    });

    it('should construct NotFoundError with 404', () => {
      const err = new NotFoundError('Resource not found');
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe(ErrorCodes.NOT_FOUND);
    });
  });

  describe('@getready/tracing', () => {
    it('should generate valid UUID correlation ID', () => {
      const id = generateCorrelationId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(10);
    });

    it('should maintain trace context in AsyncLocalStorage', async () => {
      const context = { correlationId: 'test-corr-123', requestId: 'test-req-456' };
      await runWithTraceContext(context, async () => {
        const current = getTraceContext();
        expect(current.correlationId).toBe('test-corr-123');
        expect(current.requestId).toBe('test-req-456');
      });
    });
  });

  describe('@getready/rabbitmq event envelope', () => {
    it('should generate standard versioned event envelope', () => {
      const envelope = createEventEnvelope({
        eventType: 'BookingCreated',
        producer: 'booking-service',
        aggregateId: 'book_123',
        data: { bookingId: 'book_123', totalAmount: 999 },
      });

      expect(envelope.eventType).toBe('BookingCreated');
      expect(envelope.producer).toBe('booking-service');
      expect(envelope.aggregateId).toBe('book_123');
      expect(envelope.eventVersion).toBe(1);
      expect(envelope.data.totalAmount).toBe(999);
      expect(envelope.eventId).toBeDefined();
      expect(envelope.occurredAt).toBeDefined();
    });
  });
});
