import { StudentProfile, TeacherProfile, AttendanceSession, SystemConfig, UserRole } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export const storageService = {
  // Device Fingerprinting
  getDeviceSignature: (): string => {
    let sig = localStorage.getItem('edutrack_device_signature');
    if (!sig) {
      sig = 'dev_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      localStorage.setItem('edutrack_device_signature', sig);
    }
    return sig;
  },

  // Auth
  login: async (role: string, identifier: string, pass: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, identifier, password: pass })
    });
    return res.json();
  },

  register: async (role: string, data: any) => {
    // Ensure we don't overwrite identifier with undefined if it already exists in data
    const payload = {
      ...data,
      role,
      identifier: data.identifier || data.rollNumber || data.employeeId
    };
    
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  // Students
  getAllStudents: async (): Promise<StudentProfile[]> => {
    const res = await fetch(`${API_BASE}/students`);
    return res.json();
  },

  getStudent: async (rollNumber: string): Promise<StudentProfile | undefined> => {
    const res = await fetch(`${API_BASE}/students/${rollNumber}`);
    if (!res.ok) return undefined;
    return res.json();
  },

  deleteStudent: async (rollNumber: string): Promise<void> => {
    await fetch(`${API_BASE}/students/${rollNumber}`, { method: 'DELETE' });
  },

  resetStudentDevice: async (rollNumber: string): Promise<void> => {
    await fetch(`${API_BASE}/students/${rollNumber}/reset-device`, { method: 'POST' });
  },

  // Teachers
  getAllTeachers: async (): Promise<TeacherProfile[]> => {
    const res = await fetch(`${API_BASE}/teachers`);
    return res.json();
  },

  getTeacher: async (employeeId: string): Promise<TeacherProfile | undefined> => {
    const res = await fetch(`${API_BASE}/teachers/${employeeId}`);
    if (!res.ok) return undefined;
    return res.json();
  },

  deleteTeacher: async (employeeId: string): Promise<void> => {
    await fetch(`${API_BASE}/teachers/${employeeId}`, { method: 'DELETE' });
  },

  // Sessions
  getSessions: async (): Promise<AttendanceSession[]> => {
    const res = await fetch(`${API_BASE}/sessions`);
    return res.json();
  },

  saveSession: async (session: AttendanceSession): Promise<void> => {
    await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });
  },

  saveSessions: async (sessions: AttendanceSession[]): Promise<void> => {
    for (const session of sessions) {
      if (session.isActive) {
        await fetch(`${API_BASE}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(session)
        });
      } else {
        await fetch(`${API_BASE}/sessions/${session.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(session)
        });
      }
    }
  },

  updateSession: async (session: AttendanceSession): Promise<void> => {
    await fetch(`${API_BASE}/sessions/${session.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });
  },

  markAttendance: async (sessionId: string, data: any) => {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Global Config
  getSystemConfig: async (): Promise<SystemConfig> => {
    const res = await fetch(`${API_BASE}/config`);
    if (!res.ok) return { isLoginLocked: false, lastUpdated: new Date().toISOString() };
    return res.json();
  },

  setSystemConfig: async (config: SystemConfig): Promise<void> => {
    await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  }
};