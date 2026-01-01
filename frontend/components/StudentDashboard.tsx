
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
      .filter(session => session.attendance.some(record => record.rollNumber === profile.rollNumber))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [sessions, profile]);

  const handleScan = async (sessionId: string) => {
    if (!profile) return;
    
    setError(null);
    setLastMarked(null);
    const currentDeviceSig = storageService.getDeviceSignature();

    try {
      const result = await storageService.markAttendance(sessionId, {
        rollNumber: profile.rollNumber,
        name: profile.name,
        department: profile.department,
        section: profile.section,
        deviceId: currentDeviceSig
      });

      if (result.success) {
        setLastMarked({ success: true, message: "Attendance recorded successfully." });
        const updatedSessions = await storageService.getSessions();
        setSessions(updatedSessions);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("An error occurred while marking attendance.");
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
    <div className="max-w-4xl mx-auto space-y-8 pb-24">
      <header className="glass-card p-10 rounded-[2.5rem] shadow-2xl border border-white flex flex-col md:flex-row items-center gap-8">
        <div className="w-28 h-28 bg-gradient-to-tr from-blue-600 to-indigo-700 text-white flex items-center justify-center rounded-[2rem] font-black text-5xl">
          {profile.name[0]}
        </div>
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-4xl font-black text-slate-900 mb-2">{profile.name}</h2>
          <div className="flex justify-center md:justify-start gap-3">
             <span className="px-4 py-1.5 bg-slate-900 text-white text-[10px] font-black uppercase rounded-full">{profile.rollNumber}</span>
             <span className="text-slate-400 font-bold text-sm">{profile.department}</span>
          </div>
        </div>
      </header>

      {!isScanning ? (
        <button onClick={() => setIsScanning(true)} className="w-full bg-slate-900 text-white rounded-[3rem] p-12 shadow-2xl transition-all hover:-translate-y-2">
           <h3 className="text-4xl font-black">Scan to Check-in</h3>
        </button>
      ) : (
        <div className="space-y-6">
          <QRScannerComponent onScan={handleScan} />
          <button onClick={() => setIsScanning(false)} className="w-full bg-slate-100 p-5 rounded-[2rem] font-black">Cancel</button>
        </div>
      )}

      {error && <div className="p-8 bg-rose-50 text-rose-700 rounded-[2.5rem] font-black">{error}</div>}
      {lastMarked && <div className="p-8 bg-emerald-50 text-emerald-800 rounded-[2.5rem] font-black">{lastMarked.message}</div>}

      <div className="glass-card p-8 rounded-[2.5rem] border border-white shadow-xl">
        <h3 className="text-xl font-black mb-8">Recent Check-ins</h3>
        <div className="space-y-4">
          {studentHistory.map(session => (
            <div key={session.id} className="p-5 bg-white rounded-3xl border border-slate-50 flex justify-between">
              <div>
                <h4 className="font-extrabold">{session.courseName}</h4>
                <p className="text-xs text-slate-400">{new Date(session.startTime).toLocaleDateString()}</p>
              </div>
              <span className="text-emerald-600 font-black text-xs">PRESENT</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
