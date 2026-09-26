import express from 'express';
import mongoose from 'mongoose';
import Kudos from '../models/Kudos.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/kudos - Get recent kudos feed
router.get('/', verifyToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }
    const { limit = 30 } = req.query;
    const kudos = await Kudos.find()
      .populate('senderId', 'fullName jobTitle employeeId')
      .populate('receiverId', 'fullName jobTitle employeeId')
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json(kudos || []);
  } catch (error) {
    console.error('Error fetching kudos feed:', error);
    res.json([]);
  }
});

// GET /api/kudos/leaderboard - Top recognized users
router.get('/leaderboard', verifyToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }
    const leaderboard = await Kudos.aggregate([
      {
        $group: {
          _id: '$receiverId',
          totalPoints: { $sum: '$points' },
          kudosCount: { $sum: 1 },
          badges: { $push: '$badge' },
        },
      },
      { $sort: { totalPoints: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          totalPoints: 1,
          kudosCount: 1,
          badges: 1,
          'user.fullName': 1,
          'user.jobTitle': 1,
          'user.employeeId': 1,
          'user.role': 1,
        },
      },
    ]);

    res.json(leaderboard || []);
  } catch (error) {
    console.error('Error fetching kudos leaderboard:', error);
    res.json([]);
  }
});

// GET /api/kudos/stats - User's kudos stats
router.get('/stats', verifyToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ receivedCount: 0, sentCount: 0, totalPoints: 0, badgeCounts: {} });
    }
    const userId = req.user.userId;

    const received = await Kudos.find({ receiverId: userId });
    const sent = await Kudos.countDocuments({ senderId: userId });

    const totalPoints = received.reduce((acc, curr) => acc + (curr.points || 0), 0);
    const badgeCounts = received.reduce((acc, curr) => {
      acc[curr.badge] = (acc[curr.badge] || 0) + 1;
      return acc;
    }, {});

    res.json({
      receivedCount: received.length,
      sentCount: sent,
      totalPoints,
      badgeCounts,
    });
  } catch (error) {
    console.error('Error fetching kudos stats:', error);
    res.json({ receivedCount: 0, sentCount: 0, totalPoints: 0, badgeCounts: {} });
  }
});

// POST /api/kudos - Send kudos to a peer
router.post('/', verifyToken, async (req, res) => {
  try {
    const { receiverId, badge, message, points } = req.body;
    const senderId = req.user.userId;

    if (!receiverId || !badge || !message) {
      return res.status(400).json({ message: 'Receiver, badge, and message are required.' });
    }

    if (senderId.toString() === receiverId.toString()) {
      return res.status(400).json({ message: 'You cannot give kudos to yourself.' });
    }

    const kudosPoints = Number(points) || 10;

    const kudos = new Kudos({
      senderId,
      receiverId,
      badge,
      message,
      points: kudosPoints,
    });

    await kudos.save();

    const populatedKudos = await Kudos.findById(kudos._id)
      .populate('senderId', 'fullName jobTitle employeeId')
      .populate('receiverId', 'fullName jobTitle employeeId');

    // Create system notification for receiver
    const notif = new Notification({
      recipientId: receiverId,
      type: 'system',
      title: '🏆 You Received Kudos!',
      message: `${populatedKudos.senderId.fullName} awarded you "${badge}" (+${kudosPoints} pts)`,
      link: '/dashboard/kudos',
    });
    await notif.save();

    // Emit Socket.io event for real-time celebration
    const io = req.app.get('io');
    if (io) {
      io.to(receiverId.toString()).emit('new-notification', notif);
      io.emit('kudos-broadcast', populatedKudos);
    }

    res.status(201).json(populatedKudos);
  } catch (error) {
    console.error('Error creating kudos:', error);
    res.status(500).json({ message: 'Failed to send kudos.', error: error.message });
  }
});

export default router;
