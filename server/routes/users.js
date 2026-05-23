import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { verifyToken, isAdminOrSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/users
// @desc    Get all employees/users (Sanitized basic details for standard users, full details for Admins)
router.get('/', verifyToken, async (req, res) => {
  try {
    const isStaff = req.user.role === 'admin' || req.user.role === 'superadmin';
    let users;
    
    if (isStaff) {
      // Admins and Superadmins get full profiles (excluding passwords)
      users = await User.find({}).select('-password');
    } else {
      // Regular employees only get a sanitized directory for communication/chatting
      users = await User.find({}).select('fullName role jobTitle _id employeeId email');
    }
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving employee profiles', error: error.message });
  }
});

// @route   GET /api/users/:id
// @desc    Get single employee details (Restricted to self or Admins)
router.get('/:id', verifyToken, async (req, res) => {
  try {
    // A regular user can only view their own profile
    if (req.user.role === 'user' && req.user.userId !== req.params.id) {
      return res.status(403).json({ message: 'Access denied. You can only view your own profile.' });
    }

    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving employee profile', error: error.message });
  }
});

// @route   POST /api/users
// @desc    Create a new employee (Only Super Admin can create Admins and Users. Admins can create standard Users only).
router.post('/', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  const {
    username,
    password,
    role,
    fullName,
    dob,
    gender,
    address,
    phone,
    email,
    jobTitle,
    joiningDate,
    employmentType,
    employeeId,
    basicPay,
    overtimeEligible,
    overtimePayPerMinute,
  } = req.body;

  // Basic validation
  if (!username || !password || !fullName || !email || !employeeId) {
    return res.status(400).json({ message: 'Please provide all required fields: username, password, fullName, email, employeeId' });
  }

  // Role restriction enforcement
  // Admins can only create standard 'user'
  if (req.user.role === 'admin' && role !== 'user') {
    return res.status(403).json({ message: 'Access denied. Admins can only create standard users. Only Super Admin can create Admins.' });
  }

  try {
    // Check if user already exists
    const userExists = await User.findOne({ $or: [{ username }, { email }, { employeeId }] });
    if (userExists) {
      return res.status(400).json({ message: 'Username, email, or employee ID already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      password: hashedPassword,
      role: role || 'user',
      fullName,
      dob,
      gender,
      address,
      phone,
      email,
      jobTitle,
      joiningDate,
      employmentType: employmentType || 'fulltime',
      employeeId,
      basicPay: Number(basicPay) || 0,
      overtimeEligible: overtimeEligible === true || overtimeEligible === 'true',
      overtimePayPerMinute: Number(overtimePayPerMinute) || 0,
    });

    await newUser.save();

    // Return the user without the password
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json(userResponse);
  } catch (error) {
    res.status(500).json({ message: 'Error creating employee profile', error: error.message });
  }
});

// @route   PUT /api/users/:id
// @desc    Update employee profile (Only self, Admin or Superadmin)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const userToUpdate = await User.findById(req.params.id);
    if (!userToUpdate) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Authorization checks
    // Regular users can only update their own profile and cannot edit critical parameters
    const isSelf = req.user.userId === req.params.id;
    const isStaff = req.user.role === 'admin' || req.user.role === 'superadmin';

    if (!isSelf && !isStaff) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Admins cannot modify a superadmin profile, nor another admin
    if (req.user.role === 'admin' && (userToUpdate.role === 'superadmin' || userToUpdate.role === 'admin') && !isSelf) {
      return res.status(403).json({ message: 'Access denied. Admins cannot manage other Admins or Super Admins.' });
    }

    // Extract update fields
    const updates = { ...req.body };

    // Prevent critical edits if updating self without administrative role
    if (!isStaff) {
      delete updates.role;
      delete updates.basicPay;
      delete updates.overtimeEligible;
      delete updates.overtimePayPerMinute;
      delete updates.employeeId;
    }

    // Admin cannot elevate a user to admin or superadmin
    if (req.user.role === 'admin' && updates.role && updates.role !== 'user') {
      delete updates.role; // Reset back or deny
    }

    // Hash password if updating
    if (updates.password) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(updates.password, salt);
    } else {
      delete updates.password; // Do not touch password if empty
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    ).select('-password');

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: 'Error updating employee profile', error: error.message });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete employee profile (Only Superadmin and Admins can delete users)
router.delete('/:id', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // A user cannot delete themselves
    if (req.user.userId === req.params.id) {
      return res.status(400).json({ message: 'You cannot delete your own account.' });
    }

    // Admins cannot delete other admins or superadmins
    if (req.user.role === 'admin' && (userToDelete.role === 'admin' || userToDelete.role === 'superadmin')) {
      return res.status(403).json({ message: 'Access denied. Admins cannot delete other Admins or Super Admins.' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Employee profile deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting employee profile', error: error.message });
  }
});

export default router;
