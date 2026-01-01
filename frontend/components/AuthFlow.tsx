
import React, { useState } from 'react';
import { UserRole } from '../types';
import { storageService } from '../services/storageService';

interface AuthProps {
  role: UserRole;
  onSuccess: (identifier: string, name: string, finalRole?: UserRole) => void;
  onBack: () => void;
}

const AuthFlow: React.FC<AuthProps> = ({ role, onSuccess, onBack }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    name: '',
    department: '',
    section: '',
    phone: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const result = await storageService.login(role, formData.identifier, formData.password);
        if (result.success) {
          onSuccess(formData.identifier, result.name, result.role);
        } else {
          setError(result.error || 'Login failed');
        }
      } else {
        const result = await storageService.register(role, formData);
        if (result.success) {
          setIsLogin(true);
          setError('Registration successful. Please login.');
        } else {
          setError(result.error || 'Registration failed');
        }
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto p-10 glass-card rounded-[2.5rem] shadow-2xl border border-white">
      <button onClick={onBack} className="mb-8 text-slate-400 hover:text-slate-900 flex items-center gap-2 font-bold text-sm uppercase tracking-widest">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
        Back
      </button>

      <div className="text-center mb-10">
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">
          {isLogin ? 'Identity Portal' : 'New Registration'}
        </h2>
        <p className="text-slate-400 font-medium uppercase tracking-[0.2em] text-[10px]">
          {role === UserRole.TEACHER ? 'Faculty & Staff Verification' : 'Student Attendance Access'}
        </p>
      </div>

      <div className="flex p-1.5 bg-slate-100 rounded-2xl mb-8">
        <button type="button" onClick={() => setIsLogin(true)} className={`flex-1 py-3 rounded-xl font-bold ${isLogin ? 'bg-white shadow-md text-blue-600' : 'text-slate-400'}`}>Sign In</button>
        <button type="button" onClick={() => setIsLogin(false)} className={`flex-1 py-3 rounded-xl font-bold ${!isLogin ? 'bg-white shadow-md text-blue-600' : 'text-slate-400'}`}>Sign Up</button>
      </div>

      <form onSubmit={handleAuth} className="space-y-4">
        {!isLogin && (
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Full Name</label>
            <input required name="name" value={formData.name} onChange={handleChange} className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium" placeholder="Legal Name" />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">
              {role === UserRole.TEACHER ? 'Faculty ID' : 'Roll Number'}
            </label>
            <input required name="identifier" value={formData.identifier} onChange={handleChange} className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium" placeholder="ID" />
          </div>
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Department</label>
              <select required name="department" value={formData.department} onChange={handleChange} className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium">
                <option value="">Select Dept</option>
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="ME">ME</option>
                <option value="IT">IT</option>
              </select>
            </div>
          )}
        </div>

        {!isLogin && role === UserRole.STUDENT && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Section</label><input required name="section" value={formData.section} onChange={handleChange} className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" placeholder="A/B/C" /></div>
            <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Phone</label><input required name="phone" value={formData.phone} onChange={handleChange} className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" placeholder="Contact" /></div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Password</label>
          <input required type="password" name="password" value={formData.password} onChange={handleChange} className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium" placeholder="••••••••" />
        </div>

        {error && <div className="p-4 bg-rose-50 text-rose-600 text-xs rounded-xl border border-rose-100 font-bold">{error}</div>}

        <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-blue-100 transition-all hover:-translate-y-1 active:scale-[0.98] mt-6 disabled:opacity-50">
          {loading ? 'Processing...' : (isLogin ? 'Enter Portal' : 'Register Account')}
        </button>
      </form>
    </div>
  );
};

export default AuthFlow;
