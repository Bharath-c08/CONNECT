import express from 'express';
import LeaveRequest from '../models/LeaveRequest.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import LeaveCategory from '../models/LeaveCategory.js';
import { verifyToken, isAdminOrSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/leaves
// @desc    Submit a leave request with limit checks and alerts (scoped monthly)
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

    // Load category dynamically
    const category = await LeaveCategory.findOne({ name: leaveType });
    if (!category || !category.isActive) {
      return res.status(400).json({ message: 'This leave category is not currently active.' });
    }

    // Check if category is disabled for this user
    if (user.disabledLeaves && user.disabledLeaves.includes(leaveType)) {
      return res.status(400).json({ message: `This leave category (${category.label}) is not enabled for your account.` });
    }

    // Calculate start and end of requested month for monthly auto-reset check
    const year = start.getFullYear();
    const month = start.getMonth();
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // Calculate already used/pending leaves of this type in the target calendar month
    const existingRequests = await LeaveRequest.find({
      userId: req.user.userId,
      leaveType,
      status: { $in: ['approved', 'pending'] },
      startDate: { $gte: startOfMonth, $lte: endOfMonth }
    });

    let usedDays = 0;
    existingRequests.forEach(r => {
      const days = Math.ceil((new Date(r.endDate) - new Date(r.startDate)) / (1000 * 60 * 60 * 24)) + 1;
      usedDays += days;
    });

    const limit = (user.leaveLimits && typeof user.leaveLimits.get === 'function')
      ? (user.leaveLimits.get(leaveType) ?? category.defaultDays)
      : (user.leaveLimits?.[leaveType] ?? category.defaultDays);

    if (usedDays + requestedDays > limit) {
      const remaining = Math.max(0, limit - usedDays);
      return res.status(400).json({
        message: `INSUFFICIENT LEAVE BALANCE: You requested ${requestedDays} days of ${leaveType.toUpperCase()} leave, but you only have ${remaining} days remaining out of your ${limit}-day limit for this month.`
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
// @desc    Get current user's leave limits and remaining balances (scoped monthly)
router.get('/my-limits', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Load active leave categories dynamically
    const categories = await LeaveCategory.find({ isActive: true }).sort({ createdAt: 1 });

    // Calculate current month boundaries
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // Count approved leaves per category dynamically in the current month
    const requests = await LeaveRequest.find({
      userId: req.user.userId,
      status: 'approved',
      startDate: { $gte: startOfMonth, $lte: endOfMonth }
    });
    
    const usage = {};
    categories.forEach(c => {
      usage[c.name] = 0;
    });

    requests.forEach(r => {
      const days = Math.ceil((new Date(r.endDate) - new Date(r.startDate)) / (1000 * 60 * 60 * 24)) + 1;
      if (usage[r.leaveType] === undefined) {
        usage[r.leaveType] = 0;
      }
      usage[r.leaveType] += days;
    });

    const limits = {};
    categories.forEach(c => {
      limits[c.name] = (user.leaveLimits && typeof user.leaveLimits.get === 'function')
        ? (user.leaveLimits.get(c.name) ?? c.defaultDays)
        : (user.leaveLimits?.[c.name] ?? c.defaultDays);
    });

    res.json({
      limits,
      usage,
      disabled: user.disabledLeaves || [],
      categories
    });
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving leave balances.', error: err.message });
  }
});

// @route   PUT /api/leaves/limits/:userId
// @desc    Update a specific user's leave limits and enabled leave types (Admins only)
router.put('/limits/:userId', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  const { limits, disabledLeaves } = req.body;
  if (!limits) {
    return res.status(400).json({ message: 'Limits object is required.' });
  }
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    for (const [key, val] of Object.entries(limits)) {
      user.leaveLimits.set(key, Number(val));
    }

    if (disabledLeaves !== undefined && Array.isArray(disabledLeaves)) {
      user.disabledLeaves = disabledLeaves;
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
  if (!leaveType) {
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

// @route   GET /api/leaves/categories
// @desc    Get all leave categories (authenticated users)
router.get('/categories', verifyToken, async (req, res) => {
  try {
    const categories = await LeaveCategory.find({}).sort({ createdAt: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leave categories', error: error.message });
  }
});

// @route   POST /api/leaves/categories
// @desc    Create a new leave category (Admins only)
router.post('/categories', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  const { name, label, defaultDays } = req.body;
  if (!name || !label || defaultDays === undefined) {
    return res.status(400).json({ message: 'Please provide category name, label, and default days.' });
  }

  try {
    const normalizedName = name.toLowerCase().trim();
    const existing = await LeaveCategory.findOne({ name: normalizedName });
    if (existing) {
      return res.status(400).json({ message: 'A leave category with this identifier already exists.' });
    }

    const category = new LeaveCategory({
      name: normalizedName,
      label,
      defaultDays: Number(defaultDays),
      isActive: true
    });

    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error creating leave category', error: error.message });
  }
});

// @route   PUT /api/leaves/categories/:id
// @desc    Update a leave category (Admins only)
router.put('/categories/:id', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  const { label, defaultDays, isActive } = req.body;

  try {
    const category = await LeaveCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Leave category not found.' });
    }

    if (label !== undefined) category.label = label;
    if (defaultDays !== undefined) category.defaultDays = Number(defaultDays);
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error updating leave category', error: error.message });
  }
});

// @route   DELETE /api/leaves/categories/:id
// @desc    Delete a leave category (Admins only)
router.delete('/categories/:id', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const category = await LeaveCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Leave category not found.' });
    }

    // Check if category is used in any leave requests
    const usedCount = await LeaveRequest.countDocuments({ leaveType: category.name });
    if (usedCount > 0) {
      // Soft-delete if in use
      category.isActive = false;
      await category.save();
      return res.json({
        message: 'Leave category is in use by active records. It has been set to INACTIVE instead of full deletion.',
        softDeleted: true,
        category
      });
    }

    await LeaveCategory.findByIdAndDelete(req.params.id);
    res.json({ message: 'Leave category deleted successfully.', softDeleted: false });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting leave category', error: error.message });
  }
});

export default router;
