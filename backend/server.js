
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import Student from './models/Student.js';
import Teacher from './models/Teacher.js';
import Session from './models/Session.js';
import User from './models/User.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Database Connection & Seeding ---
const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (mongoose.connection.readyState >= 1) return;
    
    await mongoose.connect(uri);
    console.log('✅ MongoDB Connected');
    
    // Seed default admin if none exists in the database
    const adminExists = await User.findOne({ role: 'ADMIN' });
    if (!adminExists) {
      const defaultAdmin = new User({
        identifier: 'admin',
        name: 'System Administrator',
        password: 'admin', // This is now the default password stored in the DB
        role: 'ADMIN'
      });
      await defaultAdmin.save();
      console.log('💎 Default Admin Account Created in Database (ID: admin / Pass: admin)');
    } else {
      console.log('💎 Administrator account verified in database.');
    }
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err);
  }
};

// Start connection process
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
    await Config.findOneAndUpdate(
      { key: 'system_settings' },
      { value: updatedValue },
      { upsert: true }
    );
    res.json(updatedValue);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// Auth Endpoints
app.post('/api/auth/login', async (req, res) => {
  const { role, identifier, password } = req.body;
  
  if (!identifier || !password) {
    return res.status(400).json({ error: 'ID and Password are required.' });
  }

  const idLower = identifier.toLowerCase();

  try {
    let user = null;
    
    // Check system lock first (Admins/admin identifiers are exempt)
    if (role !== 'ADMIN' && idLower !== 'admin') {
      const config = await Config.findOne({ key: 'system_settings' });
      if (config?.value?.isLoginLocked) {
        return res.status(403).json({ error: 'System is currently locked by Administrator.' });
      }
    }

    // AUTHENTICATION LOGIC: Strictly query the database
    if (idLower === 'admin' || role === 'ADMIN') {
      // Look in the User collection for an Admin
      user = await User.findOne({ 
        identifier: idLower, 
        role: 'ADMIN', 
        password: password // Directly comparing stored password
      });
    } else if (role === 'STUDENT') {
      user = await Student.findOne({ 
        rollNumber: identifier.toUpperCase(), 
        password: password 
      });
    } else if (role === 'TEACHER') {
      user = await Teacher.findOne({ 
        employeeId: identifier, 
        password: password 
      });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. Please check your ID and password.' });
    }

    // Success response
    res.json({
      success: true,
      name: user.name,
      role: user.role || role,
      identifier: identifier.toUpperCase()
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during authentication.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { identifier, name, password, role, department, section, phone } = req.body;
    const idLower = identifier.toLowerCase();
    
    if (!identifier || !name || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    if (idLower === 'admin' || role === 'ADMIN') {
      const existing = await User.findOne({ identifier: idLower, role: 'ADMIN' });
      if (existing) return res.status(400).json({ error: 'Admin identifier already exists.' });
      
      const admin = new User({
        identifier: idLower,
        name,
        password,
        role: 'ADMIN'
      });
      await admin.save();
    } else if (role === 'STUDENT') {
      const existing = await Student.findOne({ rollNumber: identifier.toUpperCase() });
      if (existing) return res.status(400).json({ error: 'Student already registered.' });
      
      const student = new Student({
        rollNumber: identifier.toUpperCase(),
        name,
        password,
        department,
        section,
        phone
      });
      await student.save();
    } else if (role === 'TEACHER') {
      const existing = await Teacher.findOne({ employeeId: identifier });
      if (existing) return res.status(400).json({ error: 'Teacher already registered.' });
      
      const teacher = new Teacher({
        employeeId: identifier,
        name,
        password,
        department
      });
      await teacher.save();
    }

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('❌ Registration error:', err);
    res.status(400).json({ error: 'Registration failed.' });
  }
});

// Bulk Import
app.post('/api/students/bulk', async (req, res) => {
  try {
    const studentsData = req.body.students;
    if (!Array.isArray(studentsData)) return res.status(400).json({ error: 'Invalid data format' });

    let addedCount = 0;
    let skippedCount = 0;

    for (const data of studentsData) {
      const normalizedRoll = data.rollNumber.toUpperCase();
      const existing = await Student.findOne({ rollNumber: normalizedRoll });
      
      if (!existing) {
        const student = new Student({
          rollNumber: normalizedRoll,
          name: data.name,
          password: data.password,
          department: data.department,
          section: data.section,
          phone: data.phone
        });
        await student.save();
        addedCount++;
      } else {
        skippedCount++;
      }
    }

    res.json({ success: true, added: addedCount, skipped: skippedCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process bulk import' });
  }
});

// List Endpoints
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

app.get('/api/teachers', async (req, res) => {
  const teachers = await Teacher.find();
  res.json(teachers);
});

app.get('/api/teachers/:id', async (req, res) => {
  const teacher = await Teacher.findOne({ employeeId: req.params.id });
  if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
  res.json(teacher);
});

app.delete('/api/teachers/:id', async (req, res) => {
  await Teacher.deleteOne({ employeeId: req.params.id });
  res.json({ success: true });
});

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

// Attendance Marking
app.post('/api/sessions/:id/mark', async (req, res) => {
  const { id } = req.params;
  const { rollNumber, deviceId, name, department, section } = req.body;

  try {
    const session = await Session.findOne({ id, isActive: true });
    if (!session) return res.status(404).json({ error: 'Session not active' });

    const normalizedRoll = rollNumber.toUpperCase();

    if (session.attendance.some(r => r.rollNumber === normalizedRoll)) {
      return res.status(400).json({ error: 'Attendance already marked' });
    }

    const student = await Student.findOne({ rollNumber: normalizedRoll });
    if (!student) return res.status(404).json({ error: 'Student record not found.' });

    if (student.deviceId && student.deviceId !== deviceId) {
      return res.status(403).json({ error: 'Device mismatch. Identity locked to another device.' });
    }

    const otherStudent = await Student.findOne({ deviceId, rollNumber: { $ne: normalizedRoll } });
    if (otherStudent) return res.status(403).json({ error: `Device proxy detected. Already used by ${otherStudent.name}` });

    if (!student.deviceId) {
      student.deviceId = deviceId;
      await student.save();
    }

    session.attendance.push({ 
      rollNumber: normalizedRoll, 
      name, 
      department: department || student.department,
      section: section || student.section,
      deviceId, 
      timestamp: new Date() 
    });
    await session.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark attendance' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server Running on Port ${PORT}`);
});
