/**
 * One-time migration: role "user" -> "customer"
 *
 * Usage: node scripts/migrate-user-role.js
 */
import mongoose from 'mongoose';
import config from '../src/core/config/index.js';
import { UserModel } from '../src/modules/user/user.model.js';

async function migrate() {
  await mongoose.connect(config.mongodbUri);
  const result = await UserModel.updateMany({ role: 'user' }, { $set: { role: 'customer' } });
  console.log(`Migrated ${result.modifiedCount} user(s) from role "user" to "customer"`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
