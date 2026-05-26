import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'user'],
      default: 'user',
    },
    fullName: { type: String, required: true },
    dob: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    address: { type: String },
    phone: { type: String },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    jobTitle: { type: String },
    joiningDate: { type: Date },
    employmentType: {
      type: String,
      enum: ['Intern', 'parttime', 'fulltime'],
      default: 'fulltime',
    },
    employeeId: { type: String, required: true, unique: true, trim: true },
    basicPay: { type: Number, default: 0 }, // Hourly rate or base wage
    overtimeEligible: { type: Boolean, default: false },
    overtimePayPerMinute: { type: Number, default: 0 },
    panDetails: { type: String },
    aadhaarDetails: { type: String },
    bankAccountNumber: { type: String },
    accountHolderFullName: { type: String },
    ifscCode: { type: String },
    branchName: { type: String },
    bloodGroup: { type: String },
    emergencyContactNumber: { type: String },
    emergencyContactName: { type: String },
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
    leaveLimits: {
      type: Map,
      of: Number,
      default: () => new Map([
        ['sick', 10],
        ['casual', 10],
        ['annual', 15],
        ['unpaid', 365],
        ['other', 10]
      ])
    },
  },
  { timestamps: true }
);

export default mongoose.model('User', UserSchema);
