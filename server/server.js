import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Import Models
import User from './models/User.js';
import Message from './models/Message.js';
import Notification from './models/Notification.js';
import Task from './models/Task.js';
import Session from './models/Session.js';

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

// Bind io to app for use in routes
app.set('io', io);

// Middlewares
app.use(cors());
app.use(express.json());

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Database Connection & Seeding
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

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected successfully.');
    await seedSuperAdmin();
    
    // Start listening on port
    server.listen(PORT, () => {
      console.log(`Express HRM Server running on port ${PORT}`);

      // Start 1-Hour Cron Job for Task End Dates
      setInterval(async () => {
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
            });

            for (const session of activeSessions) {
              const limitMins = session.sessionLimitMinutes !== undefined ? session.sessionLimitMinutes : (9 * 60);
              const limitMs = limitMins * 60 * 1000;
              const elapsedMs = Date.now() - session.clockIn.getTime();

              if (elapsedMs >= limitMs) {
                const clockOutTime = new Date(session.clockIn.getTime() + limitMs);
                
                // Auto-conclude breaks if still open
                session.breaks.forEach((b) => {
                  if (!b.endedAt) {
                    b.endedAt = clockOutTime;
                  }
                });

                // Calculate break times and excess limit deductions
                let totalBreaksMinutes = 0;
                session.breaks.forEach((b) => {
                  const ended = b.endedAt;
                  const actualDurationMs = ended - b.startedAt;
                  const actualDurationMins = Math.round(actualDurationMs / 60000);
                  const excessMins = Math.max(0, actualDurationMins - b.duration);
                  totalBreaksMinutes += (actualDurationMins + excessMins);
                });

                const netWorkingMins = Math.max(0, limitMins - totalBreaksMinutes);

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

                // Create notification for operator
                const limitHours = (limitMins / 60).toFixed(1);
                const notif = new Notification({
                  recipientId: session.userId,
                  type: 'system',
                  title: 'Auto Shift Termination Alert',
                  message: `Your shift has been automatically terminated as it exceeded the ${limitHours}-hour limit. Admin approval is pending.`,
                  link: '/dashboard/clock'
                });
                await notif.save();

                // Emit real-time WebSockets
                const ioInstance = app.get('io');
                if (ioInstance) {
                  ioInstance.to(session.userId.toString()).emit('new-notification', notif);
                  ioInstance.emit('clock-status-changed', { userId: session.userId, session });
                }
              }
            }
          } catch (shiftErr) {
            console.error('Error running shift auto-termination cron:', shiftErr);
          }
        } catch (error) {
          console.error('Error running task cron:', error);
        }
      }, 60000); // Check every 60 seconds
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

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

// Socket.io WebSocket Connections for Chat
io.on('connection', (socket) => {
  console.log('WebSocket client connected:', socket.id);

  // Join a room (can be teamId or composite personal room)
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
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
  socket.on('call-user', (data) => {
    // data = { userToCall, signalData, from, name, type }
    io.to(data.userToCall).emit('incoming-call', { 
      signal: data.signalData, 
      from: data.from, 
      name: data.name,
      type: data.type || 'video'
    });
  });

  socket.on('answer-call', (data) => {
    io.to(data.to).emit('call-accepted', data.signal);
  });

  socket.on('end-call', (data) => {
    io.to(data.to).emit('call-ended');
  });

  socket.on('reject-call', (data) => {
    io.to(data.to).emit('call-rejected');
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

  socket.on('disconnect', () => {
    console.log('WebSocket client disconnected:', socket.id);
  });
});
// Nodemon refresh trigger
