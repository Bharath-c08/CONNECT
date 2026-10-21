import mongoose from 'mongoose';

const DocumentSignatureSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true
    },
    documentTitle: { type: String, required: true },
    documentVersion: { type: Number, required: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    signedAt: { type: Date, default: Date.now },
    ipAddress: { type: String, default: '127.0.0.1' },
    userAgent: { type: String, default: 'Unknown Client' },
    consentConfirmed: { type: Boolean, default: true },
    verificationId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    certificateHash: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['valid', 'revoked'],
      default: 'valid'
    },
    revokedAt: { type: Date },
    revocationReason: { type: String }
  },
  { timestamps: true }
);

// Compound index to ensure uniqueness per user per document version
DocumentSignatureSchema.index({ documentId: 1, userId: 1, documentVersion: 1 }, { unique: true });

export default mongoose.model('DocumentSignature', DocumentSignatureSchema);
