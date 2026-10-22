/**
 * Predefined realistic payloads and parameter generators for GetReady API testing
 */

export const mockIds = {
  validMongoId: '6aa3ced0a5f2001843cd5a61',
  sampleUser: '6aa3ced0a5f2001843cd5a01',
  sampleBeautician: '6aa3ced0a5f2001843cd5a02',
  sampleCategory: '6aa3ced0a5f2001843cd5a03',
  sampleService: '6aa3ced0a5f2001843cd5a04',
  samplePackage: '6aa3ced0a5f2001843cd5a05',
  sampleSlot: '6aa3ced0a5f2001843cd5a06',
  sampleBooking: '6aa3ced0a5f2001843cd5a07',
  sampleCoupon: '6aa3ced0a5f2001843cd5a08',
  sampleAddress: '6aa3ced0a5f2001843cd5a09',
  sampleMember: '6aa3ced0a5f2001843cd5a0a',
  sampleRole: '6aa3ced0a5f2001843cd5a0b',
  sampleBanner: '6aa3ced0a5f2001843cd5a0c',
  sampleBlog: '6aa3ced0a5f2001843cd5a0d',
  sampleTicket: '6aa3ced0a5f2001843cd5a0e',
  sampleReview: '6aa3ced0a5f2001843cd5a0f',
  sampleMembership: '6aa3ced0a5f2001843cd5a10',
  samplePayout: '6aa3ced0a5f2001843cd5a11',
  sampleDoc: '6aa3ced0a5f2001843cd5a12',
  invalidId: 'invalid-non-hex-id-999'
};

export function getPayloadForEndpoint(method, path) {
  // Auth Service
  if (path === '/api/v1/auth/admin/login' || path === '/api/v1/auth/login') {
    return {
      positive: { email: 'admin@getready.com', password: 'wrong-or-test-password' },
      negative: { email: 'not-an-email', password: '12' }
    };
  }
  if (path === '/api/v1/auth/admin/forgot-password') {
    return {
      positive: { email: 'admin@getready.com' },
      negative: { email: 'invalid-email-format' }
    };
  }
  if (path === '/api/v1/auth/admin/reset-password') {
    return {
      positive: { token: 'mock-reset-token-xyz', password: 'NewSecurePassword@123' },
      negative: { token: '', password: 'short' }
    };
  }
  if (path === '/api/v1/auth/mobile/send-otp') {
    return {
      positive: { phone: '9876543210' },
      negative: { phone: '123' }
    };
  }
  if (path === '/api/v1/auth/mobile/resend-otp') {
    return {
      positive: { phone: '9876543219' },
      negative: { phone: '123' }
    };
  }
  if (path === '/api/v1/auth/mobile/verify-otp') {
    return {
      positive: { phone: '9876543210', otp: '123456' },
      negative: { phone: '9876543210', otp: '12' }
    };
  }
  if (path === '/api/v1/auth/refresh-token') {
    return {
      positive: { refreshToken: 'mock-sample-refresh-token' },
      negative: { refreshToken: '' }
    };
  }
  if (path === '/api/v1/auth/logout') {
    return {
      positive: { refreshToken: 'mock-sample-refresh-token' },
      negative: {}
    };
  }

  // User Service
  if (path === '/api/v1/users' && method === 'POST') {
    return {
      positive: { name: 'QA Test User', phone: '+919876543299', email: 'qatest@getready.com', role: 'customer' },
      negative: { name: '', phone: 'abc' }
    };
  }
  if (path.includes('/api/v1/addresses') && (method === 'POST' || method === 'PATCH')) {
    return {
      positive: { title: 'Home', addressLine1: 'Flat 101, Sky Towers', city: 'Bhopal', state: 'MP', pincode: '462001', location: { coordinates: [77.4126, 23.2599] } },
      negative: { pincode: 'invalid' }
    };
  }
  if (path.includes('/api/v1/members') && (method === 'POST' || method === 'PATCH')) {
    return {
      positive: { name: 'Family Member 1', relation: 'Sister', gender: 'Female' },
      negative: { name: '' }
    };
  }
  if (path.includes('/api/v1/roles') && (method === 'POST' || method === 'PATCH')) {
    return {
      positive: { name: 'Support Agent', slug: 'support_agent', permissions: ['tickets:read', 'tickets:write'] },
      negative: { name: '' }
    };
  }

  // Beautician Service
  if (path.includes('/api/v1/beautician-profiles') && (method === 'POST' || method === 'PATCH')) {
    return {
      positive: { name: 'Priya Sharma', experienceYears: 5, bio: 'Certified Bridal & Skin Expert', specializations: ['Bridal', 'Facials'] },
      negative: { experienceYears: -5 }
    };
  }
  if (path === '/api/v1/beautician/home/duty' && method === 'PATCH') {
    return {
      positive: { onDuty: true },
      negative: { onDuty: 'not-a-boolean' }
    };
  }
  if (path.includes('/api/v1/bank-details') && (method === 'PUT' || method === 'PATCH')) {
    return {
      positive: { accountNumber: '918273645012', ifscCode: 'HDFC0001234', accountHolderName: 'Priya Sharma', bankName: 'HDFC Bank' },
      negative: { ifscCode: 'INVALID_IFSC' }
    };
  }
  if (path.includes('/api/v1/skills') && (method === 'POST' || method === 'PATCH')) {
    const rnd = Math.random().toString(36).substring(2, 7);
    return {
      positive: { name: `Bridal Makeup ${rnd}`, category: 'Makeup', level: 'Expert' },
      negative: { name: '' }
    };
  }

  // Catalog Service
  if (path === '/api/v1/categories' && method === 'POST') {
    const rnd = Math.random().toString(36).substring(2, 7);
    return {
      positive: { name: `Spa Relaxation ${rnd}`, slug: `spa-relaxation-${rnd}`, displayOrder: 10, isActive: true },
      negative: { name: '' }
    };
  }
  if (path === '/api/v1/services' && method === 'POST') {
    const rnd = Math.random().toString(36).substring(2, 7);
    return {
      positive: { name: `Facial Care ${rnd}`, slug: `facial-care-${rnd}`, categoryId: mockIds.sampleCategory, price: 999, durationMinutes: 45, isActive: true },
      negative: { name: '', price: -100 }
    };
  }
  if (path === '/api/v1/packages' && method === 'POST') {
    return {
      positive: { title: 'Pre-Bridal Glow Package', serviceIds: [mockIds.sampleService], price: 3499, originalPrice: 4999, isActive: true },
      negative: { title: '', price: -10 }
    };
  }
  if (path === '/api/v1/coupons' && method === 'POST') {
    return {
      positive: { code: 'QAWELCOME50', discountType: 'percentage', discountValue: 50, minOrderAmount: 299, maxDiscountAmount: 150, validTill: '2026-12-31' },
      negative: { code: '', discountValue: -5 }
    };
  }
  if (path === '/api/v1/hygiene-kits' && method === 'POST') {
    return {
      positive: { name: 'Single-Use Disposable Hygiene Kit', price: 99, items: ['Disposable Apron', 'Sanitizer Wipes'] },
      negative: { name: '', price: -50 }
    };
  }
  if (path === '/api/v1/offers' && method === 'POST') {
    return {
      positive: { title: 'Summer Special 20% Off', code: 'SUMMER20', discount: 20, minCartValue: 499 },
      negative: { title: '' }
    };
  }

  // Cart Service
  if (path.includes('/api/v1/cart') && method === 'POST') {
    return {
      positive: { serviceId: mockIds.sampleService, quantity: 1, customizedOptions: [] },
      negative: { serviceId: 'invalid-id', quantity: -1 }
    };
  }
  if (path.includes('/api/v1/cart/apply-coupon')) {
    return {
      positive: { couponCode: 'GETREADY100' },
      negative: { couponCode: '' }
    };
  }

  // Booking & Slots Service
  if (path === '/api/v1/slots/bulk' && method === 'POST') {
    return {
      positive: { date: '2026-10-20', startHour: 9, endHour: 12, slotDurationMinutes: 60, maxBookings: 1 },
      negative: { date: 'not-a-date' }
    };
  }
  if (path.includes('/api/v1/slots') && method === 'POST') {
    return {
      positive: { date: '2026-10-20', startTime: '10:00', endTime: '11:00', beauticianId: mockIds.sampleBeautician },
      negative: { date: 'not-a-date' }
    };
  }
  if (path === '/api/v1/bookings' && method === 'POST') {
    return {
      positive: {
        addressId: mockIds.sampleAddress,
        slotId: mockIds.sampleSlot,
        scheduledDate: '2026-10-25',
        startTime: '10:00',
        paymentMethod: 'ONLINE',
        items: [{ serviceId: mockIds.sampleService, quantity: 1, price: 999 }]
      },
      negative: { items: [] }
    };
  }

  // Wallet Service
  if (path.includes('/api/v1/wallet/add-money') || path.includes('/api/v1/wallet/topup')) {
    return {
      positive: { amount: 500, paymentMethod: 'UPI' },
      negative: { amount: -50 }
    };
  }
  if (path.includes('/api/v1/beautician/wallet/payout-request')) {
    return {
      positive: { amount: 1500, bankDetailId: mockIds.sampleDoc },
      negative: { amount: 0 }
    };
  }

  // Payment Service
  if (path === '/api/v1/payments/create-order') {
    return {
      positive: {
        bookingId: mockIds.sampleBooking,
        amount: 999,
        currency: 'INR',
        idempotencyKey: `idem_qa_${Date.now()}_${Math.floor(Math.random() * 1000)}`
      },
      negative: { amount: -500 }
    };
  }
  if (path === '/api/v1/payments/verify') {
    return {
      positive: { razorpayOrderId: 'order_mock_123', razorpayPaymentId: 'pay_mock_123', razorpaySignature: 'sig_mock_123' },
      negative: { razorpayOrderId: '' }
    };
  }

  // Content Service
  if (path.includes('/api/v1/banners') && method === 'POST') {
    return {
      positive: { title: 'Festive Season Bonanza', imageUrl: 'https://cdn.getready.com/banners/festive.jpg', redirectUrl: '/offers', displayOrder: 1, isActive: true },
      negative: { title: '' }
    };
  }
  if (path.includes('/api/v1/blogs') && method === 'POST') {
    const ts = Date.now();
    return {
      positive: {
        title: `10 Skin Care Secrets For Glowing Skin ${ts}`,
        slug: `10-skin-care-secrets-${ts}-${Math.floor(Math.random() * 1000)}`,
        content: 'Here are the expert tips for glowing skin and beauty maintenance...',
        author: 'Dr. Neha',
        tags: ['Skin Care', 'Beauty'],
        status: 'PUBLISHED'
      },
      negative: { title: '', content: '' }
    };
  }
  if (path.includes('/api/v1/support') || path.includes('/api/v1/tickets')) {
    return {
      positive: { subject: 'Booking rescheduled query', category: 'BOOKING', message: 'I need to check my booking timing', priority: 'MEDIUM' },
      negative: { subject: '' }
    };
  }
  if (path.includes('/api/v1/reviews') && method === 'POST') {
    return {
      positive: { bookingId: mockIds.sampleBooking, beauticianId: mockIds.sampleBeautician, rating: 5, comment: 'Exceptional service! Very professional.' },
      negative: { rating: 10 } // Rating usually 1-5
    };
  }

  // Membership Service
  if (path.includes('/api/v1/memberships') && method === 'POST') {
    return {
      positive: { name: 'GetReady Elite Pass', tier: 'GOLD', durationDays: 365, price: 1499, benefits: ['10% extra discount', 'Free hygiene kit'] },
      negative: { name: '', price: -10 }
    };
  }

  // API Gateway Uploads
  if (path === '/api/v1/uploads/presign') {
    return {
      positive: { fileName: 'profile-avatar.jpg', fileType: 'image/jpeg', folder: 'avatars' },
      negative: { fileName: '' }
    };
  }

  // Default fallback
  return {
    positive: method === 'GET' ? null : { testField: 'sample_value' },
    negative: method === 'GET' ? null : {}
  };
}
