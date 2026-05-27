import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/auth/login
// @desc    Log in a user, admin, or superadmin
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Please provide both username and password' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Sign Token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'super_secret_key_markdotintellect_hrm_2026',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
        employeeId: user.employeeId,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login', error: error.message });
  }
});

// @route   GET /api/auth/me
// @desc    Get currently logged in user info
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching user profiles', error: error.message });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change password of currently logged in user (resettable password requirement)
router.post('/change-password', verifyToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: 'Please provide old and new passwords' });
  }

  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Old password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error changing password', error: error.message });
  }
});

// @route   POST /api/auth/forgot-password-request
// @desc    User submits a forgotten-password request — creates a notification for the superadmin
router.post('/forgot-password-request', async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ message: 'Please provide your username.' });
  }

  try {
    // Verify the requesting user actually exists
    const requestingUser = await User.findOne({ username });
    if (!requestingUser) {
      // Return a generic message to avoid username enumeration
      return res.json({ message: 'If that username exists, a request has been sent to the administrator.' });
    }

    // Find the superadmin to notify
    const superAdmin = await User.findOne({ role: 'superadmin' });

    // Find the admin to notify (assigned admin first, then fallback to any active admin)
    let adminToNotify = null;
    if (requestingUser.assignedAdmin) {
      adminToNotify = await User.findOne({ _id: requestingUser.assignedAdmin, role: 'admin' });
    }
    if (!adminToNotify) {
      adminToNotify = await User.findOne({ role: 'admin' });
    }

    // Collect all unique administrative recipient IDs
    const recipients = new Set();
    if (superAdmin) {
      recipients.add(superAdmin._id.toString());
    }
    if (adminToNotify) {
      recipients.add(adminToNotify._id.toString());
    }

    if (recipients.size === 0) {
      return res.status(500).json({ message: 'Unable to reach administrator. No active administrative operator is registered.' });
    }

    // Create the notification in DB and emit real-time WebSockets
    const Notification = (await import('../models/Notification.js')).default;
    const io = req.app.get('io');

    for (const recipientId of recipients) {
      const notif = await Notification.create({
        recipientId,
        type: 'password_reset',
        title: 'Password Reset Request',
        message: `User "${requestingUser.fullName || username}" (${username}) has requested a password reset. Please update their password manually.`,
        link: '/dashboard',
      });

      if (io) {
        io.to(recipientId).emit('new-notification', notif);
      }
    }

    res.json({ message: 'Your request has been sent to the administrator. Please wait for assistance.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error processing request', error: error.message });
  }
});

export default router;
