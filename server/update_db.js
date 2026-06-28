import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('CRITICAL: MONGODB_URI is not defined in server/.env');
    process.exit(1);
  }

  try {
    console.log('Connecting to database...');
    await mongoose.connect(uri);
    console.log('Database connected successfully.');

    console.log('Migrating users to include default breakLimitMinutes...');
    const result = await User.updateMany(
      { breakLimitMinutes: { $exists: false } },
      { $set: { breakLimitMinutes: 60 } }
    );
    console.log(`Migration complete. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

  } catch (err) {
    console.error('Migration failed with error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Database disconnected.');
  }
}

run();
