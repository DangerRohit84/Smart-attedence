
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  role: { type: String, enum: ['STUDENT', 'TEACHER', 'ADMIN'], required: true },
  identifier: { type: String, required: true, unique: true }, // rollNumber or employeeId
  name: { type: String, required: true },
  password: { type: String, required: true },
  department: String,
  section: String,
  phone: String,
  deviceId: String, // Bound physical device ID
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);
