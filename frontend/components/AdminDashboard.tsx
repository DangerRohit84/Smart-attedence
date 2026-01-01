import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { StudentProfile, TeacherProfile, AttendanceSession, SystemConfig } from '../types';

const AdminDashboard: React.FC = () => {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'config'>('students');

  const loadData = async () => {
    const [studentsData, teachersData, sessionsData, currentConfig] = await Promise.all([
      storageService.getAllStudents(),
      storageService.getAllTeachers(),
      storageService.getSessions(),
      storageService.getSystemConfig()
    ]);
    
    setStudents(studentsData);
    setTeachers(teachersData);
    setSessions(sessionsData);
    setConfig(currentConfig);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Periodic sync
    return () => clearInterval(interval);
  }, []);

  const toggleLock = async () => {
    if (!config) return;
    const newConfig = { ...config, isLoginLocked: !config.isLoginLocked, lastUpdated: new Date().toISOString() };
    await storageService.setSystemConfig(newConfig);
    setConfig(newConfig);
  };

  const handleResetDevice = async (rollNumber: string) => {
    if (!window.confirm("Reset device lock for this student?")) return;
    await storageService.resetStudentDevice(rollNumber);
    await loadData();
  };

  const handleDeleteUser = async (type: 'student' | 'teacher', id: string) => {
    if (!window.confirm(`Delete this ${type}?`)) return;
    if (type === 'student') await storageService.deleteStudent(id);
    else await storageService.deleteTeacher(id);
    await loadData();
  };

  if (!config) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 animate-in fade-in duration-1000">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Admin Terminal</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">Global System Control & Analytics</p>
        </div>
        <div className="flex gap-4">
          <div className={`px-6 py-3 rounded-2xl border flex items-center gap-3 transition-all ${config.isLoginLocked ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            <div className={`w-3 h-3 rounded-full animate-pulse ${config.isLoginLocked ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
            <span className="text-sm font-black uppercase tracking-widest">{config.isLoginLocked ? 'System Locked' : 'System Open'}</span>
          </div>
          <button onClick={toggleLock} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all shadow-xl shadow-slate-200">
            {config.isLoginLocked ? 'Unlock Logins' : 'Lock Logins'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Students', val: students.length, color: 'blue' },
          { label: 'Faculty Members', val: teachers.length, color: 'indigo' },
          { label: 'Total Sessions', val: sessions.length, color: 'emerald' },
          { label: 'Active Now', val: sessions.filter(s => s.isActive).length, color: 'amber' }
        ].map((stat, i) => (
          <div key={i} className="glass-card p-6 rounded-[2rem] border border-white shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
            <p className={`text-3xl font-black text-${stat.color}-600`}>{stat.val}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden min-h-[500px]">
        <div className="flex border-b border-slate-100 bg-slate-50/50">
          {['students', 'teachers', 'config'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 py-6 font-black text-xs uppercase tracking-[0.2em] transition-all ${activeTab === tab ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-8">
          {activeTab === 'students' && (
            <div className="space-y-4">
              <div className="grid grid-cols-12 px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <div className="col-span-4">Student Name</div>
                <div className="col-span-2">Roll Number</div>
                <div className="col-span-2">Security</div>
                <div className="col-span-4 text-right">Actions</div>
              </div>
              {students.length === 0 ? (
                <div className="p-20 text-center text-slate-400 font-bold">No students registered yet.</div>
              ) : students.map(s => (
                <div key={s.rollNumber} className="grid grid-cols-12 items-center bg-slate-50/50 p-6 rounded-3xl border border-slate-50 hover:border-blue-100 hover:bg-white transition-all">
                  <div className="col-span-4">
                    <p className="font-black text-slate-900">{s.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{s.department} &bull; Sec {s.section}</p>
                  </div>
                  <div className="col-span-2 font-bold text-blue-600">{s.rollNumber}</div>
                  <div className="col-span-2">
                    {s.deviceId ? (
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase rounded-lg border border-emerald-200">Device Locked</span>
                    ) : (
                      <span className="px-3 py-1 bg-slate-100 text-slate-400 text-[9px] font-black uppercase rounded-lg border border-slate-200">No Link</span>
                    )}
                  </div>
                  <div className="col-span-4 text-right flex justify-end gap-2">
                    {s.deviceId && (
                      <button onClick={() => handleResetDevice(s.rollNumber)} className="px-4 py-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl text-[10px] font-black uppercase transition-colors">
                        Reset Device
                      </button>
                    )}
                    <button onClick={() => handleDeleteUser('student', s.rollNumber)} className="p-3 text-rose-400 hover:text-rose-600 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'teachers' && (
            <div className="space-y-4">
              {teachers.map(t => (
                <div key={t.employeeId} className="flex items-center justify-between bg-slate-50/50 p-6 rounded-3xl border border-slate-50">
                  <div>
                    <p className="font-black text-slate-900">{t.name}</p>
                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">{t.employeeId} &bull; {t.department}</p>
                  </div>
                  <button onClick={() => handleDeleteUser('teacher', t.employeeId)} className="p-3 text-rose-400 hover:text-rose-600">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'config' && (
            <div className="max-w-2xl space-y-12 py-8">
              <div className="p-8 bg-slate-900 rounded-[2rem] text-white">
                <h3 className="text-xl font-black mb-4">Login Security Layer</h3>
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                  Activating the Login Lock prevents any new sessions from being initiated by students or teachers.
                </p>
                <div className="flex items-center gap-4">
                  <button onClick={toggleLock} className={`px-8 py-4 rounded-2xl font-black text-sm transition-all ${config.isLoginLocked ? 'bg-rose-500 hover:bg-rose-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                    {config.isLoginLocked ? 'Deactivate Lock' : 'Activate Login Lock'}
                  </button>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status: {config.isLoginLocked ? 'LOCKED' : 'OPEN'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;