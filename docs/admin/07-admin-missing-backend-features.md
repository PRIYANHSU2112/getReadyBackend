# 07 — Missing Backend Capabilities & Implementation Plan

## 1. Identified Backend Gaps & Enhancements

To fully support the enterprise Admin Control Center with zero fake data, the following dedicated administrative endpoints are implemented:

### A. Dashboard & Analytics Aggregations (`booking-service` & `payment-service`)
- **`GET /api/v1/bookings/analytics/dashboard`**: Single authoritative endpoint returning real MongoDB aggregated metrics (Gross revenue, total bookings, period comparisons, revenue chart points, category distribution, and average order value).
- **`GET /api/v1/bookings/operations/live`**: Real-time operational snapshot returning active booking queue states (`ASSIGNMENT_PENDING`, `STARTED`, `SERVICES_COMPLETED`, `ARRIVING`), online beautician counts, and infrastructure dependency statuses.

### B. Customer Profile & Beauty Passport Expansion (`user-service`)
- **`GET /api/v1/users/:id/profiles`**: Returns account owner record along with all registered sub-profiles (`Self`, `Mother`, `Sister`, etc.) and their respective Beauty Passport service histories.

### C. Global Search Aggregator (`api-gateway`)
- **`GET /api/v1/admin/global-search`**: Fast parallel search across Bookings (`#GR...`), Customers (phone/email/name), Beauticians, Services, and Payments.

---

## 2. Implementation Execution Plan

1. **Step 1: Backend Aggregation Endpoints**
   - Implement `BookingAnalyticsService` in `booking-service` for executive dashboard KPIs and operations center queue stats.
   - Implement `/api/v1/bookings/analytics/dashboard` and `/api/v1/bookings/operations/live`.
   - Implement Customer Profiles summary in `user-service`.
2. **Step 2: Admin Frontend API Layer (`Admin/src`)**
   - Configure `VITE_API_BASE_URL` to point to Gateway (`http://localhost:3000/api/v1`).
   - Enhance RTK Query endpoints for Bookings, Users, Beauticians, Catalog, Payments, Wallets, Settings, and Analytics.
3. **Step 3: Admin UI Screen Redesign & Real Integration**
   - Upgrade `DashboardPage` to consume live analytics API (remove `data.js` mock datasets).
   - Upgrade `BookingsListPage` and `BookingDetailPage` to support multi-customer profile breakdown, multi-beautician assignment drawer, OTP status badges, and fee waiver cancellation modal.
   - Upgrade `UsersListPage` with Beauty Passport viewer drawer.
   - Upgrade `BeauticiansListPage` with KYC approval and calendar availability management.
   - Upgrade `SettingsPage` to dynamically edit hygiene kit prices, upgrade difference thresholds, and instant service policies.
4. **Step 4: End-to-End Verification**
   - Validate live data retrieval and full control workflows across all admin pages.
