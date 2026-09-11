# 07 - RabbitMQ Event Schemas & Catalog

Every RabbitMQ message complies with a standardized, versioned envelope:

```json
{
  "eventId": "c1f7b0a8-45e2-4b2a-89a1-02948b812345",
  "eventType": "BookingCreated",
  "eventVersion": 1,
  "occurredAt": "2026-09-10T14:30:00.000Z",
  "producer": "booking-service",
  "correlationId": "4a761e38-98e1-48bf-a7de-5895781a8123",
  "causationId": "4a761e38-98e1-48bf-a7de-5895781a8123",
  "aggregateId": "65fc8e129182a1048b111222",
  "data": {
    "bookingId": "65fc8e129182a1048b111222",
    "userId": "65fc8e129182a1048b111000",
    "bookingDate": "2026-09-15",
    "totalAmount": 1499,
    "payableAmount": 1499
  }
}
```

## Domain Event Catalog

| Event Name | Producer Service | Consumer Services | Description |
|---|---|---|---|
| `UserRegistered` | `auth-service` | `notification-service` | Emitted on new user registration or first OTP login. |
| `UserUpdated` | `user-service` | `notification-service` | Emitted when user profile details change. |
| `BookingCreated` | `booking-service` | `notification-service`, `worker-service` | Emitted when booking order is created and slot reserved. |
| `BookingConfirmed` | `booking-service` | `notification-service` | Emitted upon payment confirmation or cash-on-delivery approval. |
| `BookingCancelled` | `booking-service` | `wallet-service`, `notification-service` | Emitted on cancellation; triggers slot release and wallet refund. |
| `BookingCompleted` | `booking-service` | `wallet-service`, `notification-service` | Emitted on completion; triggers loyalty reward point accrual. |
| `PaymentInitiated` | `payment-service` | `worker-service` | Emitted when payment order is created. |
| `PaymentSucceeded` | `payment-service` | `booking-service`, `wallet-service`, `notification-service` | Emitted when payment verification succeeds. |
| `PaymentFailed` | `payment-service` | `booking-service`, `notification-service` | Emitted on payment failure or timeout. |
| `PaymentRefunded` | `payment-service` | `wallet-service`, `notification-service` | Emitted when payment is refunded. |
| `WalletCredited` | `wallet-service` | `notification-service` | Emitted when customer wallet is credited. |
| `WalletDebited` | `wallet-service` | `notification-service` | Emitted when customer wallet is debited. |
