import mongoose from 'mongoose';

const landingCmsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true, index: true },

    // 1. Hero Section
    hero: {
      eyebrow: { type: String, default: 'BEAUTY, DELIVERED TO YOUR DOOR' },
      heading: { type: String, default: 'Salon-quality beauty,' },
      highlightedHeading: { type: String, default: 'right at your home.' },
      subtitle: {
        type: String,
        default: 'Book trusted beauty professionals for salon-quality services, without leaving the comfort of your home.',
      },
      ctaPrimaryText: { type: String, default: 'BOOK A SERVICE' },
      ctaPrimaryLink: { type: String, default: '#services' },
      ctaSecondaryText: { type: String, default: 'EXPLORE SERVICES' },
      ctaSecondaryLink: { type: String, default: '#categories' },
      desktopImageUrl: {
        type: String,
        default: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1600&q=80',
      },
      mobileImageUrl: {
        type: String,
        default: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80',
      },
      videoUrl: { type: String, default: null },
      trustBadges: {
        type: [String],
        default: [
          'Verified Professionals',
          'Hygienic Single-Use Kits',
          'Secure Payments',
          'Beauty at Home',
        ],
      },
    },

    // 2. Trust Metrics Bar
    trustMetrics: [
      {
        value: { type: String, default: '10K+' },
        label: { type: String, default: 'Happy Customers' },
        icon: { type: String, default: 'Users' },
      },
      {
        value: { type: String, default: '500+' },
        label: { type: String, default: 'Verified Professionals' },
        icon: { type: String, default: 'ShieldCheck' },
      },
      {
        value: { type: String, default: '50K+' },
        label: { type: String, default: 'Services Completed' },
        icon: { type: String, default: 'Sparkles' },
      },
      {
        value: { type: String, default: '4.8★' },
        label: { type: String, default: 'Average Rating' },
        icon: { type: String, default: 'Star' },
      },
    ],

    // 3. Why Get Ready Pillars
    whyGetReady: [
      {
        title: { type: String, default: 'Verified Professionals' },
        description: { type: String, default: 'Background verified, certified beauty experts with extensive hands-on salon experience.' },
        icon: { type: String, default: 'ShieldCheck' },
      },
      {
        title: { type: String, default: 'Personalized Experience' },
        description: { type: String, default: 'Tailored treatments configured around your unique skin, hair, and style preferences.' },
        icon: { type: String, default: 'HeartHandshake' },
      },
      {
        title: { type: String, default: 'Professional Hygiene Standards' },
        description: { type: String, default: 'Single-use sealed hygiene kits (₹49), sanitized tools, and disposable single-use sheets.' },
        icon: { type: String, default: 'Sparkles' },
      },
      {
        title: { type: String, default: 'Transparent Pricing' },
        description: { type: String, default: 'Upfront rates with zero hidden charges or unexpected visit fees.' },
        icon: { type: String, default: 'BadgePercent' },
      },
      {
        title: { type: String, default: 'Secure Payments & Cashback' },
        description: { type: String, default: 'Pay via UPI, Cards, NetBanking, or Wallet with instant reward points & cashback.' },
        icon: { type: String, default: 'CreditCard' },
      },
      {
        title: { type: String, default: 'Zero-Delay Guarantee' },
        description: { type: String, default: 'On-time arrival guarantee with complete cancellation fee waiver if our expert is delayed.' },
        icon: { type: String, default: 'Clock' },
      },
    ],

    // 4. How It Works (4 Steps)
    howItWorks: [
      {
        step: { type: String, default: '01' },
        title: { type: String, default: 'Choose Your Service' },
        description: { type: String, default: 'Explore curated salon & spa treatments or build a custom package.' },
      },
      {
        step: { type: String, default: '02' },
        title: { type: String, default: 'Pick Your Time & Address' },
        description: { type: String, default: 'Select your preferred time slot or choose Instant 30-min booking.' },
      },
      {
        step: { type: String, default: '03' },
        title: { type: String, default: 'We Send a Professional' },
        description: { type: String, default: 'A certified beautician arrives at your doorstep with sealed safety kits.' },
      },
      {
        step: { type: String, default: '04' },
        title: { type: String, default: 'Enjoy Your Beauty Experience' },
        description: { type: String, default: 'Relax and experience premium salon-quality pampering right at home.' },
      },
    ],

    // 5. Multi-Customer Booking Promo
    multiCustomer: {
      heading: { type: String, default: 'One booking. Everyone gets their beauty time.' },
      subtitle: {
        type: String,
        default: 'Pamper yourself, your mother, sister, wife, or daughter in a single appointment with one combined payment and dispatch.',
      },
      profiles: {
        type: [String],
        default: ['Self', 'Mother', 'Sister', 'Wife', 'Daughter', 'Friend'],
      },
      dispatchOptions: {
        type: [String],
        default: [
          '1 Beautician — Sequential service delivery',
          '2 Beauticians (Faster Service) — Subject to availability',
        ],
      },
    },

    // 6. Instant Service Banner
    instantService: {
      heading: { type: String, default: 'Need beauty care right now?' },
      description: {
        type: String,
        default: 'Members can book a service within as little as 30 minutes with our priority instant dispatch engine.',
      },
      ctaText: { type: String, default: 'Explore Membership' },
      ctaLink: { type: String, default: '#membership' },
      notice: { type: String, default: 'Instant service availability depends on real-time professional location.' },
    },

    // 7. Beauty Passport Feature
    beautyPassport: {
      heading: { type: String, default: 'Your beauty history, all in one place.' },
      subtitle: {
        type: String,
        default: 'The GET READY Beauty Passport remembers your past treatments, skin sensitivities, hair preferences, and preferred stylings for consistent perfection.',
      },
      features: {
        type: [String],
        default: [
          'Service History & Preferences Tracking',
          'Skin & Hair Profile Customization',
          'Personalized Allergy & Sensitivities Notes',
          'Tailored Product Recommendations',
        ],
      },
    },

    // 8. App Promotion Section
    appPromotion: {
      heading: { type: String, default: 'Your beauty routine, one tap away.' },
      description: {
        type: String,
        default: 'Download the GET READY mobile app on Android and iOS to book instantly, track your beautician in real-time, and unlock exclusive app-only rewards.',
      },
      playStoreUrl: { type: String, default: 'https://play.google.com/store/apps/details?id=com.getready.app' },
      appStoreUrl: { type: String, default: 'https://apps.apple.com/app/get-ready-salon-at-home/id6400000000' },
      qrCodeUrl: { type: String, default: null },
    },

    // 9. Occasions
    occasions: [
      {
        name: { type: String, default: 'Bridal & Wedding' },
        icon: { type: String, default: 'Sparkles' },
        slug: { type: String, default: 'bridal' },
      },
    ],

    // 10. Contact & Socials
    contact: {
      phone: { type: String, default: '+91 98765 43210' },
      email: { type: String, default: 'support@getready.in' },
      whatsapp: { type: String, default: '+91 98765 43210' },
      address: { type: String, default: 'GetReady Beauty Tech Pvt Ltd, Bangalore, India' },
      instagram: { type: String, default: 'https://instagram.com/getready' },
      facebook: { type: String, default: 'https://facebook.com/getready' },
      youtube: { type: String, default: 'https://youtube.com/@getready' },
      linkedin: { type: String, default: 'https://linkedin.com/company/getready' },
    },

    // 11. SEO Configuration
    seo: {
      metaTitle: { type: String, default: 'GET READY | Beauty Salon at Home' },
      metaDescription: {
        type: String,
        default: 'Book trusted beauty professionals for salon-quality hair, skin, waxing, facials, and bridal services in the comfort of your home.',
      },
      keywords: {
        type: [String],
        default: [
          'salon at home',
          'beauty parlour at home',
          'home salon services',
          'get ready',
          'bridal makeup at home',
          'hair spa at home',
          'waxing at home',
        ],
      },
      ogTitle: { type: String, default: 'GET READY — Beauty salon at home' },
      ogDescription: {
        type: String,
        default: 'Salon-quality beauty, right at your home. Verified professionals, single-use hygiene kits, and instant bookings.',
      },
    },

    // 12. Section Visibility & Ordering
    sectionConfig: {
      showHero: { type: Boolean, default: true },
      showTrustStats: { type: Boolean, default: true },
      showCategories: { type: Boolean, default: true },
      showFeaturedServices: { type: Boolean, default: true },
      showWhyGetReady: { type: Boolean, default: true },
      showHowItWorks: { type: Boolean, default: true },
      showMultiCustomer: { type: Boolean, default: true },
      showInstantService: { type: Boolean, default: true },
      showMembership: { type: Boolean, default: true },
      showBeauticianNetwork: { type: Boolean, default: true },
      showBeautyPassport: { type: Boolean, default: true },
      showSpecialOffers: { type: Boolean, default: true },
      showTestimonials: { type: Boolean, default: true },
      showOccasions: { type: Boolean, default: true },
      showPincodeChecker: { type: Boolean, default: true },
      showAppPromotion: { type: Boolean, default: true },
      showFaq: { type: Boolean, default: true },
      showCancellationPolicy: { type: Boolean, default: true },
      showBeautyConcierge: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

export const LandingCmsModel =
  mongoose.models.LandingCms || mongoose.model('LandingCms', landingCmsSchema);
export default LandingCmsModel;
