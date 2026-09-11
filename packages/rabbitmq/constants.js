export const EXCHANGES = Object.freeze({
  DOMAIN_EVENTS: 'getready.domain.events',
  COMMANDS: 'getready.commands',
  RETRY: 'getready.retry',
  DLX: 'getready.dlx',
});

export const QUEUES = Object.freeze({
  DLQ: 'getready.dlq',
});

export const RETRY_CONFIG = Object.freeze({
  MAX_RETRIES: 3,
  // Retry delays in milliseconds for retry queues (5s, 30s, 120s)
  DELAYS_MS: [5000, 30000, 120000],
});

export const EVENT_TYPES = Object.freeze({
  // User & Auth
  USER_CREATED: 'UserCreated',
  USER_UPDATED: 'UserUpdated',
  USER_DELETED: 'UserDeleted',
  USER_LOGGED_IN: 'UserLoggedIn',
  USER_LOGGED_OUT: 'UserLoggedOut',
  PASSWORD_RESET_REQUESTED: 'PasswordResetRequested',
  PASSWORD_RESET_COMPLETED: 'PasswordResetCompleted',
  ADDRESS_CREATED: 'AddressCreated',
  ADDRESS_UPDATED: 'AddressUpdated',
  MEMBER_CREATED: 'MemberCreated',

  // Beautician
  BEAUTICIAN_CREATED: 'BeauticianCreated',
  BEAUTICIAN_UPDATED: 'BeauticianUpdated',
  BEAUTICIAN_VERIFICATION_SUBMITTED: 'BeauticianVerificationSubmitted',
  BEAUTICIAN_KYC_APPROVED: 'BeauticianKycApproved',
  BEAUTICIAN_KYC_REJECTED: 'BeauticianKycRejected',
  BEAUTICIAN_DOCUMENTS_RESUBMISSION_REQUIRED: 'BeauticianDocumentsResubmissionRequired',
  BEAUTICIAN_SUSPENDED: 'BeauticianSuspended',
  BEAUTICIAN_REACTIVATED: 'BeauticianReactivated',
  SKILL_CREATED: 'SkillCreated',
  SKILL_UPDATED: 'SkillUpdated',

  // Catalog
  CATEGORY_CREATED: 'CategoryCreated',
  CATEGORY_UPDATED: 'CategoryUpdated',
  SERVICE_CREATED: 'ServiceCreated',
  SERVICE_UPDATED: 'ServiceUpdated',
  SERVICE_DELETED: 'ServiceDeleted',
  PACKAGE_CREATED: 'PackageCreated',
  PACKAGE_UPDATED: 'PackageUpdated',
  HYGIENE_KIT_UPDATED: 'HygieneKitUpdated',

  // Slot & Booking
  SLOT_CREATED: 'SlotCreated',
  SLOT_RESERVED: 'SlotReserved',
  SLOT_RELEASED: 'SlotReleased',
  BOOKING_CREATED: 'BookingCreated',
  BOOKING_CONFIRMED: 'BookingConfirmed',
  BOOKING_CANCELLED: 'BookingCancelled',
  BOOKING_STARTED: 'BookingStarted',
  BOOKING_SERVICE_STARTED: 'BookingServiceStarted',
  BOOKING_SERVICE_COMPLETED: 'BookingServiceCompleted',
  BOOKING_COMPLETED: 'BookingCompleted',
  BEAUTICIAN_ASSIGNMENT_REQUESTED: 'BeauticianAssignmentRequested',
  BEAUTICIAN_ASSIGNED: 'BeauticianAssigned',
  BEAUTICIAN_ASSIGNMENT_FAILED: 'BeauticianAssignmentFailed',

  // Cart
  CART_CREATED: 'CartCreated',
  CART_UPDATED: 'CartUpdated',
  CART_CLEARED: 'CartCleared',

  // Payment
  PAYMENT_INITIATED: 'PaymentInitiated',
  PAYMENT_SUCCEEDED: 'PaymentSucceeded',
  PAYMENT_FAILED: 'PaymentFailed',
  PAYMENT_REFUNDED: 'PaymentRefunded',

  // Wallet & Rewards
  WALLET_DEBIT_REQUESTED: 'WalletDebitRequested',
  WALLET_DEBITED: 'WalletDebited',
  WALLET_DEBIT_FAILED: 'WalletDebitFailed',
  WALLET_CREDITED: 'WalletCredited',
  POINTS_PENDING: 'PointsPending',
  POINTS_EARNED: 'PointsEarned',
  POINTS_REDEEMED: 'PointsRedeemed',
  CASHBACK_PENDING: 'CashbackPending',
  CASHBACK_CREDITED: 'CashbackCredited',
  CASHBACK_REDEEMED: 'CashbackRedeemed',

  // Notification
  NOTIFICATION_REQUESTED: 'NotificationRequested',
  NOTIFICATION_SENT: 'NotificationSent',
  NOTIFICATION_FAILED: 'NotificationFailed',

  // Content
  BANNER_CREATED: 'BannerCreated',
  BANNER_UPDATED: 'BannerUpdated',
  BLOG_PUBLISHED: 'BlogPublished',
});
