# 10 - Distributed Saga Workflows & Orchestration

GetReady avoids two-phase commit (2PC) in favor of Choreography and Orchestration Sagas with compensating transactions.

## Booking & Payment Saga Flow

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant Gateway as API Gateway
    participant Booking as Booking Service
    participant Cart as Cart Service
    participant Payment as Payment Service
    participant Wallet as Wallet Service
    participant RabbitMQ as RabbitMQ
    participant Notif as Notification Service

    Customer->>Gateway: POST /api/v1/bookings (Checkout Cart)
    Gateway->>Booking: Create Booking Request
    Booking->>Booking: Acquire Slot Hold (Atomic Lock)
    Booking->>Booking: Save Booking & Outbox (Status: PENDING)
    Booking-->>Gateway: 201 Created (Booking ID, Order ID)
    Gateway-->>Customer: Booking Placed

    alt Payment Method: Razorpay Online Payment
        Customer->>Gateway: POST /api/v1/payments/verify
        Gateway->>Payment: Verify Payment Signature
        Payment->>Payment: Mark Payment SUCCESS
        Payment->>RabbitMQ: Publish PaymentSucceeded
        RabbitMQ->>Booking: Deliver PaymentSucceeded
        Booking->>Booking: Confirm Slot & Update Status CONFIRMED
        Booking->>RabbitMQ: Publish BookingConfirmed
        RabbitMQ->>Notif: Deliver BookingConfirmed
        Notif->>Customer: Dispatch In-App/Push Notification
    else Payment Failure / Timeout
        Payment->>Payment: Mark Payment FAILED
        Payment->>RabbitMQ: Publish PaymentFailed
        RabbitMQ->>Booking: Deliver PaymentFailed
        Booking->>Booking: Release Slot Hold & Mark CANCELLED
        Booking->>RabbitMQ: Publish BookingCancelled
        RabbitMQ->>Notif: Deliver BookingCancelled
        Notif->>Customer: Notify Payment Failed & Slot Released
    end
```
