import React, { useState, useEffect } from 'react';
import { AttendanceSession, AuthState, TeacherProfile, SystemConfig } from '../types';
import { storageService } from '../services/storageService';

interface Props {
  auth: AuthState;
}

const TeacherDashboard: React.FC<Props> = ({ auth }) => {
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [courseName, setCourseName] = useState('');
  const [sysConfig, setSysConfig] = useState<SystemConfig | null>(null);

  useEffect(() => {
    const init = async () => {
      const teacher = await storageService.getTeacher(auth.identifier);
      if (teacher) setProfile(teacher);
      const config = await storageService.getSystemConfig();
      setSysConfig(config);
      await refreshData();
    };
    init();
  }, [auth]);

  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      if (activeSession) await syncActiveSession();
      // Periodically poll for config changes
      const config = await storageService.getSystemConfig();
      setSysConfig(config);
    }, 2000);

    return () => clearInterval(refreshInterval);
  }, [activeSession]);

  const toggleSysLock = async () => {
    if (!sysConfig) return;
    const newConfig = { ...sysConfig, isLoginLocked: !sysConfig.isLoginLocked, lastUpdated: new Date().toISOString() };
    await storageService.setSystemConfig(newConfig);
    setSysConfig(newConfig);
  };

  const refreshData = async () => {
    const sessionsData = await storageService.getSessions();
    const allSessions = sessionsData.filter(s => s.teacherId === auth.identifier);
    setSessions(allSessions);
    const active = allSessions.find(s => s.isActive);
    setActiveSession(active || null);
  };

  const syncActiveSession = async () => {
    if (!activeSession) return;
    const allSessions = await storageService.getSessions();
    const latestActive = allSessions.find(s => s.id === activeSession.id);
    if (latestActive) {
      if (latestActive.attendance.length !== activeSession.attendance.length || latestActive.isActive !== activeSession.isActive) {
        setActiveSession(latestActive);
        setSessions(allSessions.filter(s => s.teacherId === auth.identifier));
      }
    } else {
      setActiveSession(null);
    }
  };

  const createSession = async () => {
    if (!courseName.trim()) return alert("Please enter course name");
    
    const newSession: AttendanceSession = {
      id: `session_${Date.now()}`,
      courseName,
      startTime: new Date().toISOString(),
      attendance: [],
      isActive: true,
      teacherId: auth.identifier
    };

    const currentSessions = await storageService.getSessions();
    const allSessions = currentSessions.map(s => 
      s.teacherId === auth.identifier ? { ...s, isActive: false } : s
    );
    const updatedSessions = [...allSessions, newSession];
    
    await storageService.saveSessions(updatedSessions);
    setSessions(updatedSessions.filter(s => s.teacherId === auth.identifier));
    setActiveSession(newSession);
    setCourseName('');
    
    if (sysConfig && !sysConfig.isLoginLocked) {
      if (confirm("Would you like to LOCK the portal logins while this session is active?")) {
        await toggleSysLock();
      }
    }
  };

  const endSession = async () => {
    if (!activeSession) return;
    const updated = { ...activeSession, isActive: false };
    await storageService.updateSession(updated);
    await refreshData();
  };

  const exportCSV = (session: AttendanceSession) => {
    const headers = ["Roll Number", "Name", "Department", "Section", "Time"];
    const rows = session.attendance.map(r => [r.rollNumber, r.name, r.department, r.section, new Date(r.timestamp).toLocaleTimeString()]);
    const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Attendance_${session.courseName}.csv`;
    link.click();
  };

  if (!profile || !sysConfig) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-3xl border border-white">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">My Sessions</p>
          <h3 className="text-2xl font-bold text-slate-900">{sessions.length}</h3>
        </div>
        <div className="glass-card p-6 rounded-3xl border border-white">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Attendance</p>
          <h3 className="text-2xl font-bold text-slate-900">{sessions.reduce((acc, s) => acc + s.attendance.length, 0)}</h3>
        </div>
        <div className="glass-card p-6 rounded-3xl border border-white">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Login Lock</p>
          <div className="flex items-center gap-3">
             <span className={`text-sm font-black ${sysConfig.isLoginLocked ? 'text-rose-600' : 'text-emerald-600'}`}>
               {sysConfig.isLoginLocked ? 'ACTIVE' : 'INACTIVE'}
             </span>
             <button onClick={toggleSysLock} className="text-[10px] px-2 py-1 bg-slate-100 rounded-md font-black hover:bg-slate-200">TOGGLE</button>
          </div>
        </div>
      </div>

      <div className="space-y-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Faculty Dashboard</h1>
            <p className="text-slate-500 font-medium">Department: {profile.department} | Name: {profile.name}</p>
          </div>
          
          <div className="flex gap-3">
            {!activeSession ? (
              <div className="flex gap-2 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <input type="text" placeholder="Subject Name" value={courseName} onChange={(e) => setCourseName(e.target.value)} className="px-4 py-2 bg-transparent outline-none font-medium w-48" />
                <button onClick={createSession} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-blue-100 transition-all active:scale-95">Start Session</button>
              </div>
            ) : (
              <button onClick={endSession} className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-red-100 transition-all flex items-center gap-2"><span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>Stop Scan</button>
            )}
          </div>
        </header>

        {activeSession && (
          <section className="bg-white p-12 rounded-[2.5rem] shadow-xl border border-blue-50 text-center animate-in zoom-in duration-500">
            <div className="max-w-md mx-auto space-y-8">
              <h2 className="text-3xl font-black text-slate-900">{activeSession.courseName}</h2>
              <div className="relative p-10 bg-white rounded-[2rem] shadow-2xl border border-slate-50 flex flex-col items-center">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${activeSession.id}`} alt="QR" className="w-72 h-72 rounded-xl" />
              </div>
              <div className="bg-slate-50 rounded-2xl p-6 flex items-center justify-between">
                <div className="text-left"><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">In-Room Check-ins</p><p className="text-3xl font-black text-slate-900">{activeSession.attendance.length}</p></div>
                <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl shadow-lg flex items-center justify-center font-black text-xl">{activeSession.attendance.length}</div>
              </div>
            </div>
          </section>
        )}

        <div className="space-y-6">
          <h3 className="text-2xl font-bold text-slate-800">Past Sessions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sessions.slice().reverse().map(session => (
              <div key={session.id} className="group glass-card p-8 rounded-3xl border border-slate-100 flex items-center justify-between gap-6 hover:shadow-xl transition-all">
                <div className="flex items-start gap-5">
                  <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-50 flex items-center justify-center text-blue-600 font-black">{session.courseName[0]}</div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-xl">{session.courseName}</h4>
                    <div className="flex items-center gap-3 mt-1 text-sm font-medium text-slate-500">
                       <span>{new Date(session.startTime).toLocaleDateString()}</span>
                       <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                       <span className="text-slate-900 font-bold">{session.attendance.length} Students</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => exportCSV(session)} className="bg-slate-900 text-white px-5 py-3 rounded-xl text-sm font-bold active:scale-95 shadow-lg shadow-slate-200 transition-all">Export</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;