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

// @route   DELETE /api/chats/:messageId
// @desc    Delete a message (sender, admin, or superadmin)
router.delete('/:messageId', verifyToken, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found.' });
    }

    // Verify ownership: sender or admin/superadmin
    const isSender = message.senderId.toString() === req.user.userId;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';

    if (!isSender && !isAdmin) {
      return res.status(403).json({ message: 'Access denied. You can only delete your own messages.' });
    }

    await Message.findByIdAndDelete(req.params.messageId);

    // Emit real-time deletion over WebSocket
    const io = req.app.get('io');
    if (io) {
      if (message.teamId) {
        io.to(message.teamId.toString()).emit('message-deleted', message._id.toString());
      } else if (message.recipientId) {
        io.to(message.senderId.toString()).emit('message-deleted', message._id.toString());
        io.to(message.recipientId.toString()).emit('message-deleted', message._id.toString());
      }
    }

    res.json({ message: 'Message deleted successfully.', messageId: message._id });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting message', error: error.message });
  }
});

export default router;
