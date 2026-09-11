# 06 — Admin Information Architecture & UX Structure

## 1. Global Layout Shell

```
+-----------------------------------------------------------------------------------------------+
|  GET READY Admin Control Center   |  [ Global Search ⌘K ]  |  [+ Quick Create]  (Health)  [User] |
+-----------------------+-----------------------------------------------------------------------+
| OVERVIEW              |  Breadcrumbs: Operations > Bookings > #GR10001                        |
|  - Dashboard          +-----------------------------------------------------------------------+
|  - Operations Center  |                                                                       |
|                       |  [ KPI Cards ] (Revenue, Bookings, Active Beauticians, Queue)         |
| ANALYTICS             |                                                                       |
|  - Business Analytics |  [ Multi-Filter Bar: Status | Payment | Beautician | Date Range ]     |
|  - User Analytics     |                                                                       |
|  - Beautician Metrics |  +-----------------------------------------------------------------+  |
|                       |  | DATA TABLE                                                      |  |
| OPERATIONS            |  | [x] Booking ID | Customer (Profiles) | Beauticians | Total | St |  |
|  - Bookings           |  | [x] #GR10001   | Naveen (Self, Mother)| Pooja, Anjali| ₹3045 | ...|  |
|  - Slots & Schedule   |  +-----------------------------------------------------------------+  |
|  - Customers          |                                                                       |
|  - Beauticians        |  [ Pagination Controls: Page 1 of 48 (50 per page) ]                 |
|                       +-----------------------------------------------------------------------+
| CATALOG               |  RIGHT DRAWER (On Row Click):                                         |
|  - Services           |  - Booking Detail Dossier                                             |
|  - Categories         |  - Multi-Customer Profile Breakdown & Allergies                       |
|  - Packages           |  - Beautician Allocation & Live Reassignment Matrix                   |
|                       |  - OTP Status & Timeline Audit Trail                                  |
| FINANCE               |  - Cancellation & Fee Waiver Controls                                 |
|  - Payments & Refunds +-----------------------------------------------------------------------+
|  - Wallets & Credits  |
|  - Reports Center     |
|                       |
| GROWTH & CONTENT      |
|  - Coupons & Rewards  |
|  - Marketing Banners  |
|  - CMS & Blogs        |
|  - Notifications      |
|                       |
| SYSTEM                |
|  - Roles & RBAC       |
|  - Audit Logs         |
|  - Settings & Rules   |
|  - System Health      |
+-----------------------+
```

---

## 2. Interaction Guidelines

1. **Information Density**: High-utility data tables with customizable columns, sticky headers, and quick-filter chips.
2. **Right-Side Slide-Over Drawers**: For inspecting item details, beautician assignments, customer Beauty Passports, or quick KYC approvals without losing table filter context.
3. **Audit Confirmation Dialogs**: Every destructive or financial action (e.g. Wallet balance adjustment, Refund issue, Cancellation fee waiver, KYC rejection) requires a mandatory reason input and displays old/new state impact.
4. **Instant State Synchronization**: Connected to live RTK Query endpoints with automatic cache invalidation (`providesTags` & `invalidatesTags`).
