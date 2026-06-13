import express from 'express';
import Session from '../models/Session.js';
import User from '../models/User.js';
import BreakType from '../models/BreakType.js';
import { verifyToken, isAdminOrSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/clock/status
// @desc    Get the current user's clocking status and shift limit telemetry rules
router.get('/status', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User profile not found.' });
    }

    const activeSession = await Session.findOne({
      userId: req.user.userId,
      status: { $in: ['active', 'on_break'] },
    });

    // Compute completed shift metrics for today in server local time
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const sessionsToday = await Session.find({
      userId: req.user.userId,
      clockIn: { $gte: todayStart, $lte: todayEnd }
    });

    let regularMinutesToday = 0;
    let otMinutesToday = 0;

    sessionsToday.forEach((s) => {
      if (s.status === 'completed') {
        if (s.shiftType === 'overtime') {
          otMinutesToday += s.duration || 0;
        } else {
          regularMinutesToday += s.duration || 0;
        }
      }
    });

    res.json({
      clockedIn: !!activeSession,
      session: activeSession,
      regularShiftLimit: user.regularShiftLimit ?? 8,
      otShiftLimit: user.otShiftLimit ?? 4,
      overtimeEligible: user.overtimeEligible ?? false,
      regularMinutesToday,
      otMinutesToday
    });
  } catch (error) {
    res.status(500).json({ message: 'Error checking clock status', error: error.message });
  }
});

// @route   POST /api/clock/in
// @desc    Start a clock-in session (Restricted to one active session at a time)
router.post('/in', verifyToken, async (req, res) => {
  const { location, shiftType } = req.body;
  const selectedType = shiftType || 'regular';

  try {
    // Check for an existing active session in case clocks mismatch
    const activeSession = await Session.findOne({
      userId: req.user.userId,
      status: { $in: ['active', 'on_break'] },
    });

    if (activeSession) {
      return res.status(400).json({ message: 'You already have an active shift session running.' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User profile not found.' });
    }

    // Compute completed shift metrics for today in server local time
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const sessionsToday = await Session.find({
      userId: req.user.userId,
      clockIn: { $gte: todayStart, $lte: todayEnd }
    });

    let regularMinutesToday = 0;
    let otMinutesToday = 0;

    sessionsToday.forEach((s) => {
      if (s.status === 'completed') {
        if (s.shiftType === 'overtime') {
          otMinutesToday += s.duration || 0;
        } else {
          regularMinutesToday += s.duration || 0;
        }
      }
    });

    const regLimitMins = (user.regularShiftLimit ?? 8) * 60;
    const otLimitMins = (user.otShiftLimit ?? 4) * 60;
    let sessionLimitMinutes = 480; // default fallback

    if (selectedType === 'overtime') {
      if (!user.overtimeEligible) {
        return res.status(400).json({ message: 'You are not configured as eligible for Overtime (OT) shifts by the administrator.' });
      }
      if (regularMinutesToday < regLimitMins) {
        return res.status(400).json({
          message: `REGULAR_LIMIT_NOT_MET: You must complete your regular shift limit of ${user.regularShiftLimit} hours (currently at ${(regularMinutesToday / 60).toFixed(1)} hours) before you can clock in for Overtime (OT).`
        });
      }
      if (otMinutesToday >= otLimitMins) {
        return res.status(400).json({ message: `OT_LIMIT_EXHAUSTED: You have already completed your overtime shift limit of ${user.otShiftLimit} hours for today.` });
      }
      sessionLimitMinutes = otLimitMins - otMinutesToday;
    } else {
      if (regularMinutesToday >= regLimitMins) {
        return res.status(400).json({ message: `REGULAR_LIMIT_EXHAUSTED: You have already completed your regular shift limit of ${user.regularShiftLimit} hours for today. Please clock in using Overtime (OT) shift.` });
      }
      sessionLimitMinutes = regLimitMins - regularMinutesToday;
    }

    const newSession = new Session({
      userId: req.user.userId,
      clockIn: new Date(),
      location: location || null,
      shiftType: selectedType,
      sessionLimitMinutes,
      status: 'active',
    });

    await newSession.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('clock-status-changed', { userId: req.user.userId, session: newSession });
    }

    res.status(201).json({ message: 'Clocked in successfully', session: newSession });
  } catch (error) {
    res.status(500).json({ message: 'Error during clock in', error: error.message });
  }
});

// @route   POST /api/clock/out
// @desc    End a clock-in session without pay calculations
router.post('/out', verifyToken, async (req, res) => {
  try {
    const activeSession = await Session.findOne({
      userId: req.user.userId,
      status: { $in: ['active', 'on_break'] },
    });

    if (!activeSession) {
      return res.status(400).json({ message: 'No active shift session found.' });
    }

    const clockOutTime = new Date();

    // If operator clocks out while still on break, auto-conclude the break!
    if (activeSession.status === 'on_break') {
      const activeBreak = activeSession.breaks.find(b => !b.endedAt);
      if (activeBreak) {
        activeBreak.endedAt = clockOutTime;
      }
    }

    // Auto-conclude any other breaks if not ended
    activeSession.breaks.forEach((b) => {
      if (!b.endedAt) {
        b.endedAt = clockOutTime;
      }
    });

    const totalShiftMs = clockOutTime - activeSession.clockIn;
    const totalShiftMins = Math.max(1, Math.round(totalShiftMs / 60000));
    
    // Break time and break timings do not affect shift duration / net working time calculations
    const netWorkingMins = totalShiftMins;

    activeSession.clockOut = clockOutTime;
    activeSession.duration = netWorkingMins;
    activeSession.overtimeMinutes = 0;
    activeSession.regularPay = 0;
    activeSession.overtimePay = 0;
    activeSession.status = 'completed';

    await activeSession.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('clock-status-changed', { userId: req.user.userId, session: activeSession });
    }

    res.json({
      message: 'Clocked out successfully',
      session: activeSession,
      summary: {
        totalHours: (netWorkingMins / 60).toFixed(2),
        durationMinutes: netWorkingMins
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
    const liveSessions = await Session.find({ status: { $in: ['active', 'on_break'] } })
      .populate('userId', 'fullName employeeId jobTitle role email phone')
      .sort({ clockIn: -1 });
    res.json(liveSessions);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving active employee roster', error: error.message });
  }
});

// @route   GET /api/clock/admin/payslip-data
// @desc    Get aggregated timesheet data for a user in a given month/year for payslip generation
router.get('/admin/payslip-data', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  const { userId, month, year } = req.query;

  if (!userId || !month || !year) {
    return res.status(400).json({ message: 'userId, month, and year are required' });
  }

  const monthNum = parseInt(month, 10); // 1-12
  const yearNum  = parseInt(year,  10);

  const startDate = new Date(yearNum, monthNum - 1, 1);
  const endDate   = new Date(yearNum, monthNum, 1); // first day of next month

  try {
    const sessions = await Session.find({
      userId,
      clockIn: { $gte: startDate, $lt: endDate },
      status: 'completed',
      needsApproval: false,
      approvalStatus: { $ne: 'rejected' }
    });

    const employee = await User.findById(userId).select('-password');
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    let totalMinutes      = 0;
    let totalOTMinutes    = 0;
    let totalRegularPay   = 0;
    let totalOvertimePay  = 0;

    // Count unique working days
    const workingDaysSet = new Set();

    sessions.forEach((s) => {
      totalMinutes     += s.duration      || 0;
      totalOTMinutes   += s.overtimeMinutes || 0;
      totalRegularPay  += s.regularPay    || 0;
      totalOvertimePay += s.overtimePay   || 0;
      workingDaysSet.add(new Date(s.clockIn).toDateString());
    });

    res.json({
      employee,
      totalMinutes,
      totalOTMinutes,
      regularPay:   Math.round(totalRegularPay  * 100) / 100,
      overtimePay:  Math.round(totalOvertimePay * 100) / 100,
      workingDays:  workingDaysSet.size,
      sessionCount: sessions.length,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating payslip data', error: error.message });
  }
});

// @route   POST /api/clock/break/start
// @desc    Start a break during active shift
router.post('/break/start', verifyToken, async (req, res) => {
  const { breakType, duration } = req.body;
  if (!breakType || !duration) {
    return res.status(400).json({ message: 'Break type and duration are required.' });
  }

  try {
    const session = await Session.findOne({
      userId: req.user.userId,
      status: 'active'
    });

    if (!session) {
      return res.status(400).json({ message: 'No active shift session running. Please clock in first.' });
    }

    // Calculate how many minutes of this break type have already been consumed today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const sessionsToday = await Session.find({
      userId: req.user.userId,
      clockIn: { $gte: todayStart, $lte: todayEnd }
    });

    let consumedMinutesToday = 0;
    sessionsToday.forEach(s => {
      s.breaks.forEach(b => {
        if (b.breakType.toUpperCase() === breakType.toUpperCase()) {
          const ended = b.endedAt || new Date();
          const durMs = ended - b.startedAt;
          consumedMinutesToday += Math.round(durMs / 60000);
        }
      });
    });

    const allowedDuration = Number(duration);
    if (consumedMinutesToday >= allowedDuration) {
      return res.status(400).json({ message: `BREAK_EXHAUSTED: You have already consumed all of your allotted ${allowedDuration} minutes of ${breakType} for today.` });
    }

    const remainingMinutes = allowedDuration - consumedMinutesToday;

    session.status = 'on_break';
    session.breaks.push({
      breakType,
      duration: remainingMinutes, // allowed remaining limit for today
      startedAt: new Date()
    });

    await session.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('clock-status-changed', { userId: req.user.userId, session });
    }

    res.json({ message: `Successfully started ${breakType} break. Remaining limit: ${remainingMinutes} mins.`, session });
  } catch (err) {
    res.status(500).json({ message: 'Error starting break', error: err.message });
  }
});

// @route   POST /api/clock/break/end
// @desc    End the active break
router.post('/break/end', verifyToken, async (req, res) => {
  try {
    const session = await Session.findOne({
      userId: req.user.userId,
      status: 'on_break'
    });

    if (!session) {
      return res.status(400).json({ message: 'You are not currently on an active break.' });
    }

    // Conclude last break in list
    const activeBreak = session.breaks.find(b => !b.endedAt);
    if (activeBreak) {
      activeBreak.endedAt = new Date();
    }

    session.status = 'active';
    await session.save();

    const ioInstance = req.app.get('io');
    if (ioInstance) {
      ioInstance.emit('clock-status-changed', { userId: req.user.userId, session });
    }

    res.json({ message: 'Break concluded successfully.', session });
  } catch (err) {
    res.status(500).json({ message: 'Error ending break', error: err.message });
  }
});

// @route   GET /api/clock/breaks/types
// @desc    Retrieve all configured break types
router.get('/breaks/types', verifyToken, async (req, res) => {
  try {
    const types = await BreakType.find({}).sort({ name: 1 });
    res.json(types);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving break types', error: err.message });
  }
});

// @route   POST /api/clock/breaks/types
// @desc    Configure a new break type (Admins only)
router.post('/breaks/types', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  const { name, duration } = req.body;
  if (!name || !duration) {
    return res.status(400).json({ message: 'Break type name and duration (minutes) are required.' });
  }

  try {
    const newType = new BreakType({
      name,
      duration: Number(duration),
      assignedBy: req.user.userId
    });

    await newType.save();
    res.status(201).json({ message: 'Break type configured successfully.', breakType: newType });
  } catch (err) {
    res.status(500).json({ message: 'Error creating break type', error: err.message });
  }
});

// @route   DELETE /api/clock/breaks/types/:id
// @desc    Delete a configured break type (Admins only)
router.delete('/breaks/types/:id', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const result = await BreakType.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: 'Break type not found.' });

    res.json({ message: 'Break type removed successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting break type', error: err.message });
  }
});

// @route   PUT /api/clock/admin/approve-shift/:id
// @desc    Approve an auto-clocked-out shift (Admins only)
router.put('/admin/approve-shift/:id', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Shift session not found.' });

    session.needsApproval = false;
    session.approvalStatus = 'approved';
    await session.save();

    res.json({ message: 'Shift session approved successfully.', session });
  } catch (err) {
    res.status(500).json({ message: 'Error approving shift session', error: err.message });
  }
});

// @route   PUT /api/clock/admin/reject-shift/:id
// @desc    Reject an auto-clocked-out shift (Admins only)
router.put('/admin/reject-shift/:id', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Shift session not found.' });

    session.needsApproval = false;
    session.approvalStatus = 'rejected';
    await session.save();

    res.json({ message: 'Shift session rejected successfully.', session });
  } catch (err) {
    res.status(500).json({ message: 'Error rejecting shift session', error: err.message });
  }
});

// @route   PUT /api/clock/admin/session/:id
// @desc    Edit any shift session details (Admins only)
router.put('/admin/session/:id', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  const { clockIn, clockOut, duration, shiftType, approvalStatus, needsApproval } = req.body;

  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Shift session not found.' });

    if (clockIn !== undefined) session.clockIn = new Date(clockIn);
    if (clockOut !== undefined) session.clockOut = clockOut ? new Date(clockOut) : null;
    if (duration !== undefined) session.duration = Number(duration);
    if (shiftType !== undefined) session.shiftType = shiftType;
    if (approvalStatus !== undefined) session.approvalStatus = approvalStatus;
    if (needsApproval !== undefined) session.needsApproval = needsApproval;

    await session.save();

    res.json({ message: 'Shift session updated successfully.', session });
  } catch (err) {
    res.status(500).json({ message: 'Error editing shift session', error: err.message });
  }
});

// @route   DELETE /api/clock/admin/session/:id
// @desc    Delete a shift session (Admins only)
router.delete('/admin/session/:id', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const session = await Session.findByIdAndDelete(req.params.id);
    if (!session) return res.status(404).json({ message: 'Shift session not found.' });

    res.json({ message: 'Shift session deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting shift session', error: err.message });
  }
});

export default router;
