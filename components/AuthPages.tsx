
import React, { useState } from 'react';
import { Mail, Lock, User, ShieldCheck, ArrowRight, ArrowLeft, Play } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthProps {
  onLogin: (data: any) => void;
  onForgotPassword: () => void;
  onSignup: () => void;
  onSupplierSignup?: () => void;
}

const AuthPages: React.FC<AuthProps> = ({ onLogin, onForgotPassword, onSignup, onSupplierSignup }) => {
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

      <div className="w-full max-w-md bg-white border border-[#DAE7E6] rounded-2xl p-8 shadow-2xl shadow-[#163C39]/5 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[#163C39] rounded-xl flex items-center justify-center text-2xl mx-auto mb-4 shadow-xl shadow-[#163C39]/20">🐾</div>
          <h1 className="text-2xl font-black text-[#163C39] tracking-tighter">VetHub</h1>
          <p className="text-[#438883] text-xs font-semibold mt-1">
            Veterinary Practice Management
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600 font-semibold">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#163C39]/50 px-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#438883]" size={16} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#f4f7f7] border border-[#DAE7E6] rounded-xl pl-10 pr-4 py-3 text-sm text-[#163C39] focus:ring-2 focus:ring-[#438883]/20 outline-none font-bold transition-all"
                placeholder="admin@vethub.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#163C39]/50 px-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#438883]" size={16} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#f4f7f7] border border-[#DAE7E6] rounded-xl pl-10 pr-4 py-3 text-sm text-[#163C39] focus:ring-2 focus:ring-[#438883]/20 outline-none font-bold"
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
            className="w-full bg-[#163C39] hover:bg-[#1f544f] disabled:opacity-50 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-[#163C39]/20 transition-all flex items-center justify-center gap-2 active:scale-95 group"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Sign In
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Signup Link */}
        <div className="mt-5 text-center">
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

        {/* Supplier Registration Link */}
        {onSupplierSignup && (
          <div className="mt-3 text-center">
            <p className="text-sm text-[#163C39]/60">
              Are you a supplier?{' '}
              <button
                onClick={onSupplierSignup}
                className="font-bold text-[#2EA1B8] hover:text-[#438883] transition-colors"
              >
                Register as Supplier
              </button>
            </p>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-[#DAE7E6] text-center">
            <p className="text-[9px] font-bold text-[#438883] uppercase tracking-wider">Demo Account Available</p>
            <p className="text-[#163C39]/40 text-[9px] mt-1 font-bold">
              admin@vethub.com / admin123
            </p>
        </div>
      </div>

      <p className="absolute bottom-10 text-[#163C39]/20 text-[10px] font-medium tracking-wide">VetHub © 2026 • All rights reserved</p>
    </div>
  );
};

export default AuthPages;
