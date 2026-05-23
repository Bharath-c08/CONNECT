import express from 'express';
import Message from '../models/Message.js';
import Team from '../models/Team.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/chats/team/:teamId
// @desc    Retrieve chat history for a team channel (User must be a member or admin)
router.get('/team/:teamId', verifyToken, async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) {
      return res.status(404).json({ message: 'Team channel not found.' });
    }

    const isMember = team.members.includes(req.user.userId) || team.admins.includes(req.user.userId);
    const isStaff = req.user.role === 'admin' || req.user.role === 'superadmin';

    if (!isMember && !isStaff) {
      return res.status(403).json({ message: 'Access denied. You are not a member of this team.' });
    }

    const messages = await Message.find({ teamId: req.params.teamId })
      .populate('senderId', 'fullName employeeId jobTitle role')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving team chats', error: error.message });
  }
});

// @route   GET /api/chats/direct/:otherUserId
// @desc    Retrieve direct messaging history between logged-in user and another employee
router.get('/direct/:otherUserId', verifyToken, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { senderId: req.user.userId, recipientId: req.params.otherUserId },
        { senderId: req.params.otherUserId, recipientId: req.user.userId },
      ],
    })
      .populate('senderId', 'fullName employeeId jobTitle role')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving direct chats', error: error.message });
  }
});

export default router;
