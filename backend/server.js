import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import User from './models/User.js';
import Session from './models/Session.js';

const app = express();
app.use(cors());
app.use(express.json());

// --- Database Connection ---
const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (mongoose.connection.readyState >= 1) return;
    await mongoose.connect(uri);
    console.log('✅ MongoDB Connected and Synced');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err);
  }
};

connectDB();

// --- Additional Config Schema ---
const ConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: mongoose.Schema.Types.Mixed
});
const Config = mongoose.models.Config || mongoose.model('Config', ConfigSchema);

// --- API Endpoints ---

// Global System Config
app.get('/api/config', async (req, res) => {
  let config = await Config.findOne({ key: 'system_settings' });
  if (!config) {
    config = new Config({ key: 'system_settings', value: { isLoginLocked: false, lastUpdated: new Date().toISOString() } });
    await config.save();
  }
  res.json(config.value);
});

app.post('/api/config', async (req, res) => {
  const updatedValue = { ...req.body, lastUpdated: new Date().toISOString() };
  await Config.findOneAndUpdate(
    { key: 'system_settings' },
    { value: updatedValue },
    { upsert: true }
  );
  res.json(updatedValue);
});

// Auth Endpoints
app.post('/api/auth/login', async (req, res) => {
  const { role, identifier, password } = req.body;
  
  if (role !== 'ADMIN') {
    const config = await Config.findOne({ key: 'system_settings' });
    if (config?.value?.isLoginLocked) {
      return res.status(403).json({ error: 'System is currently locked by Administrator.' });
    }
  }

  if (role === 'ADMIN' && identifier === 'admin' && password === 'admin123') {
    return res.json({ success: true, name: 'Root Admin', role: 'ADMIN' });
  }

  try {
    const user = await User.findOne({ role, identifier, password });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true, name: user.name, role: user.role });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { identifier, name, password, role } = req.body;
    
    // Manual check for required fields to provide better error messages
    if (!identifier || !name || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields: ID, Name, Password, and Role are required.' });
    }

    const user = new User(req.body);
    await user.save();
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Registration error details:', err);
    if (err.code === 11000) {
      res.status(400).json({ error: `The ID "${req.body.identifier}" is already registered.` });
    } else {
      res.status(400).json({ error: err.message || 'Registration failed due to a validation error.' });
    }
  }
});

// Student Endpoints
app.get('/api/students', async (req, res) => {
  const students = await User.find({ role: 'STUDENT' });
  res.json(students);
});

app.get('/api/students/:id', async (req, res) => {
  const student = await User.findOne({ identifier: req.params.id, role: 'STUDENT' });
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json(student);
});

app.post('/api/students/:id/reset-device', async (req, res) => {
  await User.updateOne({ identifier: req.params.id }, { $unset: { deviceId: 1 } });
  res.json({ success: true });
});

app.delete('/api/students/:id', async (req, res) => {
  await User.deleteOne({ identifier: req.params.id });
  res.json({ success: true });
});

// Teacher Endpoints
app.get('/api/teachers', async (req, res) => {
  const teachers = await User.find({ role: 'TEACHER' });
  res.json(teachers);
});

app.get('/api/teachers/:id', async (req, res) => {
  const teacher = await User.findOne({ identifier: req.params.id, role: 'TEACHER' });
  if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
  res.json(teacher);
});

app.delete('/api/teachers/:id', async (req, res) => {
  await User.deleteOne({ identifier: req.params.id, role: 'TEACHER' });
  res.json({ success: true });
});

// Session Endpoints
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

// Attendance Marking Logic
app.post('/api/sessions/:id/mark', async (req, res) => {
  const { id } = req.params;
  const { rollNumber, deviceId, name, department, section } = req.body;

  try {
    const session = await Session.findOne({ id, isActive: true });
    if (!session) return res.status(404).json({ error: 'Session not active' });

    if (session.attendance.some(r => r.rollNumber === rollNumber)) {
      return res.status(400).json({ error: 'Attendance already marked' });
    }

    const student = await User.findOne({ identifier: rollNumber, role: 'STUDENT' });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    if (student.deviceId && student.deviceId !== deviceId) {
      return res.status(403).json({ error: 'Device mismatch. Identity locked to another device.' });
    }

    const otherStudent = await User.findOne({ deviceId, identifier: { $ne: rollNumber } });
    if (otherStudent) {
      return res.status(403).json({ error: `Device proxy detected. Already used by ${otherStudent.name}` });
    }

    if (!student.deviceId) {
      student.deviceId = deviceId;
      await student.save();
    }

    session.attendance.push({ rollNumber, name, deviceId, timestamp: new Date() });
    await session.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark attendance' });
  }
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`🚀 Server Running on Port ${PORT}`);
});
