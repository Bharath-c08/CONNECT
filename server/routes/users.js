import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import LeaveCategory from '../models/LeaveCategory.js';
import { verifyToken, isAdminOrSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/users
// @desc    Get all employees/users matching specific communication barriers
router.get('/', verifyToken, async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'superadmin';
    const isAdmin = req.user.role === 'admin';
    let users;
    
    if (isSuperAdmin) {
      // Super Admin sees all profiles (excluding passwords)
      users = await User.find({}).select('-password');
    } else if (isAdmin) {
      // Admins see standard users assigned to them plus themselves, and super admins
      users = await User.find({
        $or: [
          { role: 'superadmin' },
          { _id: req.user.userId },
          { assignedAdmin: req.user.userId }
        ]
      }).select('-password');
    } else {
      // Regular employees see peers under the same admin, the admin itself, and super admins
      const currentUser = await User.findById(req.user.userId);
      const assignedAdminId = currentUser?.assignedAdmin;
      
      if (assignedAdminId) {
        users = await User.find({
          $or: [
            { role: 'superadmin' },
            { _id: assignedAdminId },
            { assignedAdmin: assignedAdminId }
          ]
        }).select('fullName role jobTitle _id employeeId email assignedAdmin');
      } else {
        // If a user has no assigned admin, they see themselves and super admins
        users = await User.find({
          $or: [
            { role: 'superadmin' },
            { _id: req.user.userId }
          ]
        }).select('fullName role jobTitle _id employeeId email');
      }
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
    regularShiftLimit,
    otShiftLimit,
    assignedAdmin,
    shiftStartTime,
    shiftEndTime,
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

    // Dynamic leave policy limits synchronization
    const categories = await LeaveCategory.find({});
    const leaveLimits = new Map();
    categories.forEach(c => {
      leaveLimits.set(c.name, c.defaultDays);
    });

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
      regularShiftLimit: regularShiftLimit !== undefined ? Number(regularShiftLimit) : 8,
      otShiftLimit: otShiftLimit !== undefined ? Number(otShiftLimit) : 4,
      shiftStartTime: shiftStartTime || '09:00',
      shiftEndTime: shiftEndTime || '17:00',
      assignedAdmin: assignedAdmin || undefined,
      leaveLimits,
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

    // Only superadmin can set or change the assigned admin of a user
    if (req.user.role !== 'superadmin') {
      delete updates.assignedAdmin;
    }

    // Prevent critical edits if updating self without administrative role
    if (!isStaff) {
      delete updates.role;
      delete updates.basicPay;
      delete updates.overtimeEligible;
      delete updates.overtimePayPerMinute;
      delete updates.employeeId;
      delete updates.regularShiftLimit;
      delete updates.otShiftLimit;
      delete updates.shiftStartTime;
      delete updates.shiftEndTime;
    }

    // Sanitize and safely cast types to prevent Mongoose schema cast faults
    if (updates.assignedAdmin === '') {
      updates.assignedAdmin = null;
    }
    if (updates.dob === '') {
      updates.dob = null;
    }
    if (updates.joiningDate === '') {
      updates.joiningDate = null;
    }
    if (updates.basicPay !== undefined) {
      updates.basicPay = Number(updates.basicPay) || 0;
    }
    if (updates.overtimePayPerMinute !== undefined) {
      updates.overtimePayPerMinute = Number(updates.overtimePayPerMinute) || 0;
    }
    if (updates.regularShiftLimit !== undefined) {
      updates.regularShiftLimit = Number(updates.regularShiftLimit) || 8;
    }
    if (updates.otShiftLimit !== undefined) {
      updates.otShiftLimit = Number(updates.otShiftLimit) || 4;
    }

    // Only superadmin can modify the role parameter of any user
    if (req.user.role !== 'superadmin' && updates.role) {
      delete updates.role;
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

// Helper to parse dates in DD-MM-YYYY, DD/MM/YYYY, or standard YYYY-MM-DD formats
const parseDate = (dateStr) => {
  if (!dateStr) return undefined;
  const cleanStr = String(dateStr).trim();
  if (!cleanStr) return undefined;

  // Match DD-MM-YYYY or DD/MM/YYYY
  const dmyRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
  const match = cleanStr.match(dmyRegex);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // 0-indexed month
    const year = parseInt(match[3], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Fallback to standard parsing
  const fallbackDate = new Date(cleanStr);
  if (!isNaN(fallbackDate.getTime())) {
    return fallbackDate;
  }

  return undefined;
};

// @route   POST /api/users/import
// @desc    Import multiple employees from an array (Only Super Admin and Admins)
router.post('/import', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  const { users } = req.body;

  if (!users || !Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ message: 'Please provide a non-empty array of users under the "users" field.' });
  }

  // Pre-fetch all leave categories to initialize limits
  const leaveLimits = new Map();
  try {
    const categories = await LeaveCategory.find({});
    categories.forEach(c => {
      leaveLimits.set(c.name, c.defaultDays);
    });
  } catch (catErr) {
    console.error('Error fetching leave categories for batch import:', catErr);
  }

  const results = {
    successCount: 0,
    failCount: 0,
    errors: []
  };

  for (const userObj of users) {
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
      regularShiftLimit,
      otShiftLimit,
      assignedAdmin,
      shiftStartTime,
      shiftEndTime,
    } = userObj;

    // Required fields validation
    if (!username || !password || !fullName || !email || !employeeId) {
      results.failCount++;
      results.errors.push({
        identifier: username || employeeId || fullName || 'Unknown',
        message: 'Missing required parameters: username, password, fullName, email, or employeeId.'
      });
      continue;
    }

    // Role check - Admins can only create standard 'user'
    if (req.user.role === 'admin' && role !== 'user' && role) {
      results.failCount++;
      results.errors.push({
        identifier: username,
        message: 'Access denied. Admins can only create standard users.'
      });
      continue;
    }

    try {
      // Check duplicate
      const userExists = await User.findOne({ $or: [{ username }, { email }, { employeeId }] });
      if (userExists) {
        results.failCount++;
        results.errors.push({
          identifier: username,
          message: `Duplicate conflict: Username, Email, or Employee ID already registered.`
        });
        continue;
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password.toString(), salt);

      const newUser = new User({
        username,
        password: hashedPassword,
        role: role || 'user',
        fullName,
        dob: dob ? parseDate(dob) : undefined,
        gender: gender || 'male',
        address,
        phone,
        email,
        jobTitle,
        joiningDate: joiningDate ? parseDate(joiningDate) : undefined,
        employmentType: employmentType || 'fulltime',
        employeeId,
        basicPay: Number(basicPay) || 0,
        overtimeEligible: overtimeEligible === true || overtimeEligible === 'true',
        overtimePayPerMinute: Number(overtimePayPerMinute) || 0,
        regularShiftLimit: regularShiftLimit !== undefined ? Number(regularShiftLimit) : 8,
        otShiftLimit: otShiftLimit !== undefined ? Number(otShiftLimit) : 4,
        shiftStartTime: shiftStartTime || '09:00',
        shiftEndTime: shiftEndTime || '17:00',
        assignedAdmin: assignedAdmin || undefined,
        leaveLimits,
      });

      await newUser.save();
      results.successCount++;
    } catch (err) {
      results.failCount++;
      results.errors.push({
        identifier: username,
        message: err.message
      });
    }
  }

  res.json({
    message: `Batch import complete. Successfully engaged ${results.successCount} operators. Failed: ${results.failCount}.`,
    results
  });
});

export default router;
