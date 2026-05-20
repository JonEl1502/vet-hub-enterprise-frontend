import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

interface AuthProps {
  onLogin: (data: any) => void;
  onForgotPassword: () => void;
  onSignup: () => void;
  onSupplierSignup?: () => void;
  onBackToLanding?: () => void;
}

const AuthPages: React.FC<AuthProps> = ({ onLogin, onForgotPassword, onSignup, onSupplierSignup, onBackToLanding }) => {
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
      await login(email, password);
      onLogin({ user: { email } });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-[#DAE7E6] rounded-2xl p-8 shadow-2xl shadow-[#163C39]/10 w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
      {/* Back to landing */}
      {onBackToLanding && (
        <button
          type="button"
          onClick={onBackToLanding}
          className="flex items-center gap-1.5 text-[#438883] hover:text-[#163C39] text-xs font-bold transition-colors mb-5"
        >
          <ArrowLeft size={13} /> Back to Home
        </button>
      )}

      {/* Header */}
      <div className="text-center mb-7">
        <div className="w-12 h-12 bg-[#163C39] rounded-xl flex items-center justify-center text-2xl mx-auto mb-4 shadow-xl shadow-[#163C39]/20">🐾</div>
        <h1 className="text-2xl font-black text-[#163C39] tracking-tighter">Welcome back</h1>
        <p className="text-[#438883] text-xs font-semibold mt-1">Sign in to VetHubCore Enterprise</p>
      </div>

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
              placeholder="vethubcore@gmail.com"
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

        <div className="text-right">
          <button type="button" onClick={onForgotPassword} className="text-xs font-bold text-[#438883] hover:text-[#163C39] transition-colors">
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
            <>Sign In <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></>
          )}
        </button>
      </form>

      <div className="mt-5 pt-5 border-t border-[#DAE7E6] space-y-2 text-center">
        <p className="text-sm text-[#163C39]/60">
          Don't have an account?{' '}
          <button onClick={onSignup} className="font-bold text-[#438883] hover:text-[#163C39] transition-colors">Sign Up</button>
        </p>
        {onSupplierSignup && (
          <p className="text-sm text-[#163C39]/60">
            Are you a supplier?{' '}
            <button onClick={onSupplierSignup} className="font-bold text-[#2EA1B8] hover:text-[#438883] transition-colors">Register as Supplier</button>
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthPages;
