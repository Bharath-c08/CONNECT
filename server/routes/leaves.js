import express from 'express';
import LeaveRequest from '../models/LeaveRequest.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { verifyToken, isAdminOrSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/leaves
// @desc    Submit a leave request with limit checks and alerts
router.post('/', verifyToken, async (req, res) => {
  const { leaveType, startDate, endDate, reason } = req.body;

  if (!leaveType || !startDate || !endDate) {
    return res.status(400).json({ message: 'Please provide leave type, start date, and end date.' });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start > end) {
    return res.status(400).json({ message: 'Start date cannot be after end date.' });
  }

  const requestedDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Calculate already used/pending leaves of this type
    const existingRequests = await LeaveRequest.find({
      userId: req.user.userId,
      leaveType,
      status: { $in: ['approved', 'pending'] }
    });

    let usedDays = 0;
    existingRequests.forEach(r => {
      const days = Math.ceil((new Date(r.endDate) - new Date(r.startDate)) / (1000 * 60 * 60 * 24)) + 1;
      usedDays += days;
    });

    const defaults = { sick: 10, casual: 10, annual: 15, unpaid: 365, other: 10 };
    const limit = (user.leaveLimits && typeof user.leaveLimits.get === 'function')
      ? (user.leaveLimits.get(leaveType) ?? defaults[leaveType])
      : (user.leaveLimits?.[leaveType] ?? defaults[leaveType]);

    if (usedDays + requestedDays > limit) {
      const remaining = Math.max(0, limit - usedDays);
      return res.status(400).json({
        message: `INSUFFICIENT LEAVE BALANCE: You requested ${requestedDays} days of ${leaveType.toUpperCase()} leave, but you only have ${remaining} days remaining out of your ${limit}-day limit.`
      });
    }

    const newRequest = new LeaveRequest({
      userId: req.user.userId,
      leaveType,
      startDate: start,
      endDate: end,
      reason,
      status: 'pending',
    });

    await newRequest.save();

    const io = req.app.get('io');
    
    // Notify all Admins immediately about this new request
    try {
      const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } });
      for (const admin of admins) {
        const notif = new Notification({
          recipientId: admin._id,
          type: 'system',
          title: 'New Leave Request Filed',
          message: `${user.fullName} has requested ${requestedDays} days of ${leaveType.toUpperCase()} leave.`,
          link: '/dashboard/leaves'
        });
        await notif.save();
        if (io) {
          io.to(admin._id.toString()).emit('new-notification', notif);
        }
      }
    } catch (notifErr) {
      console.error('Error dispatching new leave notifications:', notifErr);
    }

    if (io) {
      io.emit('leave-updated', { type: 'create', userId: req.user.userId });
    }

    res.status(201).json(newRequest);
  } catch (error) {
    res.status(500).json({ message: 'Error submitting leave request', error: error.message });
  }
});

// @route   GET /api/leaves/my
// @desc    Get leave requests of currently logged-in user
router.get('/my', verifyToken, async (req, res) => {
  try {
    const requests = await LeaveRequest.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leave requests', error: error.message });
  }
});

// @route   GET /api/leaves/pending
// @desc    Get all pending leave requests (Restricted to Admins)
router.get('/pending', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const requests = await LeaveRequest.find({ status: 'pending' })
      .populate('userId', 'fullName employeeId jobTitle role')
      .sort({ createdAt: 1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pending requests', error: error.message });
  }
});

// @route   GET /api/leaves/all
// @desc    Get all leave requests across the company (Restricted to Admins)
router.get('/all', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const requests = await LeaveRequest.find({})
      .populate('userId', 'fullName employeeId jobTitle role')
      .populate('approvedBy', 'fullName role')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching company leave history', error: error.message });
  }
});

// @route   PUT /api/leaves/:id/status
// @desc    Approve or Reject a leave request (Restricted to Admins)
router.put('/:id/status', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  const { status } = req.body; // 'approved' or 'rejected'

  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Please provide a valid status: approved or rejected.' });
  }

  try {
    const request = await LeaveRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'This leave request has already been processed.' });
    }

    request.status = status;
    request.approvedBy = req.user.userId;
    await request.save();

    const io = req.app.get('io');
    
    // Notify the user immediately about their leave request status change
    try {
      const notif = new Notification({
        recipientId: request.userId,
        type: 'system',
        title: `Disconnect Request ${status.toUpperCase()}`,
        message: `Your requested leave from ${new Date(request.startDate).toLocaleDateString()} to ${new Date(request.endDate).toLocaleDateString()} has been ${status}.`,
        link: '/dashboard/leaves'
      });
      await notif.save();
      if (io) {
        io.to(request.userId.toString()).emit('new-notification', notif);
      }
    } catch (notifErr) {
      console.error('Error dispatching user leave status notification:', notifErr);
    }

    if (io) {
      io.emit('leave-updated', { type: 'status-update', requestId: request._id });
    }

    res.json({ message: `Leave request ${status} successfully`, request });
  } catch (error) {
    res.status(500).json({ message: 'Error updating leave request status', error: error.message });
  }
});

// @route   GET /api/leaves/my-limits
// @desc    Get current user's leave limits and remaining balances
router.get('/my-limits', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Count approved leaves per category
    const requests = await LeaveRequest.find({ userId: req.user.userId, status: 'approved' });
    
    const usage = { sick: 0, casual: 0, annual: 0, unpaid: 0, other: 0 };
    requests.forEach(r => {
      const days = Math.ceil((new Date(r.endDate) - new Date(r.startDate)) / (1000 * 60 * 60 * 24)) + 1;
      if (usage[r.leaveType] !== undefined) {
        usage[r.leaveType] += days;
      }
    });

    const limits = {};
    const defaults = { sick: 10, casual: 10, annual: 15, unpaid: 365, other: 10 };
    
    for (const key of ['sick', 'casual', 'annual', 'unpaid', 'other']) {
      limits[key] = (user.leaveLimits && typeof user.leaveLimits.get === 'function')
        ? (user.leaveLimits.get(key) ?? defaults[key])
        : (user.leaveLimits?.[key] ?? defaults[key]);
    }

    res.json({ limits, usage });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving leave balances.', error: err.message });
  }
});

// @route   PUT /api/leaves/limits/:userId
// @desc    Update a specific user's leave limits (Admins only)
router.put('/limits/:userId', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  const { limits } = req.body;
  if (!limits) {
    return res.status(400).json({ message: 'Limits object is required.' });
  }
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    for (const [key, val] of Object.entries(limits)) {
      if (['sick', 'casual', 'annual', 'unpaid', 'other'].includes(key)) {
        user.leaveLimits.set(key, Number(val));
      }
    }
    await user.save();

    const io = req.app.get('io');
    
    // Notify the user immediately about their leave limit adjustment
    try {
      const notif = new Notification({
        recipientId: user._id,
        type: 'system',
        title: 'Leave Limits Configured',
        message: 'An administrator has configured and updated your customized leave category limits.',
        link: '/dashboard/leaves'
      });
      await notif.save();
      if (io) {
        io.to(user._id.toString()).emit('new-notification', notif);
      }
    } catch (notifErr) {
      console.error('Error dispatching limits notification:', notifErr);
    }

    if (io) {
      io.emit('leave-updated', { type: 'limits-update', userId: user._id });
    }

    res.json({ message: 'User leave limits updated successfully.', leaveLimits: user.leaveLimits });
  } catch (err) {
    res.status(500).json({ message: 'Error updating leave limits', error: err.message });
  }
});

// @route   POST /api/leaves/reset/:userId
// @desc    Reset a specific leave category of a user back to 0 (Admins only)
router.post('/reset/:userId', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  const { leaveType } = req.body;
  if (!leaveType || !['sick', 'casual', 'annual', 'unpaid', 'other'].includes(leaveType)) {
    return res.status(400).json({ message: 'Please provide a valid leave type to reset.' });
  }

  try {
    const result = await LeaveRequest.deleteMany({ userId: req.params.userId, leaveType });
    
    // Notify the user immediately about their leave reset
    const io = req.app.get('io');
    try {
      const user = await User.findById(req.params.userId);
      if (user) {
        const notif = new Notification({
          recipientId: user._id,
          type: 'system',
          title: 'Leave Balance Reset',
          message: `An administrator has reset your "${leaveType.toUpperCase()}" leave balance back to 0.`,
          link: '/dashboard/leaves'
        });
        await notif.save();
        if (io) {
          io.to(user._id.toString()).emit('new-notification', notif);
        }
      }
    } catch (err) {
      console.error('Error sending reset notification:', err);
    }

    if (io) {
      io.emit('leave-updated', { type: 'reset', userId: req.params.userId });
    }

    res.json({ message: `Successfully reset "${leaveType.toUpperCase()}" leave requests and balance back to 0.`, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: 'Error resetting leave requests', error: err.message });
  }
});

export default router;
