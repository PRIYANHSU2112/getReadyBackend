import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

const uri = process.env.DATABASE_URI;
await mongoose.connect(uri);

// Import BookingAnalyticsService
const { BookingAnalyticsService } = await import('../services/booking-service/src/services/booking.analytics.js');

console.log('Testing getDashboardMetrics...');
let t0 = Date.now();
const metrics = await BookingAnalyticsService.getDashboardMetrics({ dateFilter: '30d' });
console.log('getDashboardMetrics took:', Date.now() - t0, 'ms. Total Bookings:', metrics.kpis.totalBookings);

console.log('Testing getLiveOperationsSnapshot...');
t0 = Date.now();
const liveOps = await BookingAnalyticsService.getLiveOperationsSnapshot();
console.log('getLiveOperationsSnapshot took:', Date.now() - t0, 'ms. Queues:', liveOps.queues);

await mongoose.disconnect();
