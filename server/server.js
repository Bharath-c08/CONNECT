import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import Models
import User from './models/User.js';
import Message from './models/Message.js';
import Notification from './models/Notification.js';
import Task from './models/Task.js';
import Session from './models/Session.js';
import LeaveCategory from './models/LeaveCategory.js';
import BreakType from './models/BreakType.js';
import { calculateNetWorkingMinutes } from './utils/shift.js';
import { getShiftTimeInUTC } from './utils/timezone.js';
import { runRecalculation } from './recalculate_durations.js';
import { syncJobRoleTeams } from './utils/teams.js';

// Import Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import clockRoutes from './routes/clock.js';
import leaveRoutes from './routes/leaves.js';
import teamRoutes from './routes/teams.js';
import taskRoutes from './routes/tasks.js';
import chatRoutes from './routes/chats.js';
import notificationRoutes from './routes/notifications.js';
import meetingRoutes from './routes/meetings.js';
import eventRoutes from './routes/events.js';
import kudosRoutes from './routes/kudos.js';
import okrRoutes from './routes/okrs.js';
import reviewRoutes from './routes/reviews.js';
import aiRoutes from './routes/ai.js';
import documentRoutes from './routes/documents.js';
import monitorRoutes from './routes/monitor.js';

// Initialize Dotenv
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow connection from Next.js local client
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Track online users mapping: userId -> Set of socket.ids
const onlineUsers = new Map();

// Bind io and onlineUsers to app for use in routes
app.set('io', io);
app.set('onlineUsers', onlineUsers);

// Middlewares
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Bind API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clock', clockRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/kudos', kudosRoutes);
app.use('/api/okrs', okrRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/monitor', monitorRoutes);

// Serve compiled Android app APK
app.get('/Dotcore.apk', (req, res) => {
  res.sendFile(path.join(__dirname, 'Dotcore.apk'));
});
app.get('/app.apk', (req, res) => {
  res.sendFile(path.join(__dirname, 'Dotcore.apk'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Database Connection & Seeding
// Database Connection & Server Listening Logic
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('CRITICAL: MONGODB_URI environment variable is missing from server/.env');
  process.exit(1);
}

if (!process.env.SUPER_ADMIN_PASSWORD) {
  console.error('CRITICAL: SUPER_ADMIN_PASSWORD environment variable is missing from server/.env');
  process.exit(1);
}

// Start HTTP server immediately so routes are available
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Express HRM Server running on port ${PORT}`);
  connectDatabase();
  startCronJobs();
});

async function connectDatabase() {
  const LOCAL_URI = 'mongodb://127.0.0.1:27017/connect_hrm';
  try {
    console.log('Attempting MongoDB Atlas connection...');
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('MongoDB Atlas connected successfully.');
    await onDbConnected();
  } catch (atlasErr) {
    console.warn('MongoDB Atlas connection failed:', atlasErr.message);
    console.log('Attempting local MongoDB connection (mongodb://127.0.0.1:27017/connect_hrm)...');
    try {
      await mongoose.connect(LOCAL_URI, { serverSelectionTimeoutMS: 5000 });
      console.log('Local MongoDB connected successfully.');
      await onDbConnected();
    } catch (localErr) {
      console.error('CRITICAL: Unable to connect to MongoDB Atlas or Local MongoDB.', localErr.message);
    }
  }
}

async function onDbConnected() {
  try {
    await seedSuperAdmin();
    await seedDefaultLeaveCategories();
    runRecalculation().catch(err => console.error('Recalculation on startup failed:', err));
    syncJobRoleTeams().catch(err => console.error('Initial team synchronization failed:', err));
  } catch (err) {
    console.error('Error post-database connection init:', err);
  }
}

function startCronJobs() {
  setInterval(async () => {
    if (mongoose.connection.readyState !== 1) return; // Skip if DB not connected
    try {
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      
      const impendingTasks = await Task.find({
        status: 'in-progress',
        endDate: { $gt: now, $lte: oneHourFromNow },
        oneHourAlertSent: false
      });

      for (const task of impendingTasks) {
        for (const userId of task.assignedTo) {
          const notif = new Notification({
            recipientId: userId,
            type: 'system',
            title: 'Mission Deadline Approaching',
            message: `Mission ${task.title} is ending in less than 1 hour.`,
            link: '/dashboard/tasks'
          });
          await notif.save();
          const ioInstance = app.get('io');
          if (ioInstance) {
            ioInstance.to(userId.toString()).emit('new-notification', notif);
          }
        }
        task.oneHourAlertSent = true;
        await task.save();
      }
      
      // Dynamic Automatic Shift Termination Cron Job
      try {
        const activeSessions = await Session.find({
          status: { $in: ['active', 'on_break'] }
        }).populate('userId');

        for (const session of activeSessions) {
          if (!session.userId) continue;
          const user = session.userId;

          const timezone = session.timezone || 'Asia/Kolkata';

          const [startHrs, startMins] = (user.shiftStartTime || '09:00').split(':').map(Number);
          const [endHrs, endMins] = (user.shiftEndTime || '17:00').split(':').map(Number);
          
          const shiftEndTime = getShiftTimeInUTC(session.clockIn, user.shiftEndTime || '17:00', timezone);
          const autoClockOutTime = new Date(shiftEndTime.getTime() + 5 * 60 * 1000);

          if (Date.now() >= autoClockOutTime.getTime()) {
            const clockOutTime = autoClockOutTime;
            
            session.breaks.forEach((b) => {
              if (!b.endedAt) {
                b.endedAt = clockOutTime;
              }
            });

            const userBreakLimit = user.breakLimitMinutes !== undefined ? user.breakLimitMinutes : 0;

            const netWorkingMins = calculateNetWorkingMinutes(
              session.clockIn,
              clockOutTime,
              userBreakLimit
            );

            session.clockOut = clockOutTime;
            session.duration = netWorkingMins;
            session.overtimeMinutes = 0;
            session.regularPay = 0;
            session.overtimePay = 0;
            session.status = 'completed';
            session.needsApproval = true;
            session.approvalStatus = 'pending';
            session.autoClockedOut = true;

            await session.save();

            let limitMins = (endHrs * 60 + endMins) - (startHrs * 60 + startMins);
            if (limitMins < 0) limitMins += 24 * 60;
            const limitHours = (limitMins / 60).toFixed(1);

            const notif = new Notification({
              recipientId: session.userId._id,
              type: 'system',
              title: 'Auto Shift Termination Alert',
              message: `Your shift has been automatically terminated as it exceeded the ${limitHours}-hour limit. Admin approval is pending.`,
              link: '/dashboard/clock'
            });
            await notif.save();

            const ioInstance = app.get('io');
            if (ioInstance) {
              ioInstance.to(session.userId._id.toString()).emit('new-notification', notif);
              ioInstance.emit('clock-status-changed', { userId: session.userId._id, session });
            }
          }
        }
      } catch (shiftErr) {
        console.error('Error running shift auto-termination cron:', shiftErr);
      }
    } catch (error) {
      console.error('Error running task cron:', error);
    }
  }, 60000);
}

// Super Admin Seeding logic
async function seedSuperAdmin() {
  try {
    const superAdminExists = await User.findOne({ role: 'superadmin' });
    if (!superAdminExists) {
      console.log('No superadmin found. Seeding default superadmin...');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD, salt);

      const defaultSuperAdmin = new User({
        username: process.env.SUPER_ADMIN_USERNAME || 'superadmin',
        password: hashedPassword,
        role: 'superadmin',
        fullName: 'System Super Admin',
        email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@markdotintellect.com',
        employeeId: 'EMP000',
        employmentType: 'fulltime',
        jobTitle: 'Chief Administrator',
        joiningDate: new Date(),
        dob: new Date('1990-01-01'),
        gender: 'other',
        address: 'MarkdotIntellect Corporate HQ',
        phone: '+1000000000',
        basicPay: 0,
        overtimeEligible: false,
        overtimePayPerMinute: 0,
      });

      await defaultSuperAdmin.save();
      console.log('Default superadmin seeded successfully.');
    } else {
      console.log('Superadmin already seeded in database.');
    }
  } catch (error) {
    console.error('Error seeding default superadmin:', error);
  }
}

// Seeding Default Leave Categories
async function seedDefaultLeaveCategories() {
  try {
    const categoryCount = await LeaveCategory.countDocuments();
    if (categoryCount === 0) {
      console.log('No leave categories found. Seeding default categories...');
      const defaultCategories = [
        { name: 'sick', label: 'Sick Leave Protocol', defaultDays: 10, isActive: true },
        { name: 'casual', label: 'Casual Disconnect', defaultDays: 10, isActive: true },
        { name: 'annual', label: 'Annual Departure (Vacation)', defaultDays: 15, isActive: true },
        { name: 'unpaid', label: 'Unpaid Sleep Mode', defaultDays: 365, isActive: true },
        { name: 'other', label: 'Other / Emergency Cooldown', defaultDays: 10, isActive: true }
      ];
      await LeaveCategory.insertMany(defaultCategories);
      console.log('Default leave categories seeded successfully.');
    }
  } catch (error) {
    console.error('Error seeding default leave categories:', error);
  }
}

// Socket.io WebSocket Connections for Chat & Monitoring
io.on('connection', (socket) => {
  console.log('WebSocket client connected:', socket.id);

  // Register user and track active session
  socket.on('register-user', (userId) => {
    if (!userId) return;
    const uid = userId.toString();
    if (!onlineUsers.has(uid)) {
      onlineUsers.set(uid, new Set());
    }
    onlineUsers.get(uid).add(socket.id);
    socket.userId = uid;
    socket.join(uid);
    
    // Broadcast active users list to all clients
    io.emit('active-users-list', Array.from(onlineUsers.keys()));
    console.log(`User registered: ${uid}. Active users count: ${onlineUsers.size}`);
  });

  // Join a room (can be teamId or composite personal room)
  socket.on('join-room', (roomId) => {
    if (!roomId) return;
    const rid = roomId.toString();
    socket.join(rid);
    console.log(`Socket ${socket.id} joined room ${rid}`);
  });

  // Handle message sending
  socket.on('send-message', async (data) => {
    const { senderId, recipientId, teamId, content } = data;

    if (!senderId || !content) {
      return console.error('Invalid message format received');
    }

    try {
      // Create and save to DB
      const newMessage = new Message({
        senderId,
        recipientId: recipientId || null,
        teamId: teamId || null,
        content,
      });
      await newMessage.save();

      // Populate sender profile info to show in UI
      const populatedMessage = await Message.findById(newMessage._id).populate(
        'senderId',
        'fullName employeeId jobTitle role'
      );

      // Determine which room to broadcast
      if (teamId) {
        // Team chat: broadcast to all room members
        io.to(teamId).emit('receive-message', populatedMessage);
      } else if (recipientId) {
        // Direct chat: broadcast to both sender and receiver rooms
        io.to(senderId).emit('receive-message', populatedMessage);
        io.to(recipientId).emit('receive-message', populatedMessage);

        // Create a notification for the recipient
        const notif = new Notification({
          recipientId,
          type: 'message',
          title: 'New Message',
          message: `${populatedMessage.senderId.fullName} sent you a message.`,
          link: '/dashboard/chat'
        });
        await notif.save();
        io.to(recipientId).emit('new-notification', notif);
      }
    } catch (error) {
      console.error('Error saving or emitting socket message:', error);
    }
  });

  // WebRTC Signaling Events
  socket.on('call-user', async (data) => {
    // data = { userToCall, signalData, from, name, type }
    io.to(data.userToCall).emit('incoming-call', { 
      signal: data.signalData, 
      from: data.from, 
      name: data.name,
      type: data.type || 'video'
    });

    // Create a call notification in database so background sync/polling picks it up
    try {
      // Clean up any stale call notifications for this recipient first
      await Notification.deleteMany({ recipientId: data.userToCall, type: 'call' });

      const notif = new Notification({
        recipientId: data.userToCall,
        type: 'call',
        title: 'Incoming Call',
        message: `${data.name} is calling you...`,
        link: `/dashboard/chat?callFrom=${data.from}&callType=${data.type || 'video'}`,
        signalData: JSON.stringify(data.signalData)
      });
      await notif.save();
      io.to(data.userToCall).emit('new-notification', notif);
    } catch (err) {
      console.error('Error saving call notification:', err);
    }
  });

  socket.on('answer-call', async (data) => {
    io.to(data.to).emit('call-accepted', data.signal);

    // Remove call notification on answer
    try {
      await Notification.deleteMany({ recipientId: socket.userId || data.to, type: 'call' });
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('end-call', async (data) => {
    io.to(data.to).emit('call-ended');

    // Remove call notifications
    try {
      await Notification.deleteMany({ recipientId: data.to, type: 'call' });
      if (socket.userId) {
        await Notification.deleteMany({ recipientId: socket.userId, type: 'call' });
      }
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('reject-call', async (data) => {
    io.to(data.to).emit('call-rejected');

    // Remove call notifications
    try {
      await Notification.deleteMany({ recipientId: socket.userId || data.to, type: 'call' });
      await Notification.deleteMany({ recipientId: data.to, type: 'call' });
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('ice-candidate', (data) => {
    io.to(data.to).emit('ice-candidate', data.candidate);
  });

  // MARKDOT_MEET Multi-peer Signaling Events
  socket.on('join-meeting', ({ meetingId, userId, userName }) => {
    socket.join(meetingId);
    console.log(`Operator ${userName} joined meet room: ${meetingId}`);
    socket.to(meetingId).emit('peer-joined', { userId, userName, socketId: socket.id });
  });

  socket.on('meeting-signal', ({ toSocketId, signal, fromSocketId, fromUserId, fromUserName }) => {
    io.to(toSocketId).emit('meeting-signal', {
      signal,
      fromSocketId,
      fromUserId,
      fromUserName
    });
  });

  socket.on('ice-candidate-meeting', ({ toSocketId, candidate, fromSocketId }) => {
    io.to(toSocketId).emit('ice-candidate-meeting', {
      candidate,
      fromSocketId
    });
  });

  socket.on('leave-meeting', ({ meetingId, userId, socketId }) => {
    socket.leave(meetingId);
    socket.to(meetingId).emit('peer-left', { userId, socketId });
  });

  // ── SUPER ADMIN REAL-TIME CAMERA SURVEILLANCE & PERFORMANCE MONITORING ──
  socket.on('monitor-request-camera', ({ targetUserId, adminId, adminName }) => {
    console.log(`[MONITOR] Superadmin ${adminName || adminId} requesting camera of user ${targetUserId}`);
    if (!targetUserId) return;
    const targetIdStr = targetUserId.toString();

    const sockets = onlineUsers.get(targetIdStr);
    const hasSockets = sockets && sockets.size > 0;

    // Emit to user's room
    io.to(targetIdStr).emit('monitor-camera-requested', {
      adminId: adminId || socket.userId,
      adminSocketId: socket.id,
      adminName: adminName || 'Super Administrator'
    });

    // Also emit to all direct socket IDs registered to this user
    if (hasSockets) {
      sockets.forEach((sockId) => {
        io.to(sockId).emit('monitor-camera-requested', {
          adminId: adminId || socket.userId,
          adminSocketId: socket.id,
          adminName: adminName || 'Super Administrator'
        });
      });
    } else {
      console.log(`[MONITOR] Target user ${targetIdStr} is currently offline`);
      socket.emit('monitor-camera-error', {
        userId: targetIdStr,
        error: 'Operator is offline. They must be logged in on their workstation with the dashboard open.'
      });
    }
  });

  socket.on('monitor-camera-accepted', ({ adminSocketId, adminId, userId, userName }) => {
    console.log(`[MONITOR] User ${userId} accepted camera request from admin ${adminId || adminSocketId}`);
    if (adminSocketId) {
      io.to(adminSocketId).emit('monitor-camera-ready', { userId, userName, userSocketId: socket.id });
    } else if (adminId) {
      io.to(adminId.toString()).emit('monitor-camera-ready', { userId, userName, userSocketId: socket.id });
    }
  });

  socket.on('monitor-camera-frame', ({ targetAdminId, adminSocketId, userId, frameData, timestamp, stats }) => {
    // Relay live snapshot frame to superadmin
    if (adminSocketId) {
      io.to(adminSocketId).emit('monitor-camera-frame', { userId, frameData, timestamp, stats });
    } else if (targetAdminId) {
      io.to(targetAdminId.toString()).emit('monitor-camera-frame', { userId, frameData, timestamp, stats });
    }
  });

  socket.on('monitor-camera-error', ({ targetAdminId, adminSocketId, userId, error }) => {
    console.log(`[MONITOR] Camera error for user ${userId}:`, error);
    if (adminSocketId) {
      io.to(adminSocketId).emit('monitor-camera-error', { userId, error });
    } else if (targetAdminId) {
      io.to(targetAdminId.toString()).emit('monitor-camera-error', { userId, error });
    }
  });

  socket.on('monitor-stop-camera', ({ targetUserId }) => {
    console.log(`[MONITOR] Superadmin stopping camera of user ${targetUserId}`);
    io.to(targetUserId).emit('monitor-camera-stopped', { stoppedBy: socket.userId });
  });

  socket.on('monitor-webrtc-offer', ({ targetUserId, signal, fromAdminId }) => {
    io.to(targetUserId).emit('monitor-webrtc-offer', {
      signal,
      fromAdminId,
      adminSocketId: socket.id
    });
  });

  socket.on('monitor-webrtc-answer', ({ targetAdminSocketId, targetAdminId, signal, userId }) => {
    if (targetAdminSocketId) {
      io.to(targetAdminSocketId).emit('monitor-webrtc-answer', { signal, userId });
    } else if (targetAdminId) {
      io.to(targetAdminId).emit('monitor-webrtc-answer', { signal, userId });
    }
  });

  socket.on('monitor-ice-candidate', ({ targetSocketId, targetUserId, candidate }) => {
    if (targetSocketId) {
      io.to(targetSocketId).emit('monitor-ice-candidate', { candidate, fromSocketId: socket.id });
    } else if (targetUserId) {
      io.to(targetUserId).emit('monitor-ice-candidate', { candidate, fromSocketId: socket.id });
    }
  });

  socket.on('monitor-send-nudge', async ({ targetUserId, message, type, title }) => {
    try {
      const notif = new Notification({
        recipientId: targetUserId,
        type: 'system',
        title: title || 'Supervisor Performance Alert',
        message: message,
        link: '/dashboard'
      });
      await notif.save();
      io.to(targetUserId).emit('new-notification', notif);
      io.to(targetUserId).emit('monitor-nudge-received', {
        title: title || 'Supervisor Performance Alert',
        message,
        type: type || 'warning',
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error sending monitor nudge:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('WebSocket client disconnected:', socket.id);
    if (socket.userId) {
      const userSockets = onlineUsers.get(socket.userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(socket.userId);
        }
      }
      // Broadcast updated online list to everyone
      io.emit('active-users-list', Array.from(onlineUsers.keys()));
      console.log(`User offline: ${socket.userId}. Active users count: ${onlineUsers.size}`);
    }
  });
});
// Nodemon refresh trigger
