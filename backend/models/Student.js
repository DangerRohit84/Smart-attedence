
import mongoose from 'mongoose';

const StudentSchema = new mongoose.Schema({
  rollNumber: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  department: String,
  section: String,
  phone: String,
  deviceId: String, // Bound physical device ID
}, { timestamps: true });

export default mongoose.models.Student || mongoose.model('Student', StudentSchema);
