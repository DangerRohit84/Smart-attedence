
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
    // We check specifically for the 'admin' identifier to prevent duplicates
    const adminExists = await User.findOne({ identifier: 'admin' });
    if (!adminExists) {
      const defaultAdmin = new User({
        identifier: 'admin',
        name: 'System Administrator',
        password: 'admin', // Stored as plain text in this example, should be hashed in production
        role: 'ADMIN'
      });
      await defaultAdmin.save();
      console.log('💎 Seeding: Default Admin account created (admin / admin)');
    } else {
      console.log('💎 Database: Admin account already exists and is ready.');
    }
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
  let { role, identifier, password } = req.body;
  
  if (!identifier || !password) {
    return res.status(400).json({ error: 'ID and Password are required.' });
  }

  // Sanitize inputs
  identifier = identifier.trim();
  password = password.trim();
  const idLower = identifier.toLowerCase();

  console.log(`[Auth] Login Attempt: ${idLower} as ${role}`);

  try {
    let user = null;
    
    // Check system lock first (Admin identifier is exempt)
    if (idLower !== 'admin' && role !== 'ADMIN') {
      const config = await Config.findOne({ key: 'system_settings' });
      if (config?.value?.isLoginLocked) {
        return res.status(403).json({ error: 'System is currently locked by Administrator.' });
      }
    }

    // AUTHENTICATION: Strictly query database based on role or keyword
    if (idLower === 'admin' || role === 'ADMIN') {
      // Admin always lives in the User collection
      user = await User.findOne({ 
        identifier: idLower, 
        role: 'ADMIN', 
        password: password 
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
      console.warn(`[Auth] Failed login for ${idLower}`);
      return res.status(401).json({ error: 'Invalid credentials. Please check your ID and password.' });
    }

    console.log(`[Auth] Successful login for ${user.name} (${user.role || role})`);

    res.json({
      success: true,
      name: user.name,
      role: user.role || role,
      identifier: identifier.toUpperCase()
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { identifier, name, password, role, department, section, phone } = req.body;
    const idTrimmed = identifier?.trim();
    const idLower = idTrimmed?.toLowerCase();
    const passTrimmed = password?.trim();
    
    if (!idTrimmed || !name || !passTrimmed || !role) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    if (idLower === 'admin' || role === 'ADMIN') {
      const existing = await User.findOne({ identifier: idLower });
      if (existing) return res.status(400).json({ error: 'Admin identifier already exists.' });
      
      const admin = new User({
        identifier: idLower,
        name: name.trim(),
        password: passTrimmed,
        role: 'ADMIN'
      });
      await admin.save();
    } else if (role === 'STUDENT') {
      const existing = await Student.findOne({ rollNumber: idTrimmed.toUpperCase() });
      if (existing) return res.status(400).json({ error: 'Student already registered.' });
      
      const student = new Student({
        rollNumber: idTrimmed.toUpperCase(),
        name: name.trim(),
        password: passTrimmed,
        department,
        section,
        phone
      });
      await student.save();
    } else if (role === 'TEACHER') {
      const existing = await Teacher.findOne({ employeeId: idTrimmed });
      if (existing) return res.status(400).json({ error: 'Teacher already registered.' });
      
      const teacher = new Teacher({
        employeeId: idTrimmed,
        name: name.trim(),
        password: passTrimmed,
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

app.post('/api/students/bulk', async (req, res) => {
  try {
    const studentsData = req.body.students;
    if (!Array.isArray(studentsData)) return res.status(400).json({ error: 'Invalid data format' });

    let addedCount = 0;
    let skippedCount = 0;

    for (const data of studentsData) {
      const normalizedRoll = data.rollNumber.trim().toUpperCase();
      const existing = await Student.findOne({ rollNumber: normalizedRoll });
      
      if (!existing) {
        const student = new Student({
          rollNumber: normalizedRoll,
          name: data.name.trim(),
          password: data.password.trim(),
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

app.post('/api/sessions/:id/mark', async (req, res) => {
  const { id } = req.params;
  const { rollNumber, deviceId, name, department, section } = req.body;

  try {
    const session = await Session.findOne({ id, isActive: true });
    if (!session) return res.status(404).json({ error: 'Session not active' });

    const normalizedRoll = rollNumber.trim().toUpperCase();

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
      name: name.trim(), 
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
