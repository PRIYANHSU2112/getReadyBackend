import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import crypto from 'crypto';

const mongoUri = process.env.DATABASE_URI;
if (!mongoUri) {
  console.error('[ERROR]: DATABASE_URI is required.');
  process.exit(1);
}

// Bhopal central coordinates with random offsets for realistic map visualization
const BHOPAL_LAT = 23.2599;
const BHOPAL_LNG = 77.4126;

function getRandomLocation(radiusInKm = 8) {
  const radiusInDegrees = radiusInKm / 111;
  const u = Math.random();
  const v = Math.random();
  const w = radiusInDegrees * Math.sqrt(u);
  const t = 2 * Math.PI * v;
  const latOffset = w * Math.cos(t);
  const lngOffset = (w * Math.sin(t)) / Math.cos(BHOPAL_LAT * (Math.PI / 180));
  return [Number((BHOPAL_LNG + lngOffset).toFixed(6)), Number((BHOPAL_LAT + latOffset).toFixed(6))];
}

async function main() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri);
  console.log(`Connected to: ${mongoose.connection.name}`);

  const db = mongoose.connection.db;

  // =========================================================================
  // 1. SEED CATEGORIES
  // =========================================================================
  console.log('Seeding Categories...');
  const categoryDefs = [
    {
      name: 'Facial & Skincare',
      slug: 'facial-skincare',
      description: 'Deep cleansing, hydra facials, anti-tan herbal peels, and fruit radiance therapies',
      displayOrder: 1,
      isActive: true,
      image: { url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=500&auto=format&fit=crop&q=80' },
      icon: 'sparkles',
    },
    {
      name: 'Hair Styling & Spa',
      slug: 'hair-styling',
      description: 'Designer haircuts, blow-dry styling, keratin infusions, herbal hair spas, and rich coloring',
      displayOrder: 2,
      isActive: true,
      image: { url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=500&auto=format&fit=crop&q=80' },
      icon: 'scissors',
    },
    {
      name: 'Waxing & Threading',
      slug: 'waxing-threading',
      description: 'Gentle Rica Brazilian waxing, honey roll-ons, and precise facial threading',
      displayOrder: 3,
      isActive: true,
      image: { url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=500&auto=format&fit=crop&q=80' },
      icon: 'zap',
    },
    {
      name: 'Bridal & Party Makeup',
      slug: 'bridal-makeup',
      description: 'High-definition HD bridal glam, airbrush wedding looks, cocktail party and sangeet makeup',
      displayOrder: 4,
      isActive: true,
      image: { url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=500&auto=format&fit=crop&q=80' },
      icon: 'crown',
    },
    {
      name: 'Nails & Pedicure',
      slug: 'nails-pedicure',
      description: 'Luxury rose petal foot spa, crystal gel extensions, chrome finishes, and paraffin manicure',
      displayOrder: 5,
      isActive: true,
      image: { url: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=500&auto=format&fit=crop&q=80' },
      icon: 'hand',
    },
    {
      name: 'Massage & Wellness',
      slug: 'massage-wellness',
      description: 'Deep tissue destress massage, Swedish aromatherapy, hot stone therapy, and foot reflexology',
      displayOrder: 6,
      isActive: true,
      image: { url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=500&auto=format&fit=crop&q=80' },
      icon: 'heart',
    },
  ];

  const categoryMap = new Map();
  for (const cat of categoryDefs) {
    const existing = await db.collection('categories').findOneAndUpdate(
      { slug: cat.slug },
      { $set: { ...cat, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );
    categoryMap.set(cat.slug, existing?._id || existing?.value?._id);
  }
  console.log(`Categories ready: ${categoryMap.size}`);

  // =========================================================================
  // 2. SEED SERVICES
  // =========================================================================
  console.log('Seeding Services...');
  const serviceDefs = [
    {
      name: 'Diamond Glow Radiance Facial',
      slug: 'diamond-glow-radiance-facial',
      categorySlug: 'facial-skincare',
      description: 'Exfoliating diamond micro-dermabrasion with active vitamin C infusion for instant wedding glow.',
      price: 1999,
      discountedPrice: 1599,
      durationMinMinutes: 60,
      durationMaxMinutes: 75,
      gender: 'female',
      status: 'APPROVED',
      isActive: true,
      ratingAvg: 4.9,
      ratingCount: 182,
      images: [{ url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&auto=format&fit=crop&q=80' }],
    },
    {
      name: 'Hydra Deep Moisture Cleanse',
      slug: 'hydra-deep-moisture-cleanse',
      categorySlug: 'facial-skincare',
      description: '4-step vortex hydra cleansing targeting deep blackheads, dehydration, and uneven texture.',
      price: 1499,
      discountedPrice: 1199,
      durationMinMinutes: 45,
      durationMaxMinutes: 60,
      gender: 'female',
      status: 'APPROVED',
      isActive: true,
      ratingAvg: 4.8,
      ratingCount: 145,
      images: [{ url: 'https://images.unsplash.com/photo-1512290900672-1f02f43cb8d2?w=400&auto=format&fit=crop&q=80' }],
    },
    {
      name: 'O3+ Bridal Radiance Power Mask',
      slug: 'o3-bridal-radiance-power-mask',
      categorySlug: 'facial-skincare',
      description: 'Ultra-brightening oxygen therapy facial specially formulated for high-end celebrations.',
      price: 2499,
      discountedPrice: 1999,
      durationMinMinutes: 75,
      durationMaxMinutes: 90,
      gender: 'female',
      status: 'APPROVED',
      isActive: true,
      ratingAvg: 4.95,
      ratingCount: 96,
      images: [{ url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&auto=format&fit=crop&q=80' }],
    },
    {
      name: 'Moroccan Argan Oil Hair Spa',
      slug: 'moroccan-argan-oil-hair-spa',
      categorySlug: 'hair-styling',
      description: 'Intense micro-mist steam conditioning with pure Moroccan argan elixir for silk finish hair.',
      price: 1799,
      discountedPrice: 1399,
      durationMinMinutes: 60,
      durationMaxMinutes: 75,
      gender: 'female',
      status: 'APPROVED',
      isActive: true,
      ratingAvg: 4.85,
      ratingCount: 120,
      images: [{ url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&auto=format&fit=crop&q=80' }],
    },
    {
      name: 'Keratin Protein Hair Treatment',
      slug: 'keratin-protein-hair-treatment',
      categorySlug: 'hair-styling',
      description: 'Frizz-free smoothing therapy restoring split ends, thermal resistance, and long-lasting gloss.',
      price: 3499,
      discountedPrice: 2899,
      durationMinMinutes: 90,
      durationMaxMinutes: 120,
      gender: 'female',
      status: 'APPROVED',
      isActive: true,
      ratingAvg: 4.9,
      ratingCount: 88,
      images: [{ url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=400&auto=format&fit=crop&q=80' }],
    },
    {
      name: 'Rica White Chocolate Waxing (Full Body)',
      slug: 'rica-white-chocolate-waxing-full-body',
      categorySlug: 'waxing-threading',
      description: 'Painless liposoluble Italian wax with soothing aloe vera oil for ultra-soft, hair-free skin.',
      price: 1899,
      discountedPrice: 1499,
      durationMinMinutes: 60,
      durationMaxMinutes: 75,
      gender: 'female',
      status: 'APPROVED',
      isActive: true,
      ratingAvg: 4.88,
      ratingCount: 240,
      images: [{ url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=400&auto=format&fit=crop&q=80' }],
    },
    {
      name: 'Honey Waxing (Full Arms & Legs + Underarms)',
      slug: 'honey-waxing-full-arms-legs',
      categorySlug: 'waxing-threading',
      description: 'Traditional soothing natural honey wax combo for smooth, refreshed skin.',
      price: 999,
      discountedPrice: 799,
      durationMinMinutes: 45,
      durationMaxMinutes: 60,
      gender: 'female',
      status: 'APPROVED',
      isActive: true,
      ratingAvg: 4.75,
      ratingCount: 310,
      images: [{ url: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=400&auto=format&fit=crop&q=80' }],
    },
    {
      name: 'HD Airbrush Bridal Glam Makeup',
      slug: 'hd-airbrush-bridal-glam-makeup',
      categorySlug: 'bridal-makeup',
      description: '18-hour sweatproof airbrush wedding finish including premium 3D mink lashes and saree draping.',
      price: 8999,
      discountedPrice: 7499,
      durationMinMinutes: 120,
      durationMaxMinutes: 180,
      gender: 'female',
      status: 'APPROVED',
      isActive: true,
      ratingAvg: 4.98,
      ratingCount: 65,
      images: [{ url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&auto=format&fit=crop&q=80' }],
    },
    {
      name: 'Cocktail Party & Sangeet Makeup',
      slug: 'cocktail-party-sangeet-makeup',
      categorySlug: 'bridal-makeup',
      description: 'Soft glam party makeup with shimmer eye pigments, contouring, and modern hair curls.',
      price: 2999,
      discountedPrice: 2499,
      durationMinMinutes: 60,
      durationMaxMinutes: 90,
      gender: 'female',
      status: 'APPROVED',
      isActive: true,
      ratingAvg: 4.89,
      ratingCount: 142,
      images: [{ url: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=400&auto=format&fit=crop&q=80' }],
    },
    {
      name: 'Crystal Rose Petal Pedicure & Spa',
      slug: 'crystal-rose-petal-pedicure-spa',
      categorySlug: 'nails-pedicure',
      description: 'Warm sea salt scrub, rose petal soak, heel callous buffering, and relaxing foot massage.',
      price: 1199,
      discountedPrice: 899,
      durationMinMinutes: 45,
      durationMaxMinutes: 60,
      gender: 'female',
      status: 'APPROVED',
      isActive: true,
      ratingAvg: 4.82,
      ratingCount: 175,
      images: [{ url: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&auto=format&fit=crop&q=80' }],
    },
    {
      name: 'Full Body Swedish Aromatherapy Massage',
      slug: 'full-body-swedish-aromatherapy-massage',
      categorySlug: 'massage-wellness',
      description: 'Relaxing 60-minute Swedish strokes with organic lavender and eucalyptus oils to relieve stress.',
      price: 2499,
      discountedPrice: 1999,
      durationMinMinutes: 60,
      durationMaxMinutes: 75,
      gender: 'female',
      status: 'APPROVED',
      isActive: true,
      ratingAvg: 4.94,
      ratingCount: 112,
      images: [{ url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&auto=format&fit=crop&q=80' }],
    },
  ];

  const serviceMap = new Map();
  for (const srv of serviceDefs) {
    const categoryId = categoryMap.get(srv.categorySlug);
    if (!categoryId) continue;

    const payload = {
      name: srv.name,
      slug: srv.slug,
      categoryId,
      description: srv.description,
      price: srv.price,
      discountedPrice: srv.discountedPrice,
      durationMinMinutes: srv.durationMinMinutes,
      durationMaxMinutes: srv.durationMaxMinutes,
      gender: srv.gender,
      status: srv.status,
      isActive: srv.isActive,
      ratingAvg: srv.ratingAvg,
      ratingCount: srv.ratingCount,
      images: srv.images,
      updatedAt: new Date(),
    };

    const existing = await db.collection('services').findOneAndUpdate(
      { slug: srv.slug },
      { $set: payload, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );
    const id = existing?._id || existing?.value?._id;
    serviceMap.set(srv.slug, { id, ...payload });
  }
  console.log(`Services ready: ${serviceMap.size}`);

  // =========================================================================
  // 3. SEED PACKAGES & COMBOS
  // =========================================================================
  console.log('Seeding Packages & Combos...');
  const srvFacial = serviceMap.get('diamond-glow-radiance-facial');
  const srvHair = serviceMap.get('moroccan-argan-oil-hair-spa');
  const srvWax = serviceMap.get('rica-white-chocolate-waxing-full-body');
  const srvPedi = serviceMap.get('crystal-rose-petal-pedicure-spa');
  const srvBridal = serviceMap.get('hd-airbrush-bridal-glam-makeup');
  const srvMassage = serviceMap.get('full-body-swedish-aromatherapy-massage');

  const packageDefs = [
    {
      name: 'Royal Bridal Glow & Pre-Wedding Ritual',
      slug: 'royal-bridal-glow-pre-wedding-ritual',
      categoryId: categoryMap.get('bridal-makeup'),
      description: 'Complete 3-step luxury pre-bridal package including diamond facial, Moroccan hair spa, and full body waxing.',
      price: 4999,
      originalPrice: 7500,
      discountedPrice: 4799,
      durationMinMinutes: 150,
      durationMaxMinutes: 180,
      thumbnail: { url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&auto=format&fit=crop&q=80' },
      badges: ['BESTSELLER', 'BRIDAL_SPECIAL', 'SAVE_35%'],
      status: 'APPROVED',
      isActive: true,
      items: [
        { serviceId: srvFacial.id, name: srvFacial.name, isMandatory: true, isDefaultSelected: true, extraCharge: 0, durationMinMinutes: 60 },
        { serviceId: srvHair.id, name: srvHair.name, isMandatory: true, isDefaultSelected: true, extraCharge: 0, durationMinMinutes: 45 },
        { serviceId: srvWax.id, name: srvWax.name, isMandatory: false, isDefaultSelected: true, extraCharge: 0, durationMinMinutes: 45 },
      ],
    },
    {
      name: 'Weekend Urban Refresh & Head-to-Toe Spa',
      slug: 'weekend-urban-refresh-head-to-toe-spa',
      categoryId: categoryMap.get('massage-wellness'),
      description: 'Stress-busting relaxation package with Swedish aromatherapy massage, foot spa pedicure, and hydra cleanse.',
      price: 3499,
      originalPrice: 5200,
      discountedPrice: 3299,
      durationMinMinutes: 120,
      durationMaxMinutes: 150,
      thumbnail: { url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&auto=format&fit=crop&q=80' },
      badges: ['POPULAR', 'WEEKEND_DEAL'],
      status: 'APPROVED',
      isActive: true,
      items: [
        { serviceId: srvMassage.id, name: srvMassage.name, isMandatory: true, isDefaultSelected: true, extraCharge: 0, durationMinMinutes: 60 },
        { serviceId: srvPedi.id, name: srvPedi.name, isMandatory: true, isDefaultSelected: true, extraCharge: 0, durationMinMinutes: 45 },
      ],
    },
    {
      name: 'Hydra Monsoon Glow Express',
      slug: 'hydra-monsoon-glow-express',
      categoryId: categoryMap.get('facial-skincare'),
      description: 'Quick anti-humidity hydration facial with crystal foot reflexology.',
      price: 1999,
      originalPrice: 2800,
      discountedPrice: 1799,
      durationMinMinutes: 75,
      durationMaxMinutes: 90,
      thumbnail: { url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&auto=format&fit=crop&q=80' },
      badges: ['SAVE_30%'],
      status: 'APPROVED',
      isActive: true,
      items: [
        { serviceId: srvFacial.id, name: srvFacial.name, isMandatory: true, isDefaultSelected: true, extraCharge: 0, durationMinMinutes: 45 },
        { serviceId: srvPedi.id, name: srvPedi.name, isMandatory: false, isDefaultSelected: true, extraCharge: 0, durationMinMinutes: 30 },
      ],
    },
  ];

  for (const pkg of packageDefs) {
    await db.collection('packages').findOneAndUpdate(
      { slug: pkg.slug },
      { $set: { ...pkg, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  }
  console.log(`Packages seeded: ${packageDefs.length}`);

  // =========================================================================
  // 4. SEED BEAUTICIANS & PROFILES
  // =========================================================================
  console.log('Seeding Beauticians & Profiles...');
  const beauticianProfiles = [
    { name: 'Sunita Rao', phone: '9876511221', email: 'sunita.rao@getready.com', operationalStatus: 'AVAILABLE', kycStatus: 'VERIFIED', rating: 4.95, completed: 154, skills: ['Bridal Makeup', 'O3+ Facials', 'Swedish Massage'] },
    { name: 'Pooja Gupta', phone: '9876511222', email: 'pooja.gupta@getready.com', operationalStatus: 'BUSY', kycStatus: 'VERIFIED', rating: 4.88, completed: 118, skills: ['Hydra Facial', 'Hair Spa', 'Rica Waxing'] },
    { name: 'Kavita Nair', phone: '9876511223', email: 'kavita.nair@getready.com', operationalStatus: 'ONLINE', kycStatus: 'VERIFIED', rating: 4.92, completed: 95, skills: ['Keratin Treatment', 'Party Makeup'] },
    { name: 'Meera Joshi', phone: '9876511224', email: 'meera.joshi@getready.com', operationalStatus: 'OFFLINE', kycStatus: 'VERIFIED', rating: 4.80, completed: 76, skills: ['Facials', 'Nail Extensions'] },
    { name: 'Priya Das', phone: '9876511225', email: 'priya.das@getready.com', operationalStatus: 'AVAILABLE', kycStatus: 'VERIFIED', rating: 4.85, completed: 62, skills: ['Aromatherapy Massage', 'Waxing'] },
    { name: 'Ananya Verma', phone: '9876511226', email: 'ananya.verma@getready.com', operationalStatus: 'BUSY', kycStatus: 'VERIFIED', rating: 4.91, completed: 140, skills: ['Airbrush Makeup', 'Hair Spa'] },
    { name: 'Shalini Saxena', phone: '9876511227', email: 'shalini.saxena@getready.com', operationalStatus: 'OFFLINE', kycStatus: 'PENDING', rating: 4.70, completed: 12, skills: ['Basic Facials', 'Threading'] },
    { name: 'Rekha Choudhary', phone: '9876511228', email: 'rekha.c@getready.com', operationalStatus: 'OFFLINE', kycStatus: 'PENDING', rating: 4.65, completed: 5, skills: ['Waxing', 'Pedicure'] },
    { name: 'Neelam Tiwari', phone: '9876511229', email: 'neelam.tiwari@getready.com', operationalStatus: 'AVAILABLE', kycStatus: 'VERIFIED', rating: 4.94, completed: 168, skills: ['Bridal Makeover', 'Facial Glow'] },
    { name: 'Tanya Sen', phone: '9876511230', email: 'tanya.sen@getready.com', operationalStatus: 'BUSY', kycStatus: 'VERIFIED', rating: 4.86, completed: 83, skills: ['Gel Polish', 'Swedish Massage'] },
  ];

  const seededBeauticians = [];

  for (const b of beauticianProfiles) {
    // Upsert User
    const userRes = await db.collection('users').findOneAndUpdate(
      { email: b.email },
      {
        $set: {
          name: b.name,
          phone: b.phone,
          email: b.email,
          role: 'beautician',
          isActive: true,
          deletedAt: null,
          emailVerifiedAt: new Date(),
          phoneVerifiedAt: new Date(),
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
          referralCode: `BEA${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
    const userId = (userRes?._id || userRes?.value?._id).toString();
    const loc = getRandomLocation(6);

    // Upsert BeauticianProfile
    const profileRes = await db.collection('beauticianprofiles').findOneAndUpdate(
      { userId },
      {
        $set: {
          userId,
          operationalStatus: b.operationalStatus,
          isAvailable: b.operationalStatus === 'AVAILABLE' || b.operationalStatus === 'ONLINE',
          kycStatus: b.kycStatus,
          ratingAvg: b.rating,
          ratingCount: b.completed,
          completedBookingsCount: b.completed,
          skills: b.skills,
          serviceRadiusKm: 12,
          address: {
            line1: 'Arera Colony & MP Nagar',
            city: 'Bhopal',
            state: 'Madhya Pradesh',
            pincode: '462011',
            country: 'India',
            location: { type: 'Point', coordinates: loc },
          },
          profilePhoto: {
            url: `https://images.unsplash.com/photo-${1573496359142 + seededBeauticians.length}?w=200&auto=format&fit=crop&q=80`,
          },
          documents: [
            {
              docType: 'aadhaar_front',
              docNumber: '5421-9988-1234',
              status: b.kycStatus === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
              file: { url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600' },
              uploadedAt: new Date(),
            },
            {
              docType: 'license',
              docNumber: 'LKN-BEAUTY-2024-918',
              status: b.kycStatus === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
              file: { url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600' },
              uploadedAt: new Date(),
            },
          ],
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, returnDocument: 'after' }
    );
    const beauticianProfileId = (profileRes?._id || profileRes?.value?._id).toString();
    seededBeauticians.push({ userId, profileId: beauticianProfileId, name: b.name, phone: b.phone, ...b });
  }
  console.log(`Beauticians ready: ${seededBeauticians.length}`);

  // =========================================================================
  // 5. SEED CUSTOMERS
  // =========================================================================
  console.log('Seeding Customers...');
  const customers = [
    { name: 'Pooja Agarwal', phone: '9930128910', email: 'pooja.a@gmail.com', totalSpent: 38400, bookingsCount: 12 },
    { name: 'Sunita Kapoor', phone: '9820048192', email: 'sunita.k@gmail.com', totalSpent: 26800, bookingsCount: 9 },
    { name: 'Sneha Deshmukh', phone: '9845012891', email: 'sneha.d@gmail.com', totalSpent: 19500, bookingsCount: 7 },
    { name: 'Ritu Sen', phone: '9833456789', email: 'ritu.sen@gmail.com', totalSpent: 14200, bookingsCount: 5 },
    { name: 'Deepika Patel', phone: '9844567890', email: 'deepika.p@gmail.com', totalSpent: 11800, bookingsCount: 4 },
    { name: 'Kavita Sundaram', phone: '9871120983', email: 'kavita.s@gmail.com', totalSpent: 29400, bookingsCount: 10 },
  ];

  const seededCustomers = [];
  for (const c of customers) {
    const userRes = await db.collection('users').findOneAndUpdate(
      { email: c.email },
      {
        $set: {
          name: c.name,
          phone: c.phone,
          email: c.email,
          role: 'customer',
          isActive: true,
          deletedAt: null,
          emailVerifiedAt: new Date(),
          phoneVerifiedAt: new Date(),
          totalSpent: c.totalSpent,
          bookingsCount: c.bookingsCount,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
          referralCode: `CUST${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
    const id = (userRes?._id || userRes?.value?._id).toString();
    seededCustomers.push({ id, ...c });
  }
  console.log(`Customers ready: ${seededCustomers.length}`);

  // =========================================================================
  // 6. SEED BOOKINGS (LIVE OPERATIONS & ANALYTICS)
  // =========================================================================
  console.log('Seeding Bookings...');
  const allServices = Array.from(serviceMap.values());
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const bookingBlueprints = [
    // Today Live Operations Bookings
    { mode: 'INSTANT', status: 'CONFIRMED', timeOffset: -30 * 60 * 1000, daysAgo: 0, srv: 'diamond-glow-radiance-facial', custIdx: 0, beaIdx: 0 },
    { mode: 'INSTANT', status: 'ASSIGNED', timeOffset: -15 * 60 * 1000, daysAgo: 0, srv: 'moroccan-argan-oil-hair-spa', custIdx: 1, beaIdx: 1 },
    { mode: 'INSTANT', status: 'ARRIVING', timeOffset: -5 * 60 * 1000, daysAgo: 0, srv: 'rica-white-chocolate-waxing-full-body', custIdx: 2, beaIdx: 2 },
    { mode: 'SCHEDULED', status: 'STARTED', timeOffset: -45 * 60 * 1000, daysAgo: 0, srv: 'full-body-swedish-aromatherapy-massage', custIdx: 3, beaIdx: 0 },
    { mode: 'SCHEDULED', status: 'IN_PROGRESS', timeOffset: -20 * 60 * 1000, daysAgo: 0, srv: 'o3-bridal-radiance-power-mask', custIdx: 4, beaIdx: 5 },
    { mode: 'SCHEDULED', status: 'CONFIRMED', timeOffset: 60 * 60 * 1000, daysAgo: 0, srv: 'crystal-rose-petal-pedicure-spa', custIdx: 5, beaIdx: 4 },

    // Past 7 Days Completed / Cancelled
    { mode: 'SCHEDULED', status: 'COMPLETED', timeOffset: 0, daysAgo: 1, srv: 'hd-airbrush-bridal-glam-makeup', custIdx: 0, beaIdx: 0 },
    { mode: 'SCHEDULED', status: 'COMPLETED', timeOffset: 0, daysAgo: 2, srv: 'diamond-glow-radiance-facial', custIdx: 1, beaIdx: 1 },
    { mode: 'SCHEDULED', status: 'COMPLETED', timeOffset: 0, daysAgo: 3, srv: 'moroccan-argan-oil-hair-spa', custIdx: 2, beaIdx: 2 },
    { mode: 'SCHEDULED', status: 'CANCELLED', timeOffset: 0, daysAgo: 3, srv: 'rica-white-chocolate-waxing-full-body', custIdx: 3, beaIdx: 3 },
    { mode: 'SCHEDULED', status: 'COMPLETED', timeOffset: 0, daysAgo: 4, srv: 'keratin-protein-hair-treatment', custIdx: 4, beaIdx: 5 },
    { mode: 'SCHEDULED', status: 'COMPLETED', timeOffset: 0, daysAgo: 5, srv: 'full-body-swedish-aromatherapy-massage', custIdx: 5, beaIdx: 0 },
    { mode: 'SCHEDULED', status: 'COMPLETED', timeOffset: 0, daysAgo: 6, srv: 'cocktail-party-sangeet-makeup', custIdx: 0, beaIdx: 2 },
    { mode: 'SCHEDULED', status: 'COMPLETED', timeOffset: 0, daysAgo: 7, srv: 'hydra-deep-moisture-cleanse', custIdx: 1, beaIdx: 1 },

    // Past 30 Days Completed
    { mode: 'SCHEDULED', status: 'COMPLETED', timeOffset: 0, daysAgo: 10, srv: 'diamond-glow-radiance-facial', custIdx: 2, beaIdx: 0 },
    { mode: 'SCHEDULED', status: 'COMPLETED', timeOffset: 0, daysAgo: 12, srv: 'hd-airbrush-bridal-glam-makeup', custIdx: 3, beaIdx: 5 },
    { mode: 'SCHEDULED', status: 'COMPLETED', timeOffset: 0, daysAgo: 15, srv: 'o3-bridal-radiance-power-mask', custIdx: 4, beaIdx: 1 },
    { mode: 'SCHEDULED', status: 'COMPLETED', timeOffset: 0, daysAgo: 18, srv: 'moroccan-argan-oil-hair-spa', custIdx: 5, beaIdx: 2 },
    { mode: 'SCHEDULED', status: 'COMPLETED', timeOffset: 0, daysAgo: 20, srv: 'crystal-rose-petal-pedicure-spa', custIdx: 0, beaIdx: 4 },
    { mode: 'SCHEDULED', status: 'COMPLETED', timeOffset: 0, daysAgo: 22, srv: 'full-body-swedish-aromatherapy-massage', custIdx: 1, beaIdx: 0 },
    { mode: 'SCHEDULED', status: 'COMPLETED', timeOffset: 0, daysAgo: 25, srv: 'rica-white-chocolate-waxing-full-body', custIdx: 2, beaIdx: 3 },
    { mode: 'SCHEDULED', status: 'COMPLETED', timeOffset: 0, daysAgo: 28, srv: 'diamond-glow-radiance-facial', custIdx: 3, beaIdx: 1 },
  ];

  let bookingCount = 0;
  for (let i = 0; i < bookingBlueprints.length; i += 1) {
    const bp = bookingBlueprints[i];
    const customer = seededCustomers[bp.custIdx % seededCustomers.length];
    const beautician = seededBeauticians[bp.beaIdx % seededBeauticians.length];
    const service = serviceMap.get(bp.srv) || allServices[0];

    const bookingDate = new Date(now - bp.daysAgo * dayMs + bp.timeOffset);
    const dateStr = bookingDate.toISOString().slice(0, 10);
    const bookingNumber = `BK-${dateStr.replace(/-/g, '')}-${(1001 + i).toString()}`;

    const payableAmount = service.discountedPrice || service.price;
    const participantId = new mongoose.Types.ObjectId();
    const itemId = new mongoose.Types.ObjectId();

    const bookingDoc = {
      bookingNumber,
      userId: customer.id,
      accountOwnerId: customer.id,
      schedulingMode: bp.mode,
      scheduledDate: dateStr,
      scheduledStartTime: bookingDate,
      scheduledEndTime: new Date(bookingDate.getTime() + service.durationMinMinutes * 60000),
      status: bp.status,
      preferredBeauticianCount: 1,
      assignedBeauticianCount: bp.status === 'CONFIRMED' ? 0 : 1,
      addressId: `addr_${customer.id}_1`,
      addressSnapshot: {
        name: customer.name,
        phone: customer.phone,
        addressLine1: `Villa ${10 + i}, Signature Enclave, Arera Colony`,
        city: 'Bhopal',
        pincode: '462016',
      },
      participants: [
        {
          _id: participantId,
          customerProfileId: customer.id,
          name: customer.name,
          relationship: 'Self',
          gender: 'FEMALE',
        },
      ],
      items: [
        {
          _id: itemId,
          participantId,
          customerProfileId: customer.id,
          participantName: customer.name,
          itemType: 'SERVICE',
          serviceId: service.id.toString(),
          serviceName: service.name,
          categoryId: service.categoryId.toString(),
          basePrice: service.price,
          unitPrice: payableAmount,
          quantity: 1,
          totalPrice: payableAmount,
          durationMinutes: service.durationMinMinutes,
          assignedBeauticianId: bp.status === 'CONFIRMED' ? null : beautician.userId,
          assignedBeauticianName: bp.status === 'CONFIRMED' ? null : beautician.name,
          status: bp.status === 'CONFIRMED' ? 'PENDING' : 'ASSIGNED',
        },
      ],
      beauticianAssignments: bp.status === 'CONFIRMED' ? [] : [
        {
          beauticianId: beautician.userId,
          beauticianName: beautician.name,
          assignedItemIds: [itemId],
          assignmentStatus: bp.status === 'COMPLETED' ? 'COMPLETED' : 'ASSIGNED',
          assignedBy: 'SYSTEM',
          assignedAt: new Date(bookingDate.getTime() - 15 * 60000),
        },
      ],
      hygieneKit: {
        hygieneKitId: 'kit_pro_standard',
        title: 'Safety & Hygiene Sealed Kit',
        unitPrice: 49,
        quantity: 1,
        total: 49,
      },
      pricing: {
        servicesSubtotal: service.price,
        upgradesTotal: 0,
        hygieneKitTotal: 49,
        subtotal: service.price + 49,
        membershipDiscount: service.price - payableAmount,
        couponDiscount: 0,
        walletDeduction: 0,
        pointsDeduction: 0,
        cashbackDeduction: 0,
        tax: Math.round(payableAmount * 0.05),
        totalSavings: service.price - payableAmount,
        payableAmount: payableAmount + 49 + Math.round(payableAmount * 0.05),
      },
      statusHistory: [
        { status: 'CONFIRMED', timestamp: new Date(bookingDate.getTime() - 30 * 60000), actor: 'CUSTOMER' },
        ...(bp.status !== 'CONFIRMED' ? [{ status: bp.status, timestamp: bookingDate, actor: 'SYSTEM' }] : []),
      ],
      createdAt: bookingDate,
      updatedAt: bookingDate,
    };

    await db.collection('bookings').findOneAndUpdate(
      { bookingNumber },
      { $set: bookingDoc },
      { upsert: true }
    );
    bookingCount += 1;
  }
  console.log(`Bookings seeded: ${bookingCount}`);

  console.log('==================================================');
  console.log('SHOWCASE DATA SEEDING COMPLETE!');
  console.log('==================================================');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[FATAL SEED ERROR]:', err);
  process.exit(1);
});
