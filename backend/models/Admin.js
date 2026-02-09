
import mongoose from 'mongoose';

const AdminSchema = new mongoose.Schema({
  identifier: { type: String, required: true, unique: true }, // e.g., ADMIN01
  name: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, default: 'ADMIN' }
}, { timestamps: true });

export default mongoose.models.Admin || mongoose.model('Admin', AdminSchema);
