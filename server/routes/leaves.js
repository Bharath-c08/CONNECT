import express from 'express';
import LeaveRequest from '../models/LeaveRequest.js';
import { verifyToken, isAdminOrSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/leaves
// @desc    Submit a leave request
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

  try {
    const newRequest = new LeaveRequest({
      userId: req.user.userId,
      leaveType,
      startDate: start,
      endDate: end,
      reason,
      status: 'pending',
    });

    await newRequest.save();
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

    res.json({ message: `Leave request ${status} successfully`, request });
  } catch (error) {
    res.status(500).json({ message: 'Error updating leave request status', error: error.message });
  }
});

export default router;
