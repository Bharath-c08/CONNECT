import express from 'express';
import Session from '../models/Session.js';
import User from '../models/User.js';
import { verifyToken, isAdminOrSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/clock/status
// @desc    Get the current user's clocking status
router.get('/status', verifyToken, async (req, res) => {
  try {
    const activeSession = await Session.findOne({
      userId: req.user.userId,
      status: 'active',
    });

    if (activeSession) {
      return res.json({ clockedIn: true, session: activeSession });
    }
    res.json({ clockedIn: false, session: null });
  } catch (error) {
    res.status(500).json({ message: 'Error checking clock status', error: error.message });
  }
});

// @route   POST /api/clock/in
// @desc    Start a clock-in session
router.post('/in', verifyToken, async (req, res) => {
  const { location } = req.body;

  try {
    // Check for an existing active session
    const activeSession = await Session.findOne({
      userId: req.user.userId,
      status: 'active',
    });

    if (activeSession) {
      return res.status(400).json({ message: 'You are already clocked in.' });
    }

    const newSession = new Session({
      userId: req.user.userId,
      clockIn: new Date(),
      location: location || null,
      status: 'active',
    });

    await newSession.save();
    res.status(201).json({ message: 'Clocked in successfully', session: newSession });
  } catch (error) {
    res.status(500).json({ message: 'Error during clock in', error: error.message });
  }
});

// @route   POST /api/clock/out
// @desc    End a clock-in session and compute pay + overtime
router.post('/out', verifyToken, async (req, res) => {
  try {
    const activeSession = await Session.findOne({
      userId: req.user.userId,
      status: 'active',
    });

    if (!activeSession) {
      return res.status(400).json({ message: 'No active clock-in session found.' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const clockOutTime = new Date();
    const durationMs = clockOutTime - activeSession.clockIn;
    const durationMinutes = Math.max(1, Math.round(durationMs / 60000)); // Round to nearest minute (minimum 1 minute)

    let regularMinutes = durationMinutes;
    let overtimeMinutes = 0;

    // Shift length threshold: 8 hours (480 minutes)
    const standardShiftMinutes = 480;

    if (user.overtimeEligible && durationMinutes > standardShiftMinutes) {
      regularMinutes = standardShiftMinutes;
      overtimeMinutes = durationMinutes - standardShiftMinutes;
    }

    // Convert basic monthly pay (Rupees per month) to per-minute rate by assuming standard 176 working hours per month (22 days * 8 hours)
    const monthlySalary = user.basicPay || 0;
    const hourlyPay = monthlySalary / 176;
    const payPerMinute = hourlyPay / 60;

    const regularPay = Math.round(regularMinutes * payPerMinute * 100) / 100;
    const overtimePay = Math.round(overtimeMinutes * (user.overtimePayPerMinute || 0) * 100) / 100;

    activeSession.clockOut = clockOutTime;
    activeSession.duration = durationMinutes;
    activeSession.overtimeMinutes = overtimeMinutes;
    activeSession.regularPay = regularPay;
    activeSession.overtimePay = overtimePay;
    activeSession.status = 'completed';

    await activeSession.save();

    res.json({
      message: 'Clocked out successfully',
      session: activeSession,
      summary: {
        totalHours: (durationMinutes / 60).toFixed(2),
        regularPay,
        overtimeMinutes,
        overtimePay,
        totalPay: Math.round((regularPay + overtimePay) * 100) / 100,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error during clock out', error: error.message });
  }
});

// @route   GET /api/clock/history
// @desc    Get the clock-in history of the logged in user
router.get('/history', verifyToken, async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user.userId }).sort({ clockIn: -1 });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching shift history', error: error.message });
  }
});

// @route   GET /api/clock/admin/roster
// @desc    Get all timesheet history (Restricted to Admins)
router.get('/admin/roster', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  const { userId, startDate, endDate } = req.query;

  const query = {};
  if (userId) query.userId = userId;

  if (startDate || endDate) {
    query.clockIn = {};
    if (startDate) query.clockIn.$gte = new Date(startDate);
    if (endDate) query.clockIn.$lte = new Date(endDate);
  }

  try {
    const sessions = await Session.find(query)
      .populate('userId', 'fullName employeeId jobTitle role')
      .sort({ clockIn: -1 });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving master roster', error: error.message });
  }
});

// @route   GET /api/clock/admin/live
// @desc    Get all currently clocked-in employees (Restricted to Admins)
router.get('/admin/live', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const liveSessions = await Session.find({ status: 'active' })
      .populate('userId', 'fullName employeeId jobTitle role email phone')
      .sort({ clockIn: -1 });
    res.json(liveSessions);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving active employee roster', error: error.message });
  }
});

export default router;
