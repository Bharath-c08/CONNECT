import express from 'express';
import mongoose from 'mongoose';
import Goal from '../models/Goal.js';
import User from '../models/User.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/okrs - Fetch goals
router.get('/', verifyToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }
    const { assignedTo, status, quarter, year } = req.query;
    const filter = {};

    if (assignedTo) filter.assignedTo = assignedTo;
    if (status) filter.status = status;
    if (quarter) filter.quarter = quarter;
    if (year) filter.year = Number(year);

    const goals = await Goal.find(filter)
      .populate('assignedTo', 'fullName jobTitle employeeId')
      .populate('createdBy', 'fullName jobTitle')
      .sort({ createdAt: -1 });

    res.json(goals || []);
  } catch (error) {
    console.error('Error fetching OKRs:', error);
    res.json([]);
  }
});

// POST /api/okrs - Create a new goal / OKR
router.post('/', verifyToken, async (req, res) => {
  try {
    const { title, description, category, targetValue, currentValue, unit, assignedTo, quarter, year, dueDate } = req.body;
    const createdBy = req.user.userId;

    if (!title || !targetValue) {
      return res.status(400).json({ message: 'Goal title and target value are required.' });
    }

    const goal = new Goal({
      title,
      description,
      category: category || 'Individual',
      targetValue: Number(targetValue),
      currentValue: Number(currentValue) || 0,
      unit: unit || '%',
      assignedTo: assignedTo || createdBy,
      createdBy,
      quarter: quarter || 'Q3',
      year: Number(year) || new Date().getFullYear(),
      status: (Number(currentValue) >= Number(targetValue)) ? 'completed' : 'in_progress',
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });

    await goal.save();

    const populatedGoal = await Goal.findById(goal._id)
      .populate('assignedTo', 'fullName jobTitle employeeId')
      .populate('createdBy', 'fullName jobTitle');

    res.status(201).json(populatedGoal);
  } catch (error) {
    console.error('Error creating OKR:', error);
    res.status(500).json({ message: 'Failed to create OKR.', error: error.message });
  }
});

// PUT /api/okrs/:id - Update goal or progress
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, currentValue, targetValue, status, unit } = req.body;

    const goal = await Goal.findById(id);
    if (!goal) {
      return res.status(404).json({ message: 'Goal not found.' });
    }

    if (title !== undefined) goal.title = title;
    if (description !== undefined) goal.description = description;
    if (currentValue !== undefined) goal.currentValue = Number(currentValue);
    if (targetValue !== undefined) goal.targetValue = Number(targetValue);
    if (unit !== undefined) goal.unit = unit;
    if (status !== undefined) {
      goal.status = status;
    } else if (goal.currentValue >= goal.targetValue) {
      goal.status = 'completed';
    }

    await goal.save();

    const updatedGoal = await Goal.findById(id)
      .populate('assignedTo', 'fullName jobTitle employeeId')
      .populate('createdBy', 'fullName jobTitle');

    res.json(updatedGoal);
  } catch (error) {
    console.error('Error updating OKR:', error);
    res.status(500).json({ message: 'Failed to update OKR.', error: error.message });
  }
});

// DELETE /api/okrs/:id - Delete goal
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const goal = await Goal.findByIdAndDelete(id);
    if (!goal) {
      return res.status(404).json({ message: 'Goal not found.' });
    }
    res.json({ message: 'Goal deleted successfully.' });
  } catch (error) {
    console.error('Error deleting OKR:', error);
    res.status(500).json({ message: 'Failed to delete OKR.', error: error.message });
  }
});

export default router;
