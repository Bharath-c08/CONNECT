import express from 'express';
import Task from '../models/Task.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { verifyToken, isAdminOrSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/tasks
// @desc    Assign a new task (Restricted to Admins)
router.post('/', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  const { title, description, assignedTo, startDate, endDate, priority } = req.body;

  if (!title || !assignedTo || !Array.isArray(assignedTo) || assignedTo.length === 0 || !startDate || !endDate) {
    return res.status(400).json({ message: 'Task title, assignees, start date, and end date are required.' });
  }

  try {
    const newTask = new Task({
      title,
      description,
      assignedTo,
      assignedBy: req.user.userId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      priority: priority || 'medium',
      status: 'pending',
    });

    await newTask.save();

    // Create and broadcast notifications
    const io = req.app.get('io');
    for (const userId of assignedTo) {
      const notif = new Notification({
        recipientId: userId,
        type: 'system',
        title: 'New Mission Assigned',
        message: `You have been assigned to: ${title}`,
        link: '/dashboard/tasks'
      });
      await notif.save();
      if (io) {
        console.log('Socket available. Emitting new-notification to room:', userId.toString());
        io.to(userId.toString()).emit('new-notification', notif);
      } else {
        console.log('Socket io instance not found on req.app');
      }
    }

    res.status(201).json(newTask);
  } catch (error) {
    res.status(500).json({ message: 'Error assigning task', error: error.message });
  }
});

// @route   GET /api/tasks/my
// @desc    Get all tasks assigned to the currently logged-in user
router.get('/my', verifyToken, async (req, res) => {
  try {
    const tasks = await Task.find({ assignedTo: req.user.userId })
      .populate('assignedBy', 'fullName jobTitle role')
      .sort({ startDate: 1, createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching personal tasks', error: error.message });
  }
});

// @route   GET /api/tasks/company
// @desc    Get tasks assigned by the logged-in Admin/SuperAdmin
router.get('/company', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const tasks = await Task.find({ assignedBy: req.user.userId })
      .populate('assignedTo', 'fullName employeeId jobTitle role')
      .populate('assignedBy', 'fullName jobTitle role')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching company tasks', error: error.message });
  }
});

// @route   PUT /api/tasks/:id/status
// @desc    Update status of a task (Assignee or Admins only)
router.put('/:id/status', verifyToken, async (req, res) => {
  const { status, operatorComments } = req.body; // 'pending', 'in-progress', 'waiting_for_approval'

  if (!status || !['pending', 'in-progress', 'waiting_for_approval'].includes(status)) {
    return res.status(400).json({ message: 'Please provide a valid status: pending, in-progress, or waiting_for_approval.' });
  }

  if (status === 'waiting_for_approval' && !operatorComments) {
    return res.status(400).json({ message: 'Comments are required when submitting a task for approval.' });
  }

  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    const isAssignee = task.assignedTo.some(id => id.toString() === req.user.userId);
    const isStaff = req.user.role === 'admin' || req.user.role === 'superadmin';

    if (!isAssignee && !isStaff) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    // 1-by-1 Execution Rule
    if (status === 'in-progress') {
      const activeTask = await Task.findOne({
        _id: { $ne: task._id },
        assignedTo: req.user.userId,
        status: 'in-progress'
      });
      if (activeTask) {
        return res.status(400).json({ message: 'You already have an active mission in progress. Please complete it first.' });
      }
    }

    task.status = status;
    if (operatorComments) {
      task.operatorComments = operatorComments;
    }
    await task.save();

    const io = req.app.get('io');
    if (io) {
      // Notify all active task dashboards of the status change instantly!
      io.emit('task-updated', { taskId: task._id, status: task.status });
    }

    // Notify all Admins immediately when user completes/submits a task
    if (status === 'waiting_for_approval') {
      try {
        const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } });
        for (const admin of admins) {
          const notif = new Notification({
            recipientId: admin._id,
            type: 'system',
            title: 'Mission Submitted for Review',
            message: `Operator has submitted mission "${task.title}" for review.`,
            link: '/dashboard/tasks'
          });
          await notif.save();
          if (io) {
            io.to(admin._id.toString()).emit('new-notification', notif);
          }
        }
      } catch (err) {
        console.error('Error sending admin notifications on task finish:', err);
      }
    }

    res.json({ message: `Task status updated to ${status} successfully`, task });
  } catch (error) {
    res.status(500).json({ message: 'Error updating task status', error: error.message });
  }
});

// @route   PUT /api/tasks/:id/review
// @desc    Approve or escalate a task (Admins only)
router.put('/:id/review', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  const { action, adminFeedback } = req.body; // action: 'approve', 'escalate'

  if (!action || !['approve', 'escalate'].includes(action)) {
    return res.status(400).json({ message: 'Action must be approve or escalate.' });
  }

  if (action === 'escalate' && !adminFeedback) {
    return res.status(400).json({ message: 'Feedback is required when escalating.' });
  }

  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    if (action === 'approve') {
      task.status = 'completed';
    } else {
      task.status = 'in-progress';
      task.adminFeedback = adminFeedback;
    }

    await task.save();

    const io = req.app.get('io');
    if (io) {
      // Notify all active task dashboards of the status change instantly!
      io.emit('task-updated', { taskId: task._id, status: task.status });

      for (const userId of task.assignedTo) {
        const notif = new Notification({
          recipientId: userId,
          type: 'system',
          title: `Mission ${action === 'approve' ? 'Approved' : 'Escalated'}`,
          message: action === 'approve' ? `Your mission "${task.title}" has been completed.` : `Your mission "${task.title}" was escalated. Please check the feedback.`,
          link: '/dashboard/tasks'
        });
        await notif.save();
        io.to(userId.toString()).emit('new-notification', notif);
      }
    }

    res.json({ message: `Task ${action}d successfully.`, task });
  } catch (error) {
    res.status(500).json({ message: 'Error reviewing task', error: error.message });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete a task (Restricted to Admins)
router.delete('/:id', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'Task deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting task', error: error.message });
  }
});

export default router;
