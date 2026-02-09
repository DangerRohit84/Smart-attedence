
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

// --- Database Connection ---
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
  let { role, identifier, password } = req.body;
  
  if (!identifier || !password) {
    return res.status(400).json({ error: 'ID and Password are required.' });
  }

  // FORCE IDENTIFIER TO UPPERCASE
  const idUpper = identifier.trim().toUpperCase();
  const passTrimmed = password.trim();

  try {
    // Determine user collection and perform check
    let user = null;
    
    if (role === 'STUDENT') {
      user = await Student.findOne({ rollNumber: idUpper, password: passTrimmed });
    } else {
      // Both TEACHER and ADMIN are stored in the User collection.
      // We look for the user and check their role.
      user = await User.findOne({ identifier: idUpper, password: passTrimmed });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. Please verify your ID and password.' });
    }

    // Role Enforcement Check
    // If logging in as STUDENT, user must exist in Student collection (which they do if found).
    // If logging via Faculty portal (TEACHER), we allow both TEACHER and ADMIN roles to pass.
    const finalRole = user.role || 'STUDENT';

    // System Lock Check: Only ADMIN role is exempt from the login lock
    if (finalRole !== 'ADMIN') {
      const config = await Config.findOne({ key: 'system_settings' });
      if (config?.value?.isLoginLocked) {
        return res.status(403).json({ error: 'System is currently locked by Administrator.' });
      }
    }

    res.json({
      success: true,
      name: user.name,
      role: finalRole,
      identifier: idUpper
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    let { identifier, name, password, role, department, section, phone } = req.body;
    if (!identifier || !name || !password || !role) return res.status(400).json({ error: 'Missing fields' });

    const idUpper = identifier.trim().toUpperCase();
    const passTrimmed = password.trim();

    if (role === 'STUDENT') {
      const existing = await Student.findOne({ rollNumber: idUpper });
      if (existing) return res.status(400).json({ error: 'Student roll number already exists' });
      const student = new Student({ rollNumber: idUpper, name: name.trim(), password: passTrimmed, department, section, phone });
      await student.save();
    } else {
      const existing = await User.findOne({ identifier: idUpper });
      if (existing) return res.status(400).json({ error: 'Identifier already exists in faculty records' });
      
      // Enforce specific role if user provided it (TEACHER or ADMIN)
      const userRole = (role === 'ADMIN' || role === 'TEACHER') ? role : 'TEACHER';
      
      const user = new User({ 
        identifier: idUpper, 
        name: name.trim(), 
        password: passTrimmed, 
        role: userRole, 
        department 
      });
      await user.save();
    }

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(400).json({ error: 'Registration failed. Check if ID is already in use.' });
  }
});

// --- Students ---
app.get('/api/students', async (req, res) => {
  const students = await Student.find();
  res.json(students);
});

app.get('/api/students/:id', async (req, res) => {
  const student = await Student.findOne({ rollNumber: req.params.id.toUpperCase() });
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json(student);
});

app.post('/api/students/:id/reset-device', async (req, res) => {
  await Student.updateOne({ rollNumber: req.params.id.toUpperCase() }, { $unset: { deviceId: 1 } });
  res.json({ success: true });
});

app.delete('/api/students/:id', async (req, res) => {
  await Student.deleteOne({ rollNumber: req.params.id.toUpperCase() });
  res.json({ success: true });
});

app.post('/api/students/bulk', async (req, res) => {
  try {
    const studentsData = req.body.students;
    let added = 0, skipped = 0;
    for (const data of studentsData) {
      const idUpper = data.rollNumber.trim().toUpperCase();
      const existing = await Student.findOne({ rollNumber: idUpper });
      if (!existing) {
        await new Student({ ...data, rollNumber: idUpper, password: data.password.trim() }).save();
        added++;
      } else skipped++;
    }
    res.json({ success: true, added, skipped });
  } catch (err) { res.status(500).json({ error: 'Bulk import failed' }); }
});

// --- Faculty Management ---
app.get('/api/teachers', async (req, res) => {
  // Returns all users with role TEACHER
  const teachers = await User.find({ role: 'TEACHER' });
  res.json(teachers);
});

app.get('/api/teachers/:id', async (req, res) => {
  const teacher = await User.findOne({ identifier: req.params.id.toUpperCase(), role: 'TEACHER' });
  if (!teacher) return res.status(404).json({ error: 'Faculty member not found' });
  res.json(teacher);
});

app.delete('/api/teachers/:id', async (req, res) => {
  await User.deleteOne({ identifier: req.params.id.toUpperCase(), role: 'TEACHER' });
  res.json({ success: true });
});

// --- Sessions ---
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
    if (!session) return res.status(404).json({ error: 'Session is no longer active' });
    const idUpper = rollNumber.trim().toUpperCase();
    if (session.attendance.some(r => r.rollNumber === idUpper)) return res.status(400).json({ error: 'Attendance already recorded for this session' });
    const student = await Student.findOne({ rollNumber: idUpper });
    if (!student) return res.status(404).json({ error: 'Student record not found in system' });
    if (student.deviceId && student.deviceId !== deviceId) return res.status(403).json({ error: 'Identity locked to another device. Contact Admin.' });
    const other = await Student.findOne({ deviceId, rollNumber: { $ne: idUpper } });
    if (other) return res.status(403).json({ error: `This device is already used by student: ${other.name}` });
    if (!student.deviceId) { student.deviceId = deviceId; await student.save(); }
    session.attendance.push({ rollNumber: idUpper, name: name.trim(), department: department || student.department, section: section || student.section, deviceId, timestamp: new Date() });
    await session.save();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to record attendance' }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server Running on Port ${PORT}`));
