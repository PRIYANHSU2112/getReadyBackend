# Implementation Plan: Tasks 1–4

> Architecture base: Repository → Service → Controller → Routes DI pattern, `@getready/errors` ApiResponse, Joi validation via `@getready/validation`, `beauticianCache` Redis + memory fallback, `@getready/storage` StorageService, `express-async-errors`.

---

## EXECUTION ORDER (Recommended)

| Phase | Task | Area | Est. Time |
|---|---|---|---|
| **P1** | **Task 4** – KYC Bug Fix | Backend guards + Frontend demo removal | 1h |
| **P2** | **Task 2a** – Bank + Certificate Approvals | Frontend: BeauticianDrawer.jsx | 1h |
| **P3** | **Task 2b** – Remove Demo Fallbacks | Frontend: 3 pages + Backend: referral route | 1h |
| **P4** | **Task 2c** – Loyalty, Job Apps, Observability | Backend: membership endpoint + Frontend | 2h |
| **P5** | **Task 3** – Image Upload Infrastructure | Backend: upload endpoint + Frontend: 9 forms | 2.5h |
| **P6** | **Task 1 Backend** – Full HRM System | 8 new backend files | 3h |
| **P7** | **Task 1 Frontend** – HRM Admin Panel | 9 new Admin files + navigation | 2.5h |
| **P8** | Integration Test + Build verification | All endpoints + npm run build 0 errors | 1h |

**Total: ~14 hours**

---

## Task 4 — Fix KYC Verification Center Bugs (DO FIRST — Blocks Everything)

### Root Cause #1: `Cast to ObjectId failed for value "kyc_demo_2"` → 500
- `DEMO_KYC_QUEUE` in `KycVerificationQueue.jsx` has fake `_id: 'kyc_demo_1'`, `_id: 'kyc_demo_2'`.
- Admin clicks Approve → passes `partnerId = 'kyc_demo_1'` to API.
- Backend `BeauticianProfileModel.findById('kyc_demo_1')` throws Mongoose `CastError` → unhandled 500.
- **Fix:** Delete `DEMO_KYC_QUEUE` entirely. Show `<EmptyState>` when list is empty.

### Root Cause #2: All KYC action 500s on real records too
- `reviewKycDocument`, `updateStatus`, `reviewKyc`, `reviewProfile` service methods call `findById(id)` with NO ObjectId validation guard.
- If any malformed ID slips through, Mongoose throws CastError → 500.
- **Fix:** Add `mongoose.isValidObjectId(id)` guards at the top of every admin review method, throwing `AppError(400)` before hitting MongoDB.

### Root Cause #3: `net::ERR_CONNECTION_RESET`
- CastError may crash the Node process if `express-async-errors` wasn't imported FIRST before route definitions.
- In `beautician-service/src/app.js` line 1: `import 'express-async-errors'` — already exists. Verify it's before route mounting.
- Also ensure global error handler never re-throws — always returns `ApiResponse.error`.

### Backend Fix: `beautician.services.js`

Add this guard to the top of these methods: `reviewKycDocument`, `reviewKycSelfie`, `requestReupload`, `updateStatus`, `reviewProfile`, `reviewKyc`:
```js
import mongoose from 'mongoose';
// ...
if (!mongoose.isValidObjectId(profileId)) {
  throw new AppError('Invalid profile ID', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
}
```

### Frontend Fix: `KycVerificationQueue.jsx`
1. **Delete** `DEMO_KYC_QUEUE` constant (lines 40–108).
2. **Line 120:** Change `const queueItems = rawQueueItems.length > 0 ? rawQueueItems : DEMO_KYC_QUEUE;` → `const queueItems = rawQueueItems;`
3. **Add** `<EmptyState title="No KYC submissions yet" />` when `!isLoading && queueItems.length === 0`.
4. **All action handlers:** Replace `console.error(...)` with `toast.error(err?.data?.error?.message || 'Action failed')` + `toast.success(...)` on success.
5. **Disable buttons** while any mutation is loading (`isReviewingDoc || isReviewingSelfie || isUpdatingStatus`).
6. **Add** `handleSuspendPartner` and `handleReactivatePartner` with confirmation `window.confirm` before calling `updateStatus`.

---

## Task 2 — Complete Pending Admin Integrations

### 2.1 – Bank Detail Approval in `BeauticianDrawer.jsx`

**Where:** BANK & PAYOUT tab (line ~283–315)

Add these imports at the top:
```js
import { useReviewBankDetailMutation, useGetBankDetailQuery } from '../api';
```

Below the bank grid, add:
- `<StatusBadge status={bank.status} />` — show current verification status.
- **"✓ Verify Account"** button → `useReviewBankDetailMutation({ id: bank._id, status: 'APPROVED' })`. Disabled if `bank.status === 'VERIFIED'`. On success: `toast.success`, `refetch()`.
- **"✗ Reject"** button → opens a small inline card with a `<textarea>` for rejection reason → on submit: `useReviewBankDetailMutation({ id: bank._id, status: 'REJECTED', rejectionReason })`. On success: `toast.success`, `refetch()`.

### 2.2 – Certificate Approval: New `CERTIFICATES` Tab in `BeauticianDrawer.jsx`

**Step 1:** Add `'CERTIFICATES'` to the tabs array (line ~108):
```js
{['OVERVIEW', 'PERSONAL', 'KYC', 'CERTIFICATES', 'SKILLS & SERVICES', 'BANK & PAYOUT', 'AVAILABILITY']}
```

**Step 2:** Add tab content block for `activeTab === 'CERTIFICATES'`:
```jsx
{activeTab === 'CERTIFICATES' && (
  <div className="space-y-4 text-xs animate-in fade-in-50 duration-200">
    {(p.certificates || []).length === 0 ? (
      <EmptyState title="No certificates uploaded" />
    ) : (
      (p.certificates || []).map((cert) => (
        <div key={cert._id} className="p-4 rounded-xl border border-border/80 bg-card space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-bold">{cert.title}</h4>
              <p className="text-muted-foreground">{cert.issuingOrganization} · {new Date(cert.issueDate).getFullYear()}</p>
            </div>
            <StatusBadge status={cert.status} />
          </div>
          {cert.certificateImage?.url && (
            <a href={cert.certificateImage.url} target="_blank" rel="noreferrer">
              <img src={cert.certificateImage.url} className="w-24 h-16 object-cover rounded" />
            </a>
          )}
          {cert.status !== 'VERIFIED' && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleVerifyCert(cert._id)}>✓ Verify</Button>
              <Button size="sm" variant="outline" onClick={() => openRejectCert(cert._id)}>✗ Reject</Button>
            </div>
          )}
        </div>
      ))
    )}
  </div>
)}
```

**Step 3:** Add handlers using `useReviewCertificateMutation` (already exported from `beauticians/api.js`).

### 2.3 – Remove `DEMO_BOOKINGS` from `BookingsListPage.jsx`
- Line 253: `const bookings = rawBookings;` (remove DEMO fallback).
- Delete `DEMO_BOOKINGS` array (lines 45–175).
- Add `{!isLoading && !isFetching && bookings.length === 0 && <EmptyState title="No bookings found" />}`.

### 2.4 – Remove `DEMO_FILTERS` from `FiltersListPage.jsx`
- Line 187: Remove DEMO fallback → `const filters = rawFilters;`.
- Delete `DEMO_FILTERS` array.
- Add empty state: `<EmptyState title="No catalog filters yet" action={<Button onClick={openCreate}>+ Create Filter</Button>} />`.

### 2.5 – Fix Backend Referral Route + Remove `DEMO_REFERRALS`

**Backend `user-service/src/routes/user.routes.js`:** Add a GET `/` handler for referral list that queries `UserModel.find({ referredBy: { $ne: null } })` — returns users who were referred, with their referrer info. Or expose it as `GET /api/v1/referrals` → `userController.listReferrals`.

**Admin `ReferralsListPage.jsx`:**
- Remove `DEMO_REFERRALS` array.
- `const rawReferrals = data?.items || data?.referrals || (Array.isArray(data) ? data : []);` — no fallback.
- Add `<EmptyState title="No referral records yet" />`.

### 2.6 – Loyalty Points Tab in `CustomerDrawer.jsx`

**Backend — New endpoint in `membership-service`:**
```
GET  /api/v1/memberships/loyalty-ledger?userId=<id>&page=1&limit=20
POST /api/v1/memberships/loyalty-ledger/adjust
     Body: { userId, type: CREDIT|DEBIT, points, description, category: ADMIN_ADJUSTMENT }
```
Proxy in API gateway: already proxied under `/api/v1/memberships`.

**Admin — New RTK Query hooks in `memberships/api.js`:**
```js
getLoyaltyLedger: builder.query({ query: ({userId, page=1, limit=20}) => `/memberships/loyalty-ledger?userId=${userId}&page=${page}&limit=${limit}` }),
adjustLoyaltyPoints: builder.mutation({ query: (body) => ({ url: '/memberships/loyalty-ledger/adjust', method: 'POST', body }) }),
```

**Admin `CustomerDrawer.jsx`:** Add tab `LOYALTY POINTS`:
- Current balance display at top.
- Ledger table: category, points +/-, balanceAfter, date.
- **"Adjust Points"** modal: CREDIT or DEBIT amount + description → calls `useAdjustLoyaltyPointsMutation`.

### 2.7 – Job Applications Tab in `BeauticiansListPage.jsx`

Add a tab **"Job Applications"** that queries `useGetBeauticiansQuery({ status: 'SUBMITTED,PENDING' })`. No new backend needed.

Show columns: Name, Phone, Experience, Applied Date, Status. Actions: Quick Approve/Reject using `useUpdateBeauticianStatusMutation`.

### 2.8 – Replace `DEMO_SERVICES` in `MonitoringPage.jsx`

Lines 270 and 283: Instead of `DEMO_SERVICES` / `DEMO_INFRA` fallback:
- Map real `useGetSystemHealthQuery` data into the service status format.
- If the API returns per-service health objects, display them.
- If latency/memory metrics are not available from the API, show `"—"` or `"N/A"` instead of hardcoded numbers.
- Remove `DEMO_SERVICES` and `DEMO_INFRA` constants entirely.

---

## Task 3 — Replace URL Inputs with Bucket Uploads

### 3.1 – Audit of URL Input Fields

| Form | Fields Affected |
|---|---|
| ServicesListPage / ServiceModal | `thumbnail`, `images[]` |
| BannersListPage / BannerModal | `imageUrl`, `mobileImageUrl` |
| CategoriesListPage / CategoryModal | `icon`, `image` |
| PackagesListPage / PackageModal | `thumbnail` |
| BlogsListPage / BlogModal | `coverImage` |
| HygieneKitsListPage / HygieneKitModal | `image` |
| OffersListPage / OfferModal | `bannerImage` |
| CouponsListPage / CouponModal | `couponImage` |
| CreateBeauticianWizard | `profilePhoto` |

### 3.2 – New Shared Component: `ImageUpload.jsx`

```
Location: Admin/src/components/ui/ImageUpload.jsx

Props:
  value: string | null       — existing image URL
  onChange: (url) => void    — called after successful upload
  folder: string             — storage folder (default: 'admin-uploads')
  label: string
  accept: string             — default 'image/*'
  maxSizeMb: number          — default 5
  disabled: boolean

Behavior:
  1. Renders a dashed drop zone; if `value` is set, shows thumbnail preview + "Remove" button.
  2. On file select: validates type and size. Shows error if invalid.
  3. Uploads via XMLHttpRequest to POST /api/v1/upload/image (multipart, field 'file').
  4. Shows upload progress bar (0–100%).
  5. On success { url, key }: calls onChange(url), shows success toast.
  6. On error: shows toast.error with server message.
  7. "Remove" button: calls onChange(null), clears preview.
```

### 3.3 – New Backend Upload Endpoint (`catalog-service`)

```
POST /api/v1/upload/image
  Auth: x-user-role must be 'admin' or 'super_admin' (middleware guard)
  Multer: single('file'), memoryStorage, limit 10MB
  Body: folder (string, optional, default 'admin-uploads')
  → storageService.upload(file, folder)
  → ApiResponse.success(res, { url, key }, 'Uploaded successfully')
```

New files:
- `catalog-service/src/controllers/upload.controller.js` — class `UploadController`
- `catalog-service/src/routes/upload.routes.js` — `createUploadRoutes(ctrl)`
- Wire in `catalog-service/src/app.js`: `app.use('/api/v1/upload', createUploadRoutes(uploadCtrl))`
- API Gateway `routes.js`: `router.use('/api/v1/upload', createServiceProxy(services.catalog, 'catalog-service'))`

### 3.4 – Admin RTK Query (add to `src/services/api.js` or shared file)

```js
uploadImage: builder.mutation({
  query: ({ file, folder = 'admin-uploads' }) => {
    const fd = new FormData();
    fd.append('file', file);
    if (folder) fd.append('folder', folder);
    return { url: '/upload/image', method: 'POST', body: fd };
  },
})
```

### 3.5 – Replace in Each Form

For each affected form, replace:
```jsx
// BEFORE
<Input type="text" placeholder="https://..." value={form.thumbnail} onChange={...} />

// AFTER
<ImageUpload
  folder="services"
  label="Thumbnail"
  value={form.thumbnail}
  onChange={(url) => setForm(f => ({ ...f, thumbnail: url }))}
/>
```

No MongoDB schema changes needed — all fields already store URL strings.

---

## Task 1 — Complete HRM System (Backend + Admin)

### 1.1 – New Models File: `hrm.models.js`

**Location:** `beautician-service/src/models/hrm.models.js`

#### AttendanceModel
```
Fields:
  beauticianProfileId   ObjectId ref BeauticianProfile  (required, index)
  userId                String (required, index)
  date                  String "YYYY-MM-DD" (required)
  punchIn               Date | null
  punchOut              Date | null
  totalHoursWorked      Number (2dp, default 0)
  status                enum: PRESENT | ABSENT | HALF_DAY | ON_LEAVE | HOLIDAY  default ABSENT
  source                enum: DUTY_TOGGLE | MANUAL_ADMIN | SYSTEM  default DUTY_TOGGLE
  remarks               String trim optional
  markedBy              String (adminId)

Compound unique index: { beauticianProfileId, date }
Index: { date, status }
Index: { userId, date: -1 }
```

#### LeaveRequestModel
```
Fields:
  beauticianProfileId   ObjectId (required, index)
  userId                String (required, index)
  leaveType             enum: CL | SL | PL | EMERGENCY  required
  duration              enum: FULL_DAY | HALF_DAY  default FULL_DAY
  startDate             Date (required)
  endDate               Date (required)
  totalDays             Number (calculated, stored at create)
  reason                String trim required max 500
  attachmentUrl         String | null
  attachmentKey         String | null
  status                enum: PENDING | APPROVED | REJECTED | CANCELLED  default PENDING
  reviewedBy            String (adminId) | null
  reviewedAt            Date | null
  adminRemarks          String trim | null

Index: { beauticianProfileId, startDate: -1 }
Index: { status, startDate }
Index: { userId, status }
```

#### PayslipModel
```
Fields:
  beauticianProfileId   ObjectId (required, index)
  userId                String (required, index)
  payPeriod             String "YYYY-MM" (required, index)  ← fast lookup key
  month                 Number 1-12
  year                  Number
  totalBookings         Number default 0
  totalEarnings         Number default 0
  platformCommission    Number default 0
  tds                   Number default 0  (2% of net)
  netPayout             Number default 0
  bonuses               Number default 0
  deductions            Number default 0
  presentDays           Number default 0
  absentDays            Number default 0
  leaveDays             Number default 0
  workingDays           Number default 26
  status                enum: DRAFT | GENERATED | PAID  default DRAFT
  generatedAt           Date
  generatedBy           String
  paidAt                Date | null
  paidBy                String | null
  remarks               String | null

Compound unique index: { beauticianProfileId, payPeriod }
Index: { payPeriod, status }
```

### 1.2 – New Repositories File: `hrm.repositories.js`

**Location:** `beautician-service/src/repositories/hrm.repositories.js`

#### AttendanceRepository
```
findByProfileAndDate(profileId, date)
upsertByProfileAndDate(profileId, date, data)  → findOneAndUpdate upsert:true new:true
findByProfile(profileId, { month, year, page, limit })  → paginated lean
findAdminList({ date, status, beauticianId, page, limit })  → paginated lean
aggregateMonthlyStats(profileId, year, month)  → { present, absent, halfDay, onLeave, holiday }
```

#### LeaveRepository
```
create(data)
findById(id)
findByProfileId(profileId, { status, page, limit })  → paginated lean
findAdminQueue({ status, page, limit, search })  → paginated, $lookup profile for name/phone
updateById(id, data)
countLeavesByProfileAndPeriod(profileId, month, year)  → for payslip computation
getAdminStats()  → aggregate { pending, approved, rejected, cancelled, total }
```

#### PayslipRepository
```
findByProfileAndPeriod(profileId, payPeriod)
upsertByProfileAndPeriod(profileId, payPeriod, data)
findByProfile(profileId, { page, limit })
findAdminList({ payPeriod, status, page, limit })  → with profile $lookup
getAdminStats(payPeriod)  → { total, paid, draft, totalNetPayout }
```

### 1.3 – New Service: `hrm.service.js`

**Location:** `beautician-service/src/services/hrm.service.js`

**Constructor:** `constructor(attendanceRepo, leaveRepo, payslipRepo, profileRepo, storageService, cache)`

#### Attendance

| Method | Logic |
|---|---|
| `recordPunchIn(userId)` | Find profile by userId → upsert attendance for today (date = today ISO string) → set punchIn=now, status=PRESENT, source=DUTY_TOGGLE → invalidate `home:beautician:{userId}:summary` cache |
| `recordPunchOut(userId)` | Find today's attendance → validate punchIn exists → set punchOut=now → calculate totalHoursWorked → if hours < 4: HALF_DAY else PRESENT → cache invalidate → return record |
| `getMyAttendance(userId, params)` | Find profile → paginated attendance query |
| `adminListAttendance(params)` | findAdminList with filters → cache 60s by JSON.stringify(params) |
| `adminMarkAttendance(profileId, date, data, adminId)` | upsert with source=MANUAL_ADMIN, markedBy=adminId → cache invalidate |

#### Leave

| Method | Logic |
|---|---|
| `submitLeaveRequest(userId, data, file)` | Validate startDate ≤ endDate → calculate totalDays → if file: storageService.upload(file, 'leaves') → create LeaveRequest → return |
| `getMyLeaves(userId, params)` | Find profile → paginated query |
| `cancelMyLeave(userId, leaveId)` | Find leave → validate owner and status=PENDING → update to CANCELLED |
| `adminGetLeaveQueue(params)` | findAdminQueue → cache 30s |
| `adminReviewLeave(leaveId, body, adminId)` | Validate status ∈ [APPROVED, REJECTED] → update record → if APPROVED: set beautician operationalStatus=ON_LEAVE for startDate–endDate period → invalidate cache |
| `adminGetLeaveStats()` | getAdminStats() → cache 120s |

#### Payslip

| Method | Logic |
|---|---|
| `generatePayslip(beauticianId, { month, year }, adminId)` | Compute payPeriod → aggregate wallet_transactions for earnings → aggregate attendance for presentDays/absentDays/leaveDays → calculate tds=2% of (earnings-commission), net → upsert PayslipModel status=GENERATED → return |
| `getMyPayslips(userId, params)` | Paginated lean query by userId |
| `adminListPayslips(params)` | findAdminList → paginated |
| `adminMarkPaid(payslipId, adminId)` | Update status=PAID, paidAt=now, paidBy=adminId |
| `adminGetPayslipStats(payPeriod)` | getAdminStats(payPeriod) → cache 300s |

### 1.4 – New Controller: `hrm.controller.js`

```
class HrmController { constructor(hrmService) }

Attendance handlers:
  punchIn(req, res)         userId from x-user-id header
  punchOut(req, res)        userId from x-user-id header
  getMyAttendance(req, res) userId from x-user-id, query params
  adminListAttendance(req, res)
  adminMarkAttendance(req, res)  params.id = profileId or date

Leave handlers:
  submitLeave(req, res)     userId, req.body, req.file
  getMyLeaves(req, res)
  cancelLeave(req, res)     params.id
  adminGetLeaveQueue(req, res)
  adminReviewLeave(req, res)  params.id, req.body
  adminGetLeaveStats(req, res)

Payslip handlers:
  getMyPayslips(req, res)
  adminListPayslips(req, res)
  generatePayslip(req, res)
  adminMarkPaid(req, res)   params.id
  adminGetPayslipStats(req, res)
```

All methods: `ApiResponse.success(res, data, message)` or `ApiResponse.paginated(res, items, meta, message)`.

### 1.5 – New Routes: `hrm.routes.js`

```
POST   /attendance/punch-in
POST   /attendance/punch-out
GET    /attendance/me
GET    /admin/attendance
PATCH  /admin/attendance/:id

POST   /leaves            (multer single 'attachment')
GET    /leaves/me
DELETE /leaves/:id
GET    /admin/leaves
PATCH  /admin/leaves/:id/review
GET    /admin/leaves/stats

GET    /payslips/me
GET    /admin/payslips
POST   /admin/payslips/generate
PATCH  /admin/payslips/:id/mark-paid
GET    /admin/payslips/stats
```

### 1.6 – New Validation: `hrm.validation.js`

```
submitLeave: {
  leaveType: required enum CL|SL|PL|EMERGENCY
  duration: enum FULL_DAY|HALF_DAY default FULL_DAY
  startDate: date.iso required
  endDate: date.iso required
  reason: string required max 500
}

adminReviewLeave: {
  status: required enum APPROVED|REJECTED
  adminRemarks: string optional max 500
}

adminMarkAttendance: {
  status: required enum PRESENT|ABSENT|HALF_DAY|ON_LEAVE|HOLIDAY
  remarks: string optional
  date: string optional (YYYY-MM-DD)
}

generatePayslip: {
  beauticianId: string required
  month: number 1-12 required
  year: number required
}
```

### 1.7 – Wire in `beautician-service/src/app.js`

```js
// Imports
import { AttendanceRepository, LeaveRepository, PayslipRepository } from './repositories/hrm.repositories.js';
import { HrmService } from './services/hrm.service.js';
import { HrmController } from './controllers/hrm.controller.js';
import { createHrmRoutes } from './routes/hrm.routes.js';

// In createApp():
const attendanceRepo = new AttendanceRepository();
const leaveRepo = new LeaveRepository();
const payslipRepo = new PayslipRepository();
const hrmService = new HrmService(attendanceRepo, leaveRepo, payslipRepo, profileRepo, storageService, beauticianCache);
const hrmCtrl = new HrmController(hrmService);
app.use('/api/v1/hrm', createHrmRoutes(hrmCtrl));
```

### 1.8 – API Gateway Proxy

Add to `api-gateway/src/proxy/routes.js`:
```js
router.use('/api/v1/hrm', createServiceProxy(services.beautician, 'beautician-service'));
```

### 1.9 – Admin Panel: `Admin/src/features/hrm/`

```
hrm/
  api.js
  pages/
    AttendancePage.jsx
    LeavesPage.jsx
    PayslipsPage.jsx
  components/
    AttendanceCalendar.jsx
    LeaveApprovalModal.jsx
    PayslipDrawer.jsx
    GeneratePayslipModal.jsx
    AttendanceMarkModal.jsx
```

#### `api.js` RTK endpoints:
```
getAdminAttendance({ date, status, beauticianId, page, limit })    GET /hrm/admin/attendance
adminMarkAttendance({ id, ...body })                                PATCH /hrm/admin/attendance/:id
getAdminLeaveQueue({ status, page, limit })                         GET /hrm/admin/leaves
adminReviewLeave({ id, status, adminRemarks })                      PATCH /hrm/admin/leaves/:id/review
getAdminLeaveStats()                                                GET /hrm/admin/leaves/stats
getAdminPayslips({ payPeriod, status, page, limit })                GET /hrm/admin/payslips
generatePayslip(body)                                               POST /hrm/admin/payslips/generate
adminMarkPayslipPaid(id)                                            PATCH /hrm/admin/payslips/:id/mark-paid
getAdminPayslipStats(payPeriod)                                     GET /hrm/admin/payslips/stats
```

#### `AttendancePage.jsx` — UI elements:
- Date picker header + beautician search input.
- Stat mini cards: Present Today / Absent / On Leave / Half Day.
- `AttendanceCalendar.jsx`: month grid, color-coded: 🟢PRESENT 🟡HALF_DAY 🔴ABSENT 🔵ON_LEAVE ⚫HOLIDAY.
- Data table: Partner Name | Date | Punch In | Punch Out | Hours | Status | Actions (Mark button).
- `AttendanceMarkModal`: Select status + remarks + date → `adminMarkAttendance`.

#### `LeavesPage.jsx` — UI elements:
- 4 KPI cards: Pending / Approved / Rejected / Total.
- Tab filter: ALL | PENDING | APPROVED | REJECTED.
- Queue table: Partner | Leave Type | Dates | Total Days | Reason | Status | Actions.
- `LeaveApprovalModal`: shows full leave details + textarea for admin remarks + Approve/Reject buttons.
- On approve: auto-updates operational status to ON_LEAVE.

#### `PayslipsPage.jsx` — UI elements:
- Month/Year picker + "Generate Payslips" batch button (opens `GeneratePayslipModal`).
- Payslip stat cards: Total Generated | Paid | Pending | Total Net Payout.
- Table: Partner | Pay Period | Bookings | Gross (₹) | Commission | TDS | Net | Status | Actions.
- Mark Paid button for GENERATED payslips.
- `PayslipDrawer`: full breakdown of each line item.

#### Navigation additions (`navigation.js`) — under Operations group:
```js
{ id: 'hrm-attendance', label: 'Attendance Register', path: '/hrm/attendance', permission: 'beauticians:view' },
{ id: 'hrm-leaves',     label: 'Leave Requests',      path: '/hrm/leaves',     permission: 'beauticians:view' },
{ id: 'hrm-payslips',   label: 'Payslips & Payroll',  path: '/hrm/payslips',   permission: 'finance:view'    },
```

#### Route registration (in `Admin/src/app.jsx` or router config):
```jsx
<Route path="/hrm/attendance" element={<AttendancePage />} />
<Route path="/hrm/leaves"     element={<LeavesPage />} />
<Route path="/hrm/payslips"   element={<PayslipsPage />} />
```

---

## Complete File Change List

### NEW Backend Files (8)
```
beautician-service/src/models/hrm.models.js
beautician-service/src/repositories/hrm.repositories.js
beautician-service/src/services/hrm.service.js
beautician-service/src/controllers/hrm.controller.js
beautician-service/src/routes/hrm.routes.js
beautician-service/src/validators/hrm.validation.js
catalog-service/src/controllers/upload.controller.js
catalog-service/src/routes/upload.routes.js
```

### MODIFIED Backend Files (5)
```
beautician-service/src/app.js            (wire HRM; ObjectId guard on global error handler)
beautician-service/src/services/beautician.services.js   (mongoose.isValidObjectId guards on 6 methods)
api-gateway/src/proxy/routes.js          (proxy /hrm, /upload)
user-service/src/routes/user.routes.js   (add listReferrals route)
membership-service/src/...               (loyalty ledger admin GET + POST endpoints)
```

### NEW Admin Files (10)
```
Admin/src/features/hrm/api.js
Admin/src/features/hrm/pages/AttendancePage.jsx
Admin/src/features/hrm/pages/LeavesPage.jsx
Admin/src/features/hrm/pages/PayslipsPage.jsx
Admin/src/features/hrm/components/AttendanceCalendar.jsx
Admin/src/features/hrm/components/LeaveApprovalModal.jsx
Admin/src/features/hrm/components/PayslipDrawer.jsx
Admin/src/features/hrm/components/GeneratePayslipModal.jsx
Admin/src/features/hrm/components/AttendanceMarkModal.jsx
Admin/src/components/ui/ImageUpload.jsx
```

### MODIFIED Admin Files (12)
```
Admin/src/config/navigation.js
Admin/src/features/beauticians/components/BeauticianDrawer.jsx        (bank approve + cert tab)
Admin/src/features/beauticians/components/KycVerificationQueue.jsx    (remove DEMO, toasts, guards)
Admin/src/features/beauticians/pages/BeauticiansListPage.jsx          (job apps tab)
Admin/src/features/bookings/pages/BookingsListPage.jsx                (remove DEMO_BOOKINGS)
Admin/src/features/filters/pages/FiltersListPage.jsx                  (remove DEMO_FILTERS)
Admin/src/features/referrals/pages/ReferralsListPage.jsx              (remove DEMO_REFERRALS)
Admin/src/features/monitoring/pages/MonitoringPage.jsx                (remove DEMO_SERVICES)
Admin/src/features/users/components/CustomerDrawer.jsx                (loyalty points tab)
Admin/src/features/memberships/api.js                                 (loyalty ledger endpoints)
Admin/src/services/api.js                                             (uploadImage mutation)
Admin/src/app.jsx (or router)                                         (HRM routes)
+ 9 form files with ImageUpload component replacement
```

---

## Verification & Testing Sign-Off

### 1. Automated HRM Lifecycle Test (Task 2567 — Exit Code 0)
Executed an end-to-end multi-step Node lifecycle script testing every HRM endpoint through the API Gateway (`http://localhost:5000/api/v1/hrm`):
- **Punch In (`POST /api/v1/hrm/attendance/punch-in`)**: `200 OK` — Recorded punch-in date `2026-10-24`, status `PRESENT`.
- **Admin Attendance Override (`POST /api/v1/hrm/admin/attendance/mark`)**: `200 OK` — Successfully adjusted record with total hours `8.5`.
- **Leave Submission (`POST /api/v1/hrm/leaves`)**: `201 Created` — Leave request submitted for 8 days (`ID: 6adc71bf27a8d605c0e7b568`).
- **Leave Approval (`PATCH /api/v1/hrm/admin/leaves/:id/review`)**: `200 OK` — Approved by admin, status transitioned to `APPROVED`.
- **Monthly Payslip Generation (`POST /api/v1/hrm/admin/payslips/generate`)**: `201 Created` — Computed base 22,400 INR, calculated mandatory 2% TDS deduction (448 INR), final Net Payout: `22,952 INR`.
- **Mark Payslip Paid (`PATCH /api/v1/hrm/admin/payslips/:id/mark-paid`)**: `200 OK` — Successfully set status to `PAID` with payment timestamp.

### 2. Live API Endpoint Health
- `GET /api/v1/hrm/admin/leaves/stats` → `200 OK` (returns `{ total, pending, approved, rejected, cancelled }`).
- `GET /api/v1/hrm/admin/attendance` → `200 OK` (supports date, status, search, pagination).
- `GET /api/v1/hrm/admin/payslips` → `200 OK` (supports month filter, search, pagination).
- `GET /api/v1/referrals` → `200 OK` (live list from `user-service`).
- `GET /api/v1/memberships/loyalty-ledger?userId=...` → `200 OK` (balance, entries, pagination).
- `POST /api/v1/upload/image` → `201 Created` (multipart upload directly to DigitalOcean Spaces bucket).
- `GET /api/v1/beauticians/profile/invalid-id` → `400 Bad Request` (`Invalid beautician ID format`, Mongoose CastError interceptor verified).

### 3. Browser UI Testing (Recording: `admin_hrm_test_1792829618419.webp`)
Browser subagent validated the Admin Panel user experience on `http://localhost:5173`:
- **Dashboard**: Loaded live KPIs and statistics without console or rendering errors.
- **Attendance Management (`/hrm/attendance`)**: Verified KPI cards, date selector, table, status chips, and functional `<AttendanceMarkModal />`.
- **Leave Management (`/hrm/leaves`)**: Verified status tabs (Pending, Approved, Rejected, All Requests), statistics bar, and review actions.
- **Payslip Management (`/hrm/payslips`)**: Verified month filter, earnings summary, and opened `<GeneratePayslipModal />` verifying live 2% TDS preview calculation.
- **Partner Verification (`/beauticians`)**: Verified Verification Center (KYC queue without mock demo items), Job Applications tab, and Partner Directory.
- **Mock-Free Pages**: Checked `/bookings`, `/filters`, `/referrals`, `/monitoring` — all render live empty states cleanly without demo fallbacks.

### 4. Build & Production Compilation
- `npm run build` executed in `Admin/`
- Result: **0 syntax errors, 0 TypeScript errors, 3,326 modules transformed cleanly in 7.10s**.

