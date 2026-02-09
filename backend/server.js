
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import Student from './models/Student.js';
import Session from './models/Session.js';
import User from './models/User.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Database Connection (No Seeding as requested) ---
const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (mongoose.connection.readyState >= 1) return;
    await mongoose.connect(uri);
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err);
  }
};

connectDB();

// --- System Config Schema ---
const ConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: mongoose.Schema.Types.Mixed
});
const Config = mongoose.models.Config || mongoose.model('Config', ConfigSchema);

// --- API Endpoints ---

// System Config
app.get('/api/config', async (req, res) => {
  try {
    let config = await Config.findOne({ key: 'system_settings' });
    if (!config) {
      config = new Config({ key: 'system_settings', value: { isLoginLocked: false, lastUpdated: new Date().toISOString() } });
      await config.save();
    }
    res.json(config.value);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    const updatedValue = { ...req.body, lastUpdated: new Date().toISOString() };
    await Config.findOneAndUpdate({ key: 'system_settings' }, { value: updatedValue }, { upsert: true });
    res.json(updatedValue);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// --- Auth Endpoints ---

app.post('/api/auth/login', async (req, res) => {
  const { role, identifier, password } = req.body;
  
  if (!identifier || !password) {
    return res.status(400).json({ error: 'ID and Password are required.' });
  }

  // Force identifier to uppercase
  const idUpper = identifier.trim().toUpperCase();
  const passTrimmed = password.trim();

  try {
    let user = null;
    
    if (role === 'STUDENT') {
      user = await Student.findOne({ rollNumber: idUpper, password: passTrimmed });
    } else {
      // For TEACHER/ADMIN portals, check the User collection
      // The role in the portal is just a hint; we use the role stored in the DB
      user = await User.findOne({ identifier: idUpper, password: passTrimmed });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. Check your ID and password.' });
    }

    const finalRole = user.role || 'STUDENT';

    // System Lock Check (Admins are always exempt)
    if (finalRole !== 'ADMIN') {
      const config = await Config.findOne({ key: 'system_settings' });
      if (config?.value?.isLoginLocked) {
        return res.status(403).json({ error: 'System is currently locked. Contact Administrator.' });
      }
    }

    res.json({
      success: true,
      name: user.name,
      role: finalRole,
      identifier: idUpper
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { identifier, name, password, role, department, section, phone } = req.body;
    if (!identifier || !name || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const idUpper = identifier.trim().toUpperCase();
    const passTrimmed = password.trim();

    // Prevent public registration as ADMIN
    if (role === 'ADMIN') {
      return res.status(403).json({ error: 'Admin accounts cannot be created via signup.' });
    }

    if (role === 'STUDENT') {
      const existing = await Student.findOne({ rollNumber: idUpper });
      if (existing) return res.status(400).json({ error: 'Student roll number already exists' });
      
      const student = new Student({
        rollNumber: idUpper,
        name: name.trim(),
        password: passTrimmed,
        department,
        section,
        phone
      });
      await student.save();
    } else if (role === 'TEACHER') {
      const existing = await User.findOne({ identifier: idUpper });
      if (existing) return res.status(400).json({ error: 'Faculty ID already exists' });
      
      const user = new User({
        identifier: idUpper,
        name: name.trim(),
        password: passTrimmed,
        role: 'TEACHER',
        department
      });
      await user.save();
    }

    res.status(201).json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Registration failed' });
  }
});

// --- User Management (Admin Dashboard helpers) ---

app.get('/api/students', async (req, res) => {
  const students = await Student.find();
  res.json(students);
});

app.get('/api/teachers', async (req, res) => {
  // Only return users with role TEACHER (Admins managed separately or filtered)
  const teachers = await User.find({ role: 'TEACHER' });
  res.json(teachers);
});

app.delete('/api/students/:id', async (req, res) => {
  await Student.deleteOne({ rollNumber: req.params.id.toUpperCase() });
  res.json({ success: true });
});

app.delete('/api/teachers/:id', async (req, res) => {
  await User.deleteOne({ identifier: req.params.id.toUpperCase(), role: 'TEACHER' });
  res.json({ success: true });
});

// --- Sessions & Attendance ---
// (Existing session logic remains compatible as it uses idUpper)
app.get('/api/sessions', async (req, res) => {
  const sessions = await Session.find().sort({ createdAt: -1 });
  res.json(sessions);
});

app.post('/api/sessions', async (req, res) => {
  const session = new Session(req.body);
  await session.save();
  res.status(201).json(session);
});

app.put('/api/sessions/:id', async (req, res) => {
  const session = await Session.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
  res.json(session);
});

app.post('/api/sessions/:id/mark', async (req, res) => {
  const { id } = req.params;
  const { rollNumber, deviceId, name, department, section } = req.body;
  try {
    const session = await Session.findOne({ id, isActive: true });
    if (!session) return res.status(404).json({ error: 'Session not active' });
    const idUpper = rollNumber.trim().toUpperCase();
    
    if (session.attendance.some(r => r.rollNumber === idUpper)) {
      return res.status(400).json({ error: 'Already marked' });
    }

    const student = await Student.findOne({ rollNumber: idUpper });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    if (student.deviceId && student.deviceId !== deviceId) {
      return res.status(403).json({ error: 'Identity locked to another device.' });
    }

    const other = await Student.findOne({ deviceId, rollNumber: { $ne: idUpper } });
    if (other) return res.status(403).json({ error: `Device used by ${other.name}` });

    if (!student.deviceId) {
      student.deviceId = deviceId;
      await student.save();
    }

    session.attendance.push({ 
      rollNumber: idUpper, 
      name: name.trim(), 
      department: department || student.department, 
      section: section || student.section, 
      deviceId, 
      timestamp: new Date() 
    });
    await session.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server Running on Port ${PORT}`));
