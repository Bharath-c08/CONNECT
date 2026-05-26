import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_key_markdotintellect_hrm_2026');
    req.user = decoded; // { userId, role }
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

export const isSuperAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user && user.role === 'superadmin') {
      next();
    } else {
      return res.status(403).json({ message: 'Access denied. Superadmin role required.' });
    }
  } catch (err) {
    return res.status(500).json({ message: 'Error verifying superadmin privileges.', error: err.message });
  }
};

export const isAdminOrSuperAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user && (user.role === 'admin' || user.role === 'superadmin')) {
      next();
    } else {
      return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
    }
  } catch (err) {
    return res.status(500).json({ message: 'Error verifying administrator privileges.', error: err.message });
  }
};
