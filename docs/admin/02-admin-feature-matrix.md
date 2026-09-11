# 02 — Admin Feature Matrix

This matrix maps every administrative capability across UI screens, backend APIs, microservices, database owners, RBAC permissions, and auditing requirements.

| Admin Feature | Frontend Screen | API Endpoint | Microservice | Database Owner | Permission | Audit Required | Status |
|---|---|---|---|---|---|---|---|
| **Executive Dashboard & KPIs** | `/dashboard` | `GET /api/v1/bookings/analytics/dashboard` | `booking-service` / `payment-service` | `bookings`, `payments`, `users` | `dashboard:view` | No | Target (Real) |
| **Real-Time Operations Center** | `/operations` | `GET /api/v1/bookings/operations/live` | `booking-service` | `bookings`, `beautician_profiles` | `operations:view` | No | Target (Real) |
| **Booking List & Multi-Filter** | `/bookings` | `GET /api/v1/bookings` | `booking-service` | `bookings` | `bookings:view` | No | Implemented |
| **Multi-Customer Booking Detail** | `/bookings/:id` | `GET /api/v1/bookings/:id` | `booking-service` | `bookings` | `bookings:view` | No | Implemented |
| **Manual Beautician Assignment** | `/bookings/:id` (Drawer) | `POST /api/v1/bookings/:id/assign` | `booking-service` | `bookings` | `bookings:assign` | **Yes** (`ASSIGNMENT`) | Implemented |
| **Booking Cancellation & Waiver**| `/bookings/:id` | `POST /api/v1/bookings/:id/cancel` | `booking-service` | `bookings` | `bookings:cancel` | **Yes** (`CANCELLATION`) | Implemented |
| **Booking Settings & Policies** | `/settings/booking` | `GET/PATCH /api/v1/bookings/admin/settings` | `booking-service` | `booking_settings` | `settings:manage` | **Yes** (`SETTINGS_UPDATE`)| Implemented |
| **Customer List & Stats** | `/users` | `GET /api/v1/users` | `user-service` | `users` | `users:view` | No | Implemented |
| **Customer Profile & Family** | `/users/:id` | `GET /api/v1/users/:id/profiles` | `user-service` | `customer_profiles` | `users:view` | No | Implemented |
| **Beauty Passport Inspector** | `/users/:id/passport` | `GET /api/v1/customer-profiles/:id/beauty-passport` | `user-service` | `customer_profiles` | `users:view` | No | Implemented |
| **Beautician List & Verification**| `/beauticians` | `GET /api/v1/beautician-profiles` | `beautician-service` | `beautician_profiles` | `beauticians:view` | No | Implemented |
| **Beautician KYC Approval/Reject**| `/beauticians/:id` | `PATCH /api/v1/beautician-profiles/:id/status` | `beautician-service` | `beautician_profiles` | `beauticians:edit` | **Yes** (`BEAUTICIAN_STATUS`)| Implemented |
| **Beautician Availability Calendar**| `/beauticians/calendar`| `GET/PATCH /api/v1/beautician-profiles/:id/schedule`| `beautician-service` | `beautician_profiles` | `beauticians:edit` | No | Implemented |
| **Service Catalog Management** | `/services` | `GET/POST/PATCH /api/v1/services` | `catalog-service` | `services` | `services:manage` | **Yes** (`PRICE_CHANGE`) | Implemented |
| **Service Upgrade Rules** | `/services/upgrades` | `GET/PATCH /api/v1/bookings/admin/settings` | `booking-service` | `booking_settings` | `services:manage` | **Yes** (`UPGRADE_RULE`) | Implemented |
| **Category & Hierarchy Manager** | `/categories` | `GET/POST/PATCH /api/v1/categories` | `catalog-service` | `categories` | `categories:manage`| No | Implemented |
| **Package Bundles** | `/packages` | `GET/POST/PATCH /api/v1/packages` | `catalog-service` | `packages` | `packages:manage` | No | Implemented |
| **Hygiene Kit Configuration** | `/settings/hygiene-kit`| `GET/PATCH /api/v1/bookings/admin/settings` | `booking-service` | `booking_settings` | `settings:manage` | **Yes** (`HYGIENE_KIT`) | Implemented |
| **Membership Plans Management** | `/memberships` | `GET/POST/PATCH /api/v1/catalog/memberships` | `catalog-service` | `memberships` | `memberships:manage`| **Yes** (`MEMBERSHIP_RULE`)| Implemented |
| **Coupon Code Lifecycle** | `/coupons` | `GET/POST/PATCH /api/v1/catalog/coupons` | `catalog-service` | `coupons` | `coupons:manage` | **Yes** (`COUPON_CREATE`) | Implemented |
| **Payment Orders & Transactions**| `/payments` | `GET /api/v1/payments` | `payment-service` | `payments` | `payments:view` | No | Implemented |
| **Payment Refund Processing** | `/payments/:id/refund` | `POST /api/v1/payments/:id/refund` | `payment-service` | `payments` | `payments:refund` | **Yes** (`REFUND_ISSUED`)| Implemented |
| **Customer Wallets & Balances** | `/wallets` | `GET /api/v1/wallets` | `wallet-service` | `wallets` | `wallets:view` | No | Implemented |
| **Admin Wallet Balance Adjust** | `/wallets/:id/adjust` | `POST /api/v1/wallet/adjust` | `wallet-service` | `wallets`, `wallet_txns` | `wallets:adjust` | **Yes** (`WALLET_ADJUST`)| Implemented |
| **Loyalty & Cashback Rules** | `/settings/rewards` | `GET/PATCH /api/v1/bookings/admin/settings` | `booking-service` | `booking_settings` | `settings:manage` | **Yes** (`REWARD_RULES`) | Implemented |
| **Marketing Banners** | `/banners` | `GET/POST/PATCH /api/v1/banners` | `content-service` | `banners` | `banners:manage` | No | Implemented |
| **CMS Pages & Blog Posts** | `/cms`, `/cms/blogs` | `GET/POST/PATCH /api/v1/blogs`, `/content` | `content-service` | `blogs`, `cms_pages` | `cms:manage` | No | Implemented |
| **Push Notification Campaigns** | `/notifications` | `POST /api/v1/notifications/broadcast` | `notification-service`| `notifications` | `notifications:manage`| **Yes** (`BROADCAST`) | Implemented |
| **Support Tickets & Resolution** | `/support` | `GET/PATCH /api/v1/support/tickets` | `user-service` | `tickets` | `support:manage` | No | Target |
| **Role-Based Access Control** | `/roles` | `GET/POST/PATCH /api/v1/roles` | `user-service` | `roles`, `permissions` | `roles:manage` | **Yes** (`RBAC_CHANGE`) | Implemented |
| **System Observability & Health**| `/system/health` | `GET /health`, `/metrics` via Gateway | `api-gateway` | Prometheus / Loki / RabbitMQ | `system:view` | No | Target |
