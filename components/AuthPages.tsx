
import React, { useState } from 'react';
import { Mail, Lock, User, ShieldCheck, ArrowRight, ArrowLeft, Play } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthProps {
  onLogin: (data: any) => void;
  onForgotPassword: () => void;
  onSignup: () => void;
}

const AuthPages: React.FC<AuthProps> = ({ onLogin, onForgotPassword, onSignup }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Use AuthContext login method which handles state and localStorage
      await login(email, password);

      // Call the legacy onLogin callback for backward compatibility with store
      onLogin({ user: { email } });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7f7] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-[#438883]/10 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[40rem] h-[40rem] bg-[#2EA1B8]/10 rounded-full blur-[100px]"></div>

      <div className="w-full max-w-md bg-white border border-[#DAE7E6] rounded-[3rem] p-12 shadow-2xl shadow-[#163C39]/5 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-[#163C39] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-xl shadow-[#163C39]/20">🐾</div>
          <h1 className="text-3xl font-black text-[#163C39] tracking-tighter">VetHub Enterprise</h1>
          <p className="text-[#438883] text-[10px] font-black mt-1 uppercase tracking-widest">
            Identity & Clinical Access Terminal
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <p className="text-sm text-red-600 font-semibold">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#163C39]/40 uppercase tracking-widest px-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#438883]" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#f4f7f7] border border-[#DAE7E6] rounded-2xl pl-12 pr-6 py-4 text-[#163C39] focus:ring-2 focus:ring-[#438883]/20 outline-none font-bold transition-all"
                placeholder="admin@vethub.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#163C39]/40 uppercase tracking-widest px-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#438883]" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#f4f7f7] border border-[#DAE7E6] rounded-2xl pl-12 pr-6 py-4 text-[#163C39] focus:ring-2 focus:ring-[#438883]/20 outline-none font-bold"
                required
              />
            </div>
          </div>

          {/* Forgot Password Link */}
          <div className="text-right">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-xs font-bold text-[#438883] hover:text-[#163C39] transition-colors"
            >
              Forgot Password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#163C39] hover:bg-[#1f544f] disabled:opacity-50 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-[#163C39]/20 transition-all flex items-center justify-center gap-3 active:scale-95 group"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Establish Clinical Session
                <Play size={14} className="group-hover:translate-x-1 transition-transform fill-current" />
              </>
            )}
          </button>
        </form>

        {/* Signup Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-[#163C39]/60">
            Don't have an account?{' '}
            <button
              onClick={onSignup}
              className="font-bold text-[#438883] hover:text-[#163C39] transition-colors"
            >
              Sign Up
            </button>
          </p>
        </div>

        <div className="mt-10 pt-8 border-t border-[#DAE7E6] text-center">
            <p className="text-[9px] font-black text-[#438883] uppercase tracking-widest">Enterprise Mode Active</p>
            <p className="text-[#163C39]/40 text-[9px] mt-1 font-bold">
              Demo: admin@vethub.com / admin123
            </p>
        </div>
      </div>

      <p className="absolute bottom-10 text-[#163C39]/20 text-[10px] font-black uppercase tracking-[0.3em]">Secure Enterprise Gateway • White Label Console</p>
    </div>
  );
};

export default AuthPages;
