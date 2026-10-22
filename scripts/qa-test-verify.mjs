import request from 'supertest';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createApp as createAuthApp } from '../services/auth-service/src/app.js';

dotenv.config({ path: '.env.development' });

await mongoose.connect(process.env.DATABASE_URI);
console.log('MongoDB connected for test');

const app = createAuthApp();

// 1. Test GET /health
const t0 = performance.now();
const res1 = await request(app).get('/health');
const lat1 = Math.round(performance.now() - t0);
console.log('GET /health => Status:', res1.status, 'Time:', lat1 + 'ms', 'Body:', JSON.stringify(res1.body));

// 2. Test POST /api/v1/auth/mobile/send-otp with invalid payload (negative case)
const t1 = performance.now();
const res2 = await request(app)
  .post('/api/v1/auth/mobile/send-otp')
  .send({ phone: '123' }); // Invalid phone
const lat2 = Math.round(performance.now() - t1);
console.log('POST /api/v1/auth/mobile/send-otp (invalid) => Status:', res2.status, 'Time:', lat2 + 'ms', 'Body:', JSON.stringify(res2.body));

// 3. Test POST /api/v1/auth/mobile/send-otp with valid payload (positive case)
const t2 = performance.now();
const res3 = await request(app)
  .post('/api/v1/auth/mobile/send-otp')
  .send({ phone: '9876543210' });
const lat3 = Math.round(performance.now() - t2);
console.log('POST /api/v1/auth/mobile/send-otp (valid) => Status:', res3.status, 'Time:', lat3 + 'ms', 'Body:', JSON.stringify(res3.body));

await mongoose.disconnect();
console.log('MongoDB disconnected');
