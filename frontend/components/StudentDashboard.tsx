
import React, { useState, useEffect, useMemo } from 'react';
import { StudentProfile, AuthState, AttendanceSession } from '../types';
import { storageService } from '../services/storageService';
import QRScannerComponent from './QRScannerComponent';

interface Props {
  auth: AuthState;
}

const StudentDashboard: React.FC<Props> = ({ auth }) => {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastMarked, setLastMarked] = useState<{ success: boolean; message: string; course?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const student = await storageService.getStudent(auth.identifier);
      if (student) setProfile(student);
      const allSessions = await storageService.getSessions();
      setSessions(allSessions);
      setLoading(false);
    };
    fetchData();
  }, [auth]);

  const studentHistory = useMemo(() => {
    if (!profile) return [];
    return sessions
      .filter(session => session.attendance.some(record => record.rollNumber.toUpperCase() === profile.rollNumber.toUpperCase()))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [sessions, profile]);

  const handleScan = async (sessionId: string) => {
    if (!profile) return;
    
    setError(null);
    setLastMarked(null);
    const currentDeviceSig = storageService.getDeviceSignature();

    try {
      const result = await storageService.markAttendance(sessionId, {
        rollNumber: profile.rollNumber.toUpperCase(),
        name: profile.name,
        department: profile.department,
        section: profile.section,
        deviceId: currentDeviceSig
      });

      if (result.success) {
        setLastMarked({ success: true, message: "Attendance recorded successfully!" });
        const updatedSessions = await storageService.getSessions();
        setSessions(updatedSessions);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Communication failure. Try again.");
    } finally {
      setIsScanning(false);
    }
  };

  if (loading || !profile) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">Syncing Identity...</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24 animate-in fade-in duration-500">
      <header className="glass-card p-10 rounded-[2.5rem] shadow-2xl border border-white flex flex-col md:flex-row items-center gap-8">
        <div className="w-28 h-28 bg-gradient-to-tr from-blue-600 to-indigo-700 text-white flex items-center justify-center rounded-[2rem] font-black text-5xl shadow-xl shadow-blue-200">
          {profile.name[0]}
        </div>
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-4xl font-black text-slate-900 mb-2 tracking-tighter">{profile.name}</h2>
          <div className="flex justify-center md:justify-start gap-3 items-center">
             <span className="px-4 py-1.5 bg-slate-900 text-white text-[10px] font-black uppercase rounded-full tracking-widest">{profile.rollNumber}</span>
             <span className="text-slate-400 font-bold text-sm tracking-wide">{profile.department} &bull; SEC {profile.section}</span>
          </div>
        </div>
      </header>

      {!isScanning ? (
        <button onClick={() => setIsScanning(true)} className="w-full bg-slate-900 text-white rounded-[3rem] p-12 shadow-2xl transition-all hover:-translate-y-2 hover:bg-black active:scale-[0.98]">
           <h3 className="text-4xl font-black tracking-tight mb-2">Check-in Now</h3>
           <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Scan Session QR Code</p>
        </button>
      ) : (
        <div className="space-y-6">
          <QRScannerComponent onScan={handleScan} />
          <button onClick={() => setIsScanning(false)} className="w-full bg-white border-2 border-slate-100 p-5 rounded-[2rem] font-black text-slate-400 hover:text-rose-500 transition-all">Cancel Scanning</button>
        </div>
      )}

      {error && <div className="p-8 bg-rose-50 text-rose-700 border border-rose-100 rounded-[2.5rem] font-black text-center animate-in slide-in-from-top-2">{error}</div>}
      {lastMarked && <div className="p-8 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-[2.5rem] font-black text-center animate-in slide-in-from-top-2">{lastMarked.message}</div>}

      <div className="glass-card p-8 rounded-[2.5rem] border border-white shadow-xl">
        <div className="flex items-center justify-between mb-8">
           <h3 className="text-xl font-black">Attendance History</h3>
           <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-full">{studentHistory.length} Sessions</span>
        </div>
        <div className="space-y-4">
          {studentHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-300 font-bold uppercase tracking-widest text-xs border-2 border-dashed border-slate-50 rounded-3xl">No records found</div>
          ) : studentHistory.map(session => (
            <div key={session.id} className="p-6 bg-slate-50/50 rounded-3xl border border-slate-50 flex items-center justify-between hover:bg-white hover:border-blue-100 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-blue-600 font-black">
                  {session.courseName[0]}
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800">{session.courseName}</h4>
                  <p className="text-xs text-slate-400 font-bold">{new Date(session.startTime).toLocaleDateString()} &bull; {new Date(session.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-emerald-600 font-black text-[10px] uppercase tracking-widest">RECORDED</span>
                <span className="text-[10px] text-slate-300 font-bold">Present</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
