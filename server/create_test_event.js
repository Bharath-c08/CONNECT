import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Team from './models/Team.js';
import Event from './models/Event.js';

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

    // 1. Get all teams
    const teams = await Team.find({});
    if (teams.length === 0) {
      console.log('No teams found in the database. Please create a team first.');
      return;
    }
    const targetTeam = teams[0];
    console.log(`Using target team: ${targetTeam._id}`);

    // 2. Get admin user to be the creator
    const admin = await User.findOne({ role: { $in: ['admin', 'superadmin'] } }) || await User.findOne({});
    if (!admin) {
      console.log('No users found in database.');
      return;
    }
    console.log(`Using event creator: ${admin.fullName} (${admin._id})`);

    // 3. Clear any existing manual events to start clean
    await Event.deleteMany({});
    console.log('Cleared existing manual events.');

    // 4. Create a test event
    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + 3); // 3 days from now
    
    const testEvent = new Event({
      title: "Tactical Infrastructure Synchronization",
      description: "Commencing scheduled operational synchronization of all core terminal endpoints. Please ensure your local clients remain connected during the maintenance window.",
      date: eventDate,
      targetTeams: [targetTeam._id],
      creator: admin._id
    });

    await testEvent.save();
    console.log('Test event published successfully.');

    // 5. Update team members to trigger birthday and anniversary celebrations
    const members = await User.find({ _id: { $in: targetTeam.members } });
    console.log(`Found ${members.length} members in the team.`);

    const today = new Date();

    if (members.length > 0) {
      // Set first member's birthday to today
      const bdayUser = members[0];
      const dob = new Date(1996, today.getMonth(), today.getDate());
      await User.findByIdAndUpdate(bdayUser._id, { dob });
      console.log(`Updated ${bdayUser.fullName}'s birthday (dob) to today (${dob.toISOString()}).`);
    }

    if (members.length > 1) {
      // Set second member's work anniversary to today (2 years ago)
      const annivUser = members[1];
      const joiningDate = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate());
      await User.findByIdAndUpdate(annivUser._id, { joiningDate });
      console.log(`Updated ${annivUser.fullName}'s anniversary (joiningDate) to today, 2 years ago (${joiningDate.toISOString()}).`);
    } else if (members.length > 0) {
      // If only 1 member, set their joiningDate as well so they celebrate both
      const user = members[0];
      const joiningDate = new Date(today.getFullYear() - 3, today.getMonth(), today.getDate());
      await User.findByIdAndUpdate(user._id, { joiningDate });
      console.log(`Updated ${user.fullName}'s anniversary to today, 3 years ago.`);
    }

    console.log('All test setup items written successfully!');

  } catch (err) {
    console.error('Setup failed with error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Database disconnected.');
  }
}

run();
