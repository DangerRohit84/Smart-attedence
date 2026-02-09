
import mongoose from 'mongoose';

const TeacherSchema = new mongoose.Schema({
  identifier: { 
    type: String, 
    required: [true, 'Faculty ID is required'], 
    unique: true,
    trim: true,
    uppercase: true
  },
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true 
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'] 
  },
  department: {
    type: String,
    trim: true
  },
  role: { 
    type: String, 
    default: 'TEACHER' 
  }
}, { 
  timestamps: true,
  collection: 'teachers' // Explicitly set collection name
});

// Ensure indexes are created
TeacherSchema.index({ identifier: 1 }, { unique: true });

const Teacher = mongoose.models.Teacher || mongoose.model('Teacher', TeacherSchema);
export default Teacher;
