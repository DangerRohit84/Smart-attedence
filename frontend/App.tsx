
import React, { useState, useEffect } from 'react';
import { UserRole, AuthState } from './types';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import AdminDashboard from './components/AdminDashboard';
import AuthFlow from './components/AuthFlow';

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole>(UserRole.NONE);
  const [auth, setAuth] = useState<AuthState>({
    isLoggedIn: false,
    role: UserRole.NONE,
    identifier: '',
    name: ''
  });

  useEffect(() => {
    const savedAuth = sessionStorage.getItem('edutrack_auth_v3');
    if (savedAuth) {
      const parsed = JSON.parse(savedAuth);
      setAuth(parsed);
      setRole(parsed.role);
    }
  }, []);

  const handleAuthSuccess = (identifier: string, name: string, finalRole?: UserRole) => {
    const actualRole = finalRole || role;
    const newAuth = { isLoggedIn: true, role: actualRole, identifier, name };
    setAuth(newAuth);
    setRole(actualRole);
    sessionStorage.setItem('edutrack_auth_v3', JSON.stringify(newAuth));
  };

  const handleLogout = () => {
    setAuth({ isLoggedIn: false, role: UserRole.NONE, identifier: '', name: '' });
    setRole(UserRole.NONE);
    sessionStorage.removeItem('edutrack_auth_v3');
  };

  const resetRole = () => setRole(UserRole.NONE);

  if (role === UserRole.NONE) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 pb-20">
        <div className="max-w-4xl w-full text-center space-y-12">
          <div className="space-y-4 animate-in fade-in duration-1000">
            <div className="inline-block p-4 bg-blue-600 rounded-[2rem] shadow-2xl mb-2">
              <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
            </div>
            <h1 className="text-6xl font-black text-slate-900 tracking-tighter">EduTrack <span className="text-blue-600">Pro</span></h1>
            <p className="text-slate-500 text-xl font-medium tracking-wide">Next-Gen Campus Intelligence</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-2xl mx-auto animate-in slide-in-from-bottom-12 duration-700">
            <button onClick={() => setRole(UserRole.TEACHER)} className="group bg-white hover:bg-blue-50 p-12 rounded-[2.5rem] shadow-xl border border-slate-100 transition-all hover:scale-[1.02] text-left flex flex-col justify-between aspect-square">
              <div className="w-20 h-20 rounded-3xl bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
              </div>
              <div>
                <span className="block text-3xl font-black text-slate-800 tracking-tight">Faculty</span>
                <span className="text-slate-400 font-medium mt-1 block">Staff & Admin Access</span>
              </div>
            </button>

            <button onClick={() => setRole(UserRole.STUDENT)} className="group bg-white hover:bg-emerald-50 p-12 rounded-[2.5rem] shadow-xl border border-slate-100 transition-all hover:scale-[1.02] text-left flex flex-col justify-between aspect-square">
              <div className="w-20 h-20 rounded-3xl bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l9-5-9-5-9 5 9 5zm0 0v6m0-6L3 9m9 5l9-5m-9 5l-9-5m9 5v6"></path></svg>
              </div>
              <div>
                <span className="block text-3xl font-black text-slate-800 tracking-tight">Student</span>
                <span className="text-slate-400 font-medium mt-1 block">Digital Attendance Portal</span>
              </div>
            </button>
          </div>
          
          <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.3em] animate-pulse">Select your portal to continue</p>
        </div>
      </div>
    );
  }

  if (!auth.isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <AuthFlow role={role} onSuccess={handleAuthSuccess} onBack={resetRole} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      <nav className="glass-card sticky top-0 z-40 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black">E</div>
            <div>
              <span className="font-black text-xl text-slate-900 tracking-tighter">EduTrack</span>
              <span className="text-xs font-bold text-blue-600 block leading-none uppercase tracking-widest">{auth.role} DASHBOARD</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
             <div className="hidden md:flex items-center gap-3 px-5 py-2.5 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl">
               <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
               <span className="text-xs font-black text-slate-200 uppercase tracking-widest">{auth.name}</span>
             </div>
             <button onClick={handleLogout} className="text-sm font-bold text-slate-400 hover:text-red-500 transition-colors">Logout</button>
          </div>
        </div>
      </nav>

      <main className="p-8">
        {auth.role === UserRole.ADMIN ? <AdminDashboard /> : 
         auth.role === UserRole.TEACHER ? <TeacherDashboard auth={auth} /> : 
         <StudentDashboard auth={auth} />}
      </main>
    </div>
  );
};

export default App;
