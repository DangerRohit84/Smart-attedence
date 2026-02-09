
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import Student from './models/Student.js';
import Teacher from './models/Teacher.js';
import Admin from './models/Admin.js';
import Session from './models/Session.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

const ConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: mongoose.Schema.Types.Mixed
});
const Config = mongoose.models.Config || mongoose.model('Config', ConfigSchema);

// --- Config API ---
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

// --- Separate Auth ---
app.post('/api/auth/login', async (req, res) => {
  const { role, identifier, password } = req.body;
  if (!identifier || !password) return res.status(400).json({ error: 'ID and Password are required.' });

  const idUpper = identifier.trim().toUpperCase();
  const passTrimmed = password.trim();

  try {
    const config = await Config.findOne({ key: 'system_settings' });
    const isLocked = config?.value?.isLoginLocked;

    let user = null;
    let finalRole = role;

    if (role === 'STUDENT') {
      if (isLocked) return res.status(403).json({ error: 'System is currently locked.' });
      user = await Student.findOne({ rollNumber: idUpper, password: passTrimmed });
      finalRole = 'STUDENT';
    } else {
      // For TEACHER portal, check both Teacher and Admin collections
      // Teachers are subject to lock, Admins are not.
      const adminUser = await Admin.findOne({ identifier: idUpper, password: passTrimmed });
      if (adminUser) {
        user = adminUser;
        finalRole = 'ADMIN';
      } else {
        if (isLocked) return res.status(403).json({ error: 'System is currently locked.' });
        user = await Teacher.findOne({ identifier: idUpper, password: passTrimmed });
        finalRole = 'TEACHER';
      }
    }

    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

    res.json({
      success: true,
      name: user.name,
      role: finalRole,
      identifier: idUpper
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { identifier, name, password, role, department, section, phone } = req.body;
    if (!identifier || !name || !password || !role) return res.status(400).json({ error: 'Missing fields.' });

    const idUpper = identifier.trim().toUpperCase();
    if (role === 'ADMIN') return res.status(403).json({ error: 'Admin signup restricted.' });

    if (role === 'STUDENT') {
      const existing = await Student.findOne({ rollNumber: idUpper });
      if (existing) return res.status(400).json({ error: 'Roll number exists.' });
      await new Student({ rollNumber: idUpper, name: name.trim(), password: password.trim(), department, section, phone }).save();
    } else if (role === 'TEACHER') {
      const existing = await Teacher.findOne({ identifier: idUpper });
      if (existing) return res.status(400).json({ error: 'ID exists.' });
      await new Teacher({ identifier: idUpper, name: name.trim(), password: password.trim(), department }).save();
    }
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Registration failed.' });
  }
});

// --- User Management ---
app.get('/api/students', async (req, res) => res.json(await Student.find().sort({ rollNumber: 1 })));
app.get('/api/students/:id', async (req, res) => res.json(await Student.findOne({ rollNumber: req.params.id.toUpperCase() })));
app.delete('/api/students/:id', async (req, res) => {
  await Student.deleteOne({ rollNumber: req.params.id.toUpperCase() });
  res.json({ success: true });
});
app.post('/api/students/:id/reset-device', async (req, res) => {
  await Student.updateOne({ rollNumber: req.params.id.toUpperCase() }, { $unset: { deviceId: 1 } });
  res.json({ success: true });
});
app.post('/api/students/bulk', async (req, res) => {
  try {
    const studentsData = req.body.students;
    let added = 0, skipped = 0;
    for (const data of studentsData) {
      const roll = data.rollNumber.trim().toUpperCase();
      if (!(await Student.findOne({ rollNumber: roll }))) {
        await new Student({ ...data, rollNumber: roll, password: data.password.trim() }).save();
        added++;
      } else skipped++;
    }
    res.json({ success: true, added, skipped });
  } catch (err) { res.status(500).json({ error: 'Bulk failed.' }); }
});

app.get('/api/teachers', async (req, res) => res.json(await Teacher.find().sort({ identifier: 1 })));
app.get('/api/teachers/:id', async (req, res) => res.json(await Teacher.findOne({ identifier: req.params.id.toUpperCase() })));
app.delete('/api/teachers/:id', async (req, res) => {
  await Teacher.deleteOne({ identifier: req.params.id.toUpperCase() });
  res.json({ success: true });
});

// --- Sessions ---
app.get('/api/sessions', async (req, res) => res.json(await Session.find().sort({ createdAt: -1 })));
app.post('/api/sessions', async (req, res) => res.status(201).json(await new Session(req.body).save()));
app.put('/api/sessions/:id', async (req, res) => res.json(await Session.findOneAndUpdate({ id: req.params.id }, req.body, { new: true })));

app.post('/api/sessions/:id/mark', async (req, res) => {
  const { id } = req.params;
  const { rollNumber, deviceId, name, department, section } = req.body;
  try {
    const session = await Session.findOne({ id, isActive: true });
    if (!session) return res.status(404).json({ error: 'Session not active.' });
    const roll = rollNumber.trim().toUpperCase();
    if (session.attendance.some(r => r.rollNumber === roll)) return res.status(400).json({ error: 'Already marked.' });
    const student = await Student.findOne({ rollNumber: roll });
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (student.deviceId && student.deviceId !== deviceId) return res.status(403).json({ error: 'Device locked.' });
    if (await Student.findOne({ deviceId, rollNumber: { $ne: roll } })) return res.status(403).json({ error: 'Device mismatch.' });
    if (!student.deviceId) { student.deviceId = deviceId; await student.save(); }
    session.attendance.push({ rollNumber: roll, name, department, section, deviceId, timestamp: new Date() });
    await session.save();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Port ${PORT}`));
