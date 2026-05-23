import express from 'express';
import Task from '../models/Task.js';
import { verifyToken, isAdminOrSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/tasks
// @desc    Assign a new task (Restricted to Admins)
router.post('/', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  const { title, description, assignedTo, dueDate, priority } = req.body;

  if (!title || !assignedTo) {
    return res.status(400).json({ message: 'Task title and assignee are required.' });
  }

  try {
    const newTask = new Task({
      title,
      description,
      assignedTo,
      assignedBy: req.user.userId,
      dueDate: dueDate ? new Date(dueDate) : null,
      priority: priority || 'medium',
      status: 'pending',
    });

    await newTask.save();
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
      .sort({ dueDate: 1, createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching personal tasks', error: error.message });
  }
});

// @route   GET /api/tasks/company
// @desc    Get all tasks across the company (Restricted to Admins)
router.get('/company', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const tasks = await Task.find({})
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
  const { status } = req.body; // 'pending', 'in-progress', 'completed'

  if (!status || !['pending', 'in-progress', 'completed'].includes(status)) {
    return res.status(400).json({ message: 'Please provide a valid status: pending, in-progress, or completed.' });
  }

  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    // Check authorization: Assignee, Admin, or Superadmin
    const isAssignee = task.assignedTo.toString() === req.user.userId;
    const isStaff = req.user.role === 'admin' || req.user.role === 'superadmin';

    if (!isAssignee && !isStaff) {
      return res.status(403).json({ message: 'Access denied. You can only update tasks assigned to you.' });
    }

    task.status = status;
    await task.save();

    res.json({ message: `Task status updated to ${status} successfully`, task });
  } catch (error) {
    res.status(500).json({ message: 'Error updating task status', error: error.message });
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
