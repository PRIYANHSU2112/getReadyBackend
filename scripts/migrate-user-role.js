/**
 * One-time migration: role "user" -> "customer"
 *
 * Usage: node scripts/migrate-user-role.js
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { UserModel } from '../services/user-service/src/models/user.model.js';

const mongoUri = process.env.DATABASE_URI;
if (!mongoUri) {
  console.error('[ERROR]: DATABASE_URI environment variable is required.');
  process.exit(1);
}

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log(`Connected to MongoDB (${mongoose.connection.name})`);

  const result = await UserModel.updateMany({ role: 'user' }, { $set: { role: 'customer' } });
  console.log(`Migrated ${result.modifiedCount} user(s) from role "user" to "customer"`);

  await mongoose.disconnect();
  console.log('Done.');
}

migrate().catch((err) => {
  console.error('Migration Error:', err.message);
  process.exit(1);
});
