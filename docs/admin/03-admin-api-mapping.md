# 03 — Admin API Mapping & Gateway Specification

All Admin requests flow securely through **API Gateway** (`http://localhost:3000/api/v1/*` or `http://localhost:8080/api/v1/*`).

---

## 1. Authentication & Session APIs (`/api/v1/auth`)

| Method | Endpoint | Description | Request Payload | Response |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/admin/login` | Admin Email + Password Login | `{ email, password }` | `{ token, refreshToken, user, permissions }` |
| `POST` | `/api/v1/auth/refresh` | Rotate JWT Access Token | `{ refreshToken }` | `{ token, refreshToken }` |
| `POST` | `/api/v1/auth/logout` | Revoke Admin Session | `{ refreshToken }` | `{ success: true }` |

---

## 2. Booking Management APIs (`/api/v1/bookings`)

| Method | Endpoint | Description | Request Payload | Response |
|---|---|---|---|---|
| `GET` | `/api/v1/bookings` | Paginated booking list with multi-parameter filtering (`status`, `paymentStatus`, `beauticianId`, `startDate`, `endDate`, `search`, `page`, `limit`) | Query parameters | `{ items: Booking[], meta: { total, page, limit, totalPages } }` |
| `GET` | `/api/v1/bookings/:id` | Full booking document with participants, items, beautician assignments, OTP status, pricing breakdown, and status timeline | None | `{ success: true, data: Booking }` |
| `POST` | `/api/v1/bookings/:id/assign` | Admin manual assignment or reassignment of beauticians | `{ assignments: [{ beauticianId, beauticianName, assignedItemIds }] }` | `{ success: true, data: Booking }` |
| `POST` | `/api/v1/bookings/:id/cancel` | Cancel booking with policy calculation and optional waiver | `{ reason, isDelayed }` | `{ success: true, data: Booking }` |
| `GET` | `/api/v1/bookings/admin/settings` | Read live booking, pricing, hygiene kit, and multi-beautician runtime settings | None | `{ success: true, data: BookingSettings }` |
| `PATCH` | `/api/v1/bookings/admin/settings` | Update live runtime settings (instantly updates client checkout behavior) | `{ multipleBeauticianEnabled, maxBeauticiansPerBooking, hygieneKitPrice, minUpgradeDifference, maxUpgradeDifference, ... }` | `{ success: true, data: BookingSettings }` |

---

## 3. Customer & Profile Management APIs (`/api/v1/users`, `/customer-profiles`)

| Method | Endpoint | Description | Request Payload | Response |
|---|---|---|---|---|
| `GET` | `/api/v1/users` | List registered accounts with spending, membership status, and registration date | Query parameters (`search`, `isMember`, `page`, `limit`) | `{ items: User[], meta: { total, page, limit } }` |
| `GET` | `/api/v1/users/:id` | User account summary & linked customer profiles | None | `{ success: true, data: { user, profiles } }` |
| `GET` | `/api/v1/customer-profiles/:id/beauty-passport` | Retrieve customer profile Beauty Passport and treatment history | None | `{ success: true, data: { profile, beautyPassport } }` |

---

## 4. Beautician Management APIs (`/api/v1/beautician-profiles`)

| Method | Endpoint | Description | Request Payload | Response |
|---|---|---|---|---|
| `GET` | `/api/v1/beautician-profiles` | List beauticians with real-time status (`isOnline`, `isAvailable`, `status`), ratings, and skills | Query params (`status`, `isOnline`, `search`) | `{ items: Beautician[], meta: { total, page, limit } }` |
| `GET` | `/api/v1/beautician-profiles/:id` | Comprehensive beautician dossier (KYC, bank details, skills, calendar) | None | `{ success: true, data: BeauticianDetail }` |
| `PATCH` | `/api/v1/beautician-profiles/:id/status` | Approve, reject, or suspend a beautician | `{ status: 'APPROVED' | 'REJECTED' | 'SUSPENDED', notes }` | `{ success: true, data: Beautician }` |
| `GET` | `/api/v1/beautician-profiles/:id/schedule`| Retrieve calendar availability, slots, and leaves | Query params (`month`, `year`) | `{ success: true, data: Schedule }` |

---

## 5. Catalog, Services & Packages APIs (`/api/v1/catalog/*`)

| Method | Endpoint | Description | Request Payload | Response |
|---|---|---|---|---|
| `GET` | `/api/v1/services` | List all services with category, pricing, duration, and upgrade flags | Query params (`categoryId`, `status`, `search`) | `{ items: Service[], meta }` |
| `POST` | `/api/v1/services` | Create new beauty service | `{ name, categoryId, basePrice, durationMinutes, description, ... }` | `{ success: true, data: Service }` |
| `PATCH` | `/api/v1/services/:id` | Edit price, description, duration, or active status | Partial Service fields | `{ success: true, data: Service }` |
| `GET` | `/api/v1/categories` | List hierarchical categories | Query params | `{ items: Category[] }` |
| `POST` | `/api/v1/categories` | Create service category | `{ name, slug, icon, displayOrder }` | `{ success: true, data: Category }` |
| `GET` | `/api/v1/packages` | List package bundles | Query params | `{ items: Package[] }` |

---

## 6. Financial & Wallet Control APIs (`/api/v1/payments`, `/api/v1/wallets`)

| Method | Endpoint | Description | Request Payload | Response |
|---|---|---|---|---|
| `GET` | `/api/v1/payments` | List payment transactions with Razorpay ID, booking ID, amount, and status | Query params (`status`, `paymentMethod`, `date`) | `{ items: Payment[], meta }` |
| `POST` | `/api/v1/payments/:id/refund` | Trigger gateway refund for a payment order | `{ amount, reason }` | `{ success: true, data: RefundResult }` |
| `GET` | `/api/v1/wallets` | List customer wallets, balances, and points | Query params (`search`, `minBalance`) | `{ items: Wallet[], meta }` |
| `POST` | `/api/v1/wallet/adjust` | Manual credit/debit with mandatory audit reason | `{ userId, amount, type: 'CREDIT'|'DEBIT', reason, referenceId }` | `{ success: true, data: Transaction }` |

---

## 7. Content, Marketing & Notification APIs (`/api/v1/content`, `/api/v1/notifications`)

| Method | Endpoint | Description | Request Payload | Response |
|---|---|---|---|---|
| `GET` | `/api/v1/banners` | List banners by target platform (`CUSTOMER_APP`, `BEAUTICIAN_APP`, `WEBSITE`) | Query params (`platform`, `status`) | `{ items: Banner[] }` |
| `POST` | `/api/v1/banners` | Create marketing banner | Multipart form data / JSON | `{ success: true, data: Banner }` |
| `POST` | `/api/v1/notifications/broadcast` | Send targeted push / SMS broadcast to customer segments | `{ title, body, segment: 'ALL' | 'MEMBERS' | 'INACTIVE', channels }` | `{ success: true, queuedCount: number }` |
