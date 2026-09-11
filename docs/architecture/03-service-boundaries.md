# 03 - Service Boundaries & Bounded Contexts

Each microservice encapsulates a cohesive business domain with clear data and behavioral ownership.

| Microservice | Bounded Context | Owned Entities | Primary Responsibilities |
|---|---|---|---|
| **api-gateway** | Edge & Routing | None (Stateless) | Reverse proxy, token verification, rate limiting, request tracing, correlation headers. |
| **auth-service** | Identity & Session | RefreshToken, OTP, TokenBlacklist | User authentication, registration, phone OTP verification, JWT access/refresh token issuing. |
| **user-service** | User Profile & Access Control | User, Address, Member, Role, Permission | User profiles, delivery addresses, family members, RBAC roles and permissions management. |
| **beautician-service** | Beautician Domain | BeauticianProfile, BankDetail, Skill | Beautician profiles, skills registry, verification status, bank payout details. |
| **catalog-service** | Service Catalog | Category, Service, ServiceChangeRequest, Package, Filter, HygieneKit | Category hierarchy, salon services catalog, combo packages, hygiene kits, search filters. |
| **booking-service** | Appointments & Availability | Booking, SlotHold, Outbox | Appointment booking lifecycle, real-time slot inventory, concurrency locking, cancellation. |
| **cart-service** | Shopping Basket | Cart, CartItem, PricingEngine | Cart management, item quantity limits, multi-recipient booking, checkout pricing computation. |
| **payment-service** | Payment Processing | Payment, PaymentOrder, Idempotency | Razorpay order creation, payment signature verification, webhook processing, refund dispatch. |
| **wallet-service** | Digital Wallet & Loyalty | Wallet, WalletTransaction, LoyaltyRule, Idempotency | User wallet balances, transactional credit/debit ledger, loyalty reward points, cashbacks. |
| **notification-service** | User Communications | Notification, Idempotency | In-app notifications, FCM push notifications, SMS alerts, async event subscriptions. |
| **content-service** | CMS & Marketing | Banner, Blog | Home screen banners, deep links, promotional blogs, like counters, CMS articles. |
| **worker-service** | Background Jobs | OutboxPoller, DLQMonitor, SlotCleanup | Dead letter queue monitoring, expired slot hold cleanup, transactional outbox publishing. |
