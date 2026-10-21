import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      default: 'General Agreement',
      enum: [
        'General Agreement',
        'Code of Conduct',
        'Non-Disclosure Agreement (NDA)',
        'Information Security Policy',
        'Employment Terms',
        'Remote Work Guidelines',
        'Equipment Consent',
        'Other'
      ]
    },
    description: { type: String, default: '' },
    content: { type: String, required: true },
    version: { type: Number, default: 1 },
    versionHistory: [
      {
        version: { type: Number, required: true },
        title: { type: String, required: true },
        content: { type: String, required: true },
        changeNotes: { type: String, default: 'Document version update' },
        updatedAt: { type: Date, default: Date.now },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
      }
    ],
    assignmentType: {
      type: String,
      enum: ['all', 'specific_users', 'role', 'department', 'employment_type'],
      default: 'all'
    },
    targetUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    targetRoles: [{ type: String }], // 'user', 'admin', 'superadmin'
    targetDepartments: [{ type: String }],
    targetEmploymentTypes: [{ type: String }], // 'fulltime', 'parttime', 'Intern'
    isActive: { type: Boolean, default: true },
    requiresAcknowledgment: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export default mongoose.model('Document', DocumentSchema);
