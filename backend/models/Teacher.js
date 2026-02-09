
import mongoose from 'mongoose';

const TeacherSchema = new mongoose.Schema({
  identifier: { type: String, required: true, unique: true }, // e.g., EMP101
  name: { type: String, required: true },
  password: { type: String, required: true },
  department: String,
  role: { type: String, default: 'TEACHER' }
}, { timestamps: true });

export default mongoose.models.Teacher || mongoose.model('Teacher', TeacherSchema);
