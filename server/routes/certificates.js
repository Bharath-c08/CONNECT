import express from 'express';
import Certificate from '../models/Certificate.js';
import User from '../models/User.js';
import { verifyToken, isAdminOrSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// Generate unique verification code
function generateVerificationCode(type) {
  const prefix = type ? type.substring(0, 3).toUpperCase() : 'CRT';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MD-${prefix}-${timestamp}-${random}`;
}

// @route   GET /api/certificates/my
// @desc    Get all certificates issued to the current user
router.get('/my', verifyToken, async (req, res) => {
  try {
    const certificates = await Certificate.find({
      userId: req.user.userId,
      status: 'issued',
    })
      .sort({ createdAt: -1 })
      .populate('issuedBy', 'fullName role email');

    res.json(certificates);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving your certificates', error: error.message });
  }
});

// @route   GET /api/certificates/all
// @desc    Get all certificates across users (Admin/Superadmin only)
router.get('/all', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { userId, type } = req.query;
    const filter = {};
    if (userId) filter.userId = userId;
    if (type) filter.certificateType = type;

    const certificates = await Certificate.find(filter)
      .sort({ createdAt: -1 })
      .populate('userId', 'fullName employeeId jobTitle email')
      .populate('issuedBy', 'fullName role email');

    res.json(certificates);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving certificates list', error: error.message });
  }
});

// @route   POST /api/certificates
// @desc    Issue a new certificate for an employee (Admin/Superadmin only)
router.post('/', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const {
      userId,
      certificateType,
      title,
      content,
      issueDate,
      effectiveDate,
      metadata,
    } = req.body;

    if (!userId || !certificateType || !title || !content) {
      return res.status(400).json({
        message: 'Please provide employee, certificate type, title, and document content.',
      });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target employee not found.' });
    }

    const issuer = await User.findById(req.user.userId);
    const verificationCode = generateVerificationCode(certificateType);

    const certificate = new Certificate({
      userId: targetUser._id,
      employeeId: targetUser.employeeId,
      fullName: targetUser.fullName,
      certificateType,
      title,
      content,
      issueDate: issueDate || new Date(),
      effectiveDate: effectiveDate || new Date(),
      issuedBy: req.user.userId,
      issuedByName: issuer ? issuer.fullName : 'Authorized Authority',
      issuedByRole: issuer ? issuer.role.toUpperCase() : 'ADMINISTRATION',
      status: 'issued',
      verificationCode,
      metadata: {
        designation: metadata?.designation || targetUser.jobTitle || '',
        department: metadata?.department || 'Operations',
        joiningDate: metadata?.joiningDate || targetUser.joiningDate,
        relievingDate: metadata?.relievingDate || null,
        reason: metadata?.reason || '',
        notes: metadata?.notes || '',
      },
    });

    await certificate.save();

    res.status(201).json({
      message: 'Certificate successfully issued.',
      certificate,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error issuing certificate', error: error.message });
  }
});

// @route   DELETE /api/certificates/:id
// @desc    Delete or revoke a certificate (Admin/Superadmin only)
router.delete('/:id', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found.' });
    }

    await Certificate.findByIdAndDelete(req.params.id);
    res.json({ message: 'Certificate has been removed successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting certificate', error: error.message });
  }
});

// @route   GET /api/certificates/verify/:code
// @desc    Verify certificate authenticity by verification code
router.get('/verify/:code', async (req, res) => {
  try {
    const certificate = await Certificate.findOne({ verificationCode: req.params.code })
      .populate('userId', 'fullName employeeId jobTitle email')
      .populate('issuedBy', 'fullName role');

    if (!certificate) {
      return res.status(404).json({ valid: false, message: 'Invalid certificate verification code.' });
    }

    res.json({
      valid: true,
      status: certificate.status,
      certificate: {
        title: certificate.title,
        type: certificate.certificateType,
        fullName: certificate.fullName,
        employeeId: certificate.employeeId,
        issueDate: certificate.issueDate,
        effectiveDate: certificate.effectiveDate,
        verificationCode: certificate.verificationCode,
        issuedByName: certificate.issuedByName,
        issuedByRole: certificate.issuedByRole,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying certificate', error: error.message });
  }
});

export default router;

