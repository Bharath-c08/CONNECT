import express from 'express';
import crypto from 'crypto';
import Document from '../models/Document.js';
import DocumentSignature from '../models/DocumentSignature.js';
import User from '../models/User.js';
import { verifyToken, isAdminOrSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// Helper to mask employee name for public verification (e.g. "John Doe" -> "J*** D**")
const maskName = (name) => {
  if (!name || typeof name !== 'string') return 'Anonymous';
  const parts = name.trim().split(/\s+/);
  return parts
    .map((part) => {
      if (part.length <= 2) return part[0] + '*';
      return part[0] + '*'.repeat(Math.max(2, part.length - 2)) + part[part.length - 1];
    })
    .join(' ');
};

// Helper to generate a unique, non-sequential Verification ID (e.g. DOC-VER-8F2B-9C01)
const generateVerificationId = () => {
  const p1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const p2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `DOC-VER-${p1}-${p2}`;
};

// Helper to generate SHA-256 cryptographic certificate hash
const generateCertificateHash = (docId, version, userId, timestamp, ip, verId) => {
  const rawData = `${docId}:${version}:${userId}:${timestamp}:${ip}:${verId}`;
  return crypto.createHash('sha256').update(rawData).digest('hex');
};

// ==========================================
// PUBLIC UNTOUCHED ENDPOINT: Document Verification
// ==========================================
// @route   GET /api/documents/verify/:verificationId
// @desc    Public verification lookup for QR codes and certificate hashes
// @access  Public (No Auth Required)
router.get('/verify/:verificationId', async (req, res) => {
  try {
    const { verificationId } = req.params;
    const cleanId = verificationId.trim().toUpperCase();

    const signature = await DocumentSignature.findOne({ verificationId: cleanId })
      .populate('userId', 'fullName employeeId jobTitle email employmentType')
      .populate('documentId', 'title category createdAt');

    if (!signature) {
      return res.status(404).json({
        verified: false,
        status: 'Fake / Invalid',
        message: 'No authentic document record found matching this Verification ID.',
        verificationId: cleanId
      });
    }

    const maskedEmployeeName = signature.userId
      ? maskName(signature.userId.fullName)
      : 'Confidential Employee';

    const maskedEmpId = signature.userId?.employeeId
      ? `EMP-***${signature.userId.employeeId.slice(-3)}`
      : '***';

    res.json({
      verified: signature.status === 'valid',
      status: signature.status === 'valid' ? 'Valid' : 'Revoked',
      verificationId: signature.verificationId,
      certificateHash: signature.certificateHash,
      documentTitle: signature.documentTitle,
      documentVersion: signature.documentVersion,
      category: signature.documentId?.category || 'Company Policy',
      issuedDate: signature.documentId?.createdAt || signature.createdAt,
      signedAt: signature.signedAt,
      ipAddress: signature.ipAddress ? `${signature.ipAddress.slice(0, 3)}.***.***` : '***',
      maskedEmployeeName,
      maskedEmployeeId: maskedEmpId,
      revokedAt: signature.revokedAt,
      revocationReason: signature.revocationReason
    });
  } catch (error) {
    res.status(500).json({
      verified: false,
      status: 'Verification Error',
      message: 'Cryptographic ledger lookup failed.',
      error: error.message
    });
  }
});

// ==========================================
// EMPLOYEE ENDPOINTS (Authenticated)
// ==========================================

// @route   GET /api/documents/my
// @desc    Get all active documents assigned to current employee with signature status
// @access  Private
router.get('/my', verifyToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find all active documents
    const allActiveDocs = await Document.find({ isActive: true }).sort({ createdAt: -1 });

    // Filter documents matching this user's targeting criteria
    const assignedDocs = allActiveDocs.filter((doc) => {
      if (doc.assignmentType === 'all') return true;
      if (doc.assignmentType === 'specific_users') {
        return doc.targetUsers.some((uId) => uId.toString() === currentUser._id.toString());
      }
      if (doc.assignmentType === 'role') {
        return doc.targetRoles.includes(currentUser.role);
      }
      if (doc.assignmentType === 'employment_type') {
        return doc.targetEmploymentTypes.includes(currentUser.employmentType);
      }
      if (doc.assignmentType === 'department') {
        // match department with job title or assigned user details
        return doc.targetDepartments.some(
          (d) =>
            currentUser.jobTitle?.toLowerCase().includes(d.toLowerCase()) ||
            currentUser.employmentType?.toLowerCase().includes(d.toLowerCase())
        );
      }
      return false;
    });

    // Lookup signatures for each assigned doc for the current version
    const docIds = assignedDocs.map((d) => d._id);
    const userSignatures = await DocumentSignature.find({
      userId: currentUser._id,
      documentId: { $in: docIds }
    });

    const results = assignedDocs.map((doc) => {
      // Find signature matching the current version
      const sig = userSignatures.find(
        (s) => s.documentId.toString() === doc._id.toString() && s.documentVersion === doc.version
      );

      return {
        _id: doc._id,
        title: doc.title,
        category: doc.category,
        description: doc.description,
        content: doc.content,
        version: doc.version,
        assignmentType: doc.assignmentType,
        requiresAcknowledgment: doc.requiresAcknowledgment,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        isSigned: Boolean(sig),
        signature: sig
          ? {
              _id: sig._id,
              signedAt: sig.signedAt,
              verificationId: sig.verificationId,
              certificateHash: sig.certificateHash,
              status: sig.status,
              documentVersion: sig.documentVersion
            }
          : null
      };
    });

    const pendingCount = results.filter((d) => !d.isSigned).length;
    res.json({ documents: results, pendingCount });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving employee documents', error: error.message });
  }
});

// @route   GET /api/documents/signatures/my
// @desc    Get archive of all signed documents by the current employee
// @access  Private
router.get('/signatures/my', verifyToken, async (req, res) => {
  try {
    const signatures = await DocumentSignature.find({ userId: req.user.userId })
      .populate('documentId')
      .populate('userId', 'fullName employeeId jobTitle email address phone emergencyContactNumber emergencyContactName dob bloodGroup')
      .sort({ signedAt: -1 });

    res.json(signatures);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving signed document archive', error: error.message });
  }
});

// @route   GET /api/documents/:id
// @desc    Get a specific document detail
// @access  Private
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const signature = await DocumentSignature.findOne({
      documentId: doc._id,
      userId: req.user.userId,
      documentVersion: doc.version
    });

    res.json({ document: doc, signature });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching document', error: error.message });
  }
});

// @route   POST /api/documents/:id/sign
// @desc    Acknowledge & sign an assigned document
// @access  Private
router.post('/:id/sign', verifyToken, async (req, res) => {
  try {
    const { consentConfirmed } = req.body;
    if (!consentConfirmed) {
      return res.status(400).json({ message: 'You must explicitly confirm consent to sign this agreement.' });
    }

    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Check if already signed this exact version
    const existingSig = await DocumentSignature.findOne({
      documentId: doc._id,
      userId: user._id,
      documentVersion: doc.version
    });

    if (existingSig) {
      return res.status(400).json({
        message: 'You have already signed and acknowledged this version of the document.',
        signature: existingSig
      });
    }

    // Client IP and User Agent extraction
    const rawIp =
      req.headers['x-forwarded-for'] ||
      req.socket.remoteAddress ||
      req.ip ||
      '127.0.0.1';
    const clientIp = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '127.0.0.1';
    const clientUserAgent = req.headers['user-agent'] || 'Unknown Browser Agent';

    // Generate unique verification ID and certificate hash
    let verificationId = generateVerificationId();
    let collision = await DocumentSignature.findOne({ verificationId });
    while (collision) {
      verificationId = generateVerificationId();
      collision = await DocumentSignature.findOne({ verificationId });
    }

    const now = new Date();
    const certificateHash = generateCertificateHash(
      doc._id.toString(),
      doc.version,
      user._id.toString(),
      now.toISOString(),
      clientIp,
      verificationId
    );

    const newSignature = new DocumentSignature({
      documentId: doc._id,
      documentTitle: doc.title,
      documentVersion: doc.version,
      userId: user._id,
      signedAt: now,
      ipAddress: clientIp,
      userAgent: clientUserAgent,
      consentConfirmed: true,
      verificationId,
      certificateHash,
      status: 'valid'
    });

    await newSignature.save();

    // Check if user has now signed all required documents
    const allActive = await Document.find({ isActive: true, requiresAcknowledgment: true });
    const userSigs = await DocumentSignature.find({ userId: user._id });
    const isCompleted = allActive.every((d) =>
      userSigs.some((s) => s.documentId.toString() === d._id.toString() && s.documentVersion === d.version)
    );

    if (isCompleted && !user.onboardingCompleted) {
      user.onboardingCompleted = true;
      await user.save();
    }

    res.status(201).json({
      message: 'Agreement acknowledged and digitally signed successfully.',
      signature: newSignature
    });
  } catch (error) {
    res.status(500).json({ message: 'Error signing agreement', error: error.message });
  }
});

// ==========================================
// ADMINISTRATIVE ENDPOINTS (Admin & SuperAdmin)
// ==========================================

// @route   GET /api/documents/admin/list
// @desc    List all documents with assignment & signature metrics
// @access  Admin/SuperAdmin
router.get('/admin/list', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const docs = await Document.find()
      .populate('createdBy', 'fullName employeeId')
      .sort({ createdAt: -1 });

    // Gather signature statistics for each document
    const docStats = await Promise.all(
      docs.map(async (doc) => {
        const totalSignatures = await DocumentSignature.countDocuments({
          documentId: doc._id,
          documentVersion: doc.version
        });
        const historicalSignatures = await DocumentSignature.countDocuments({
          documentId: doc._id
        });

        return {
          ...doc.toObject(),
          currentVersionSignatures: totalSignatures,
          totalAllTimeSignatures: historicalSignatures
        };
      })
    );

    res.json(docStats);
  } catch (error) {
    res.status(500).json({ message: 'Error listing admin documents', error: error.message });
  }
});

// @route   POST /api/documents/admin
// @desc    Create and assign a new terms or policy document
// @access  Admin/SuperAdmin
router.post('/admin', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      content,
      assignmentType,
      targetUsers,
      targetRoles,
      targetDepartments,
      targetEmploymentTypes,
      requiresAcknowledgment
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required.' });
    }

    const newDoc = new Document({
      title,
      category: category || 'General Agreement',
      description: description || '',
      content,
      version: 1,
      assignmentType: assignmentType || 'all',
      targetUsers: targetUsers || [],
      targetRoles: targetRoles || [],
      targetDepartments: targetDepartments || [],
      targetEmploymentTypes: targetEmploymentTypes || [],
      requiresAcknowledgment: requiresAcknowledgment !== false,
      isActive: true,
      createdBy: req.user.userId
    });

    await newDoc.save();

    res.status(201).json({ message: 'Document created and published successfully', document: newDoc });
  } catch (error) {
    res.status(500).json({ message: 'Error creating document', error: error.message });
  }
});

// @route   PUT /api/documents/admin/:id
// @desc    Update document, automatically archiving previous version and incrementing version
// @access  Admin/SuperAdmin
router.put('/admin/:id', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const {
      title,
      category,
      description,
      content,
      assignmentType,
      targetUsers,
      targetRoles,
      targetDepartments,
      targetEmploymentTypes,
      isActive,
      changeNotes
    } = req.body;

    const contentChanged = content && content !== doc.content;
    const titleChanged = title && title !== doc.title;

    // If content or title changed, push to version history and increment version
    if (contentChanged || titleChanged) {
      doc.versionHistory.push({
        version: doc.version,
        title: doc.title,
        content: doc.content,
        changeNotes: changeNotes || `Updated to version ${doc.version + 1}`,
        updatedAt: new Date(),
        updatedBy: req.user.userId
      });

      doc.version += 1;
    }

    if (title) doc.title = title;
    if (category) doc.category = category;
    if (description !== undefined) doc.description = description;
    if (content) doc.content = content;
    if (assignmentType) doc.assignmentType = assignmentType;
    if (targetUsers) doc.targetUsers = targetUsers;
    if (targetRoles) doc.targetRoles = targetRoles;
    if (targetDepartments) doc.targetDepartments = targetDepartments;
    if (targetEmploymentTypes) doc.targetEmploymentTypes = targetEmploymentTypes;
    if (isActive !== undefined) doc.isActive = isActive;

    await doc.save();

    res.json({ message: `Document updated to Version ${doc.version}`, document: doc });
  } catch (error) {
    res.status(500).json({ message: 'Error updating document', error: error.message });
  }
});

// @route   GET /api/documents/admin/:id/audit
// @desc    Get audit trail of all signatures and access records for a document
// @access  Admin/SuperAdmin
router.get('/admin/:id/audit', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const signatures = await DocumentSignature.find({ documentId: doc._id })
      .populate('userId', 'fullName employeeId email jobTitle employmentType')
      .sort({ signedAt: -1 });

    res.json({ document: doc, signatures });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving audit logs', error: error.message });
  }
});

// @route   POST /api/documents/admin/signatures/:id/revoke
// @desc    Revoke a document signature
// @access  Admin/SuperAdmin
router.post('/admin/signatures/:id/revoke', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const sig = await DocumentSignature.findById(req.params.id);
    if (!sig) {
      return res.status(404).json({ message: 'Signature not found' });
    }

    sig.status = 'revoked';
    sig.revokedAt = new Date();
    sig.revocationReason = reason || 'Revoked by administrator';
    await sig.save();

    res.json({ message: 'Document signature revoked successfully', signature: sig });
  } catch (error) {
    res.status(500).json({ message: 'Error revoking signature', error: error.message });
  }
});

export default router;
