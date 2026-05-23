import express from 'express';
import Notification from '../models/Notification.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Apply verifyToken middleware to all routes in this file
router.use(verifyToken);

// Get my notifications
router.get('/my', async (req, res) => {
  try {
    const userId = req.user.userId;
    const notifications = await Notification.find({ recipientId: userId })
      .sort({ createdAt: -1 })
      .limit(50);
      
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark one as read
router.put('/:id/read', async (req, res) => {
  try {
    const notif = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    res.json(notif);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark all as read
router.put('/my/read-all', async (req, res) => {
  try {
    const userId = req.user.userId;
    await Notification.updateMany(
      { recipientId: userId, isRead: false },
      { isRead: true }
    );
    res.json({ message: 'All marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all
router.delete('/my/clear', async (req, res) => {
  try {
    const userId = req.user.userId;
    await Notification.deleteMany({ recipientId: userId });
    res.json({ message: 'Notifications cleared' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
