import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Session from './models/Session.js';

dotenv.config();

export async function runRecalculation() {
  // Fetch all users to map user IDs to breakLimitMinutes
  const users = await User.find({});
  const userLimitMap = {};
  users.forEach((user) => {
    userLimitMap[user._id.toString()] = user.breakLimitMinutes !== undefined ? user.breakLimitMinutes : 0;
  });

  // Find sessions that are completed. Do not disturb active/on_break sessions!
  const sessions = await Session.find({ status: 'completed' });
  
  let updateCount = 0;
  for (const session of sessions) {
    if (!session.clockIn || !session.clockOut) {
      continue;
    }

    // Calculate shift duration in minutes
    const totalShiftMs = new Date(session.clockOut) - new Date(session.clockIn);
    const totalShiftMins = Math.max(0, Math.round(totalShiftMs / 60000));

    // Get user's break limit (default to 0 if not assigned)
    const userBreakLimit = userLimitMap[session.userId?.toString()] ?? 0;

    // Calculate new duration
    const newDuration = Math.max(0, totalShiftMins - userBreakLimit);

    if (session.duration !== newDuration) {
      session.duration = newDuration;
      await session.save();
      updateCount++;
    }
  }

  if (updateCount > 0) {
    console.log(`[Recalculation] Successfully updated ${updateCount} completed sessions' durations.`);
  } else {
    console.log('[Recalculation] All completed sessions are already up to date.');
  }
}

// If run directly from command line
if (process.argv[1] && (process.argv[1].endsWith('recalculate_durations.js') || process.argv[1].endsWith('recalculate_durations'))) {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('CRITICAL: MONGODB_URI is not defined in server/.env');
    process.exit(1);
  }

  console.log('Connecting to database standalone...');
  mongoose.connect(uri)
    .then(async () => {
      console.log('Database connected. Running recalculation...');
      await runRecalculation();
      console.log('Recalculation finished.');
    })
    .catch((err) => {
      console.error('Recalculation failed with error:', err);
    })
    .finally(() => {
      mongoose.disconnect();
      console.log('Database disconnected.');
    });
}
