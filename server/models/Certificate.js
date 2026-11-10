import mongoose from 'mongoose';

const CertificateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    employeeId: {
      type: String,
      required: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    certificateType: {
      type: String,
      enum: ['noc_letter', 'relieving_letter', 'experience_letter', 'bonafide_letter', 'custom_certificate'],
      default: 'noc_letter',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    issueDate: {
      type: Date,
      default: Date.now,
    },
    effectiveDate: {
      type: Date,
      default: Date.now,
    },
    content: {
      type: String,
      required: true,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    issuedByName: {
      type: String,
      default: 'Authorized Signatory',
    },
    issuedByRole: {
      type: String,
      default: 'Administration',
    },
    status: {
      type: String,
      enum: ['issued', 'revoked'],
      default: 'issued',
    },
    verificationCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    metadata: {
      designation: { type: String, default: '' },
      department: { type: String, default: 'Engineering & Operations' },
      joiningDate: { type: Date },
      relievingDate: { type: Date },
      reason: { type: String, default: '' },
      notes: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Certificate', CertificateSchema);

