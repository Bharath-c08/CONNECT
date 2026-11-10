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
// @desc    Issue new certificate(s) for employee(s) (Admin/Superadmin only) - Supports multi-user selection
router.post('/', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const {
      userId,
      userIds,
      certificateType,
      title,
      content,
      issueDate,
      effectiveDate,
      metadata,
    } = req.body;

    // Collect array of target IDs
    let targets = [];
    if (Array.isArray(userIds) && userIds.length > 0) {
      targets = userIds;
    } else if (userId) {
      targets = [userId];
    }

    if (targets.length === 0 || !certificateType || !title || !content) {
      return res.status(400).json({
        message: 'Please select at least one employee, certificate type, title, and document content.',
      });
    }

    const targetUsers = await User.find({ _id: { $in: targets } });
    if (targetUsers.length === 0) {
      return res.status(404).json({ message: 'No valid employees found for certificate issuance.' });
    }

    const issuer = await User.findById(req.user.userId);
    const issuerName = issuer ? issuer.fullName : 'Authorized Authority';
    const issuerRole = issuer ? issuer.role.toUpperCase() : 'ADMINISTRATION';

    const issuedCertificates = [];

    for (const targetUser of targetUsers) {
      const verificationCode = generateVerificationCode(certificateType);

      const joiningFormatted = targetUser.joiningDate
        ? new Date(targetUser.joiningDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'the date of joining';

      const relievingFormatted = metadata?.relievingDate
        ? new Date(metadata.relievingDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

      // Replace dynamic variable placeholders for each user if present
      let userSpecificContent = content
        .replace(/{{fullName}}/g, targetUser.fullName)
        .replace(/{{employeeId}}/g, targetUser.employeeId)
        .replace(/{{jobTitle}}/g, targetUser.jobTitle || metadata?.designation || 'Operator')
        .replace(/{{joiningDate}}/g, joiningFormatted)
        .replace(/{{relievingDate}}/g, relievingFormatted);

      const cert = new Certificate({
        userId: targetUser._id,
        employeeId: targetUser.employeeId,
        fullName: targetUser.fullName,
        certificateType,
        title,
        content: userSpecificContent,
        issueDate: issueDate || new Date(),
        effectiveDate: effectiveDate || new Date(),
        issuedBy: req.user.userId,
        issuedByName: issuerName,
        issuedByRole: issuerRole,
        status: 'issued',
        verificationCode,
        metadata: {
          designation: metadata?.designation || targetUser.jobTitle || '',
          department: metadata?.department || 'Operations',
          joiningDate: targetUser.joiningDate,
          relievingDate: metadata?.relievingDate || null,
          reason: metadata?.reason || '',
          notes: metadata?.notes || '',
        },
      });

      await cert.save();
      issuedCertificates.push(cert);
    }

    res.status(201).json({
      message: `Successfully issued ${issuedCertificates.length} certificate(s).`,
      count: issuedCertificates.length,
      certificates: issuedCertificates,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error issuing certificates', error: error.message });
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
    const cleanCode = req.params.code.trim().toUpperCase();
    const certificate = await Certificate.findOne({
      verificationCode: { $regex: new RegExp('^' + cleanCode + '$', 'i') }
    })
      .populate('userId', 'fullName employeeId jobTitle email employmentType bloodGroup profilePhoto')
      .populate('issuedBy', 'fullName role email');

    if (!certificate) {
      return res.status(404).json({
        verified: false,
        valid: false,
        status: 'Fake / Invalid',
        message: `No authentic certificate found matching code '${cleanCode}'.`,
        verificationId: cleanCode
      });
    }

    res.json({
      verified: certificate.status === 'issued',
      valid: certificate.status === 'issued',
      type: 'certificate',
      status: certificate.status === 'issued' ? 'Valid Authentic Certificate' : 'Revoked / Inactive',
      verificationId: certificate.verificationCode,
      certificateType: certificate.certificateType,
      documentTitle: certificate.title,
      fullName: certificate.fullName,
      employeeId: certificate.employeeId,
      jobTitle: certificate.metadata?.designation || certificate.userId?.jobTitle || 'Technical Operator',
      department: certificate.metadata?.department || 'Operations',
      issueDate: certificate.issueDate,
      effectiveDate: certificate.effectiveDate,
      relievingDate: certificate.metadata?.relievingDate || null,
      issuedByName: certificate.issuedByName,
      issuedByRole: certificate.issuedByRole,
      content: certificate.content,
      verifiedAt: new Date(),
      issuer: 'Markdot Intellect Inc. Credential Authority',
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
    res.status(500).json({
      verified: false,
      valid: false,
      status: 'Verification Error',
      message: 'Certificate verification failed.',
      error: error.message
    });
  }
});

export default router;

