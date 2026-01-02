
import mongoose from 'mongoose';

const AttendanceRecordSchema = new mongoose.Schema({
  rollNumber: String,
  name: String,
  department: String,
  section: String,
  timestamp: { type: Date, default: Date.now },
  deviceId: String
});

const SessionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  courseName: { type: String, required: true },
  startTime: { type: Date, default: Date.now },
  teacherId: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  attendance: [AttendanceRecordSchema]
}, { timestamps: true });

export default mongoose.models.Session || mongoose.model('Session', SessionSchema);
