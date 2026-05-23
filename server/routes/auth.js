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

// @route   POST /api/auth/reset-superadmin-recovery
// @desc    Open recovery route to reset superadmin back to default credentials
router.post('/reset-superadmin-recovery', async (req, res) => {
  try {
    let superadmin = await User.findOne({ username: 'superadmin' });
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Mrkd0t@Sup3r!', salt);

    if (superadmin) {
      superadmin.password = hashedPassword;
      await superadmin.save();
    } else {
      superadmin = new User({
        username: 'superadmin',
        password: hashedPassword,
        role: 'superadmin',
        fullName: 'Super Admin',
        email: 'superadmin@markdotintellect.com',
        employeeId: 'EMP001',
        employmentType: 'fulltime',
      });
      await superadmin.save();
    }
    res.json({ message: 'Superadmin password reset to default.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error resetting superadmin', error: error.message });
  }
});

export default router;
