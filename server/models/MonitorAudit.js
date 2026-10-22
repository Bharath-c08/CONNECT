import mongoose from 'mongoose';

const MonitorAuditSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actionType: {
      type: String,
      enum: ['camera_start', 'camera_stop', 'snapshot_captured', 'nudge_sent', 'idle_warning'],
      required: true,
    },
    title: {
      type: String,
      default: '',
    },
    details: {
      type: String,
      default: '',
    },
    snapshotData: {
      type: String, // base64 preview or reference if captured
      default: '',
    },
    metricsSnapshot: {
      productivityScore: { type: Number, default: 0 },
      eventsPerMinute: { type: Number, default: 0 },
      mouseMovements: { type: Number, default: 0 },
      mouseClicks: { type: Number, default: 0 },
      keyPresses: { type: Number, default: 0 },
      idleMinutes: { type: Number, default: 0 },
      shiftElapsedMinutes: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export default mongoose.model('MonitorAudit', MonitorAuditSchema);
