import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import BrandMark from '../common/BrandMark';
import LoadingSpinner from '../common/LoadingSpinner';

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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="bg-white border border-[#CFE6D8] rounded-2xl p-8 shadow-2xl shadow-[#144E35]/10 w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
      {/* Primary loading overlay — animated C, dead center, covers the page */}
      {loading && <LoadingSpinner fullScreen />}
      {/* Back to landing */}
      {onBackToLanding && (
        <button
          type="button"
          onClick={onBackToLanding}
          className="flex items-center gap-1.5 text-[#1C7A5B] hover:text-[#144E35] text-xs font-bold transition-colors mb-5"
        >
          <ArrowLeft size={13} /> Back to Home
        </button>
      )}

      {/* Header */}
      <div className="text-center mb-7">
        <div className="w-12 h-12 bg-[#144E35] rounded-xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-[#144E35]/20 p-2.5">
          <BrandMark color="#FFFFFF" className="w-full h-full" />
        </div>
        <h1 className="text-2xl font-black text-[#144E35] tracking-tighter">Welcome back</h1>
        <p className="text-[#1C7A5B] text-xs font-semibold mt-1">Sign in to VetHubCore Enterprise</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-600 font-semibold">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#144E35]/50 px-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1C7A5B]" size={16} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl pl-10 pr-4 py-3 text-sm text-[#144E35] focus:ring-2 focus:ring-[#1C7A5B]/20 outline-none font-bold transition-all"
              placeholder="vethubcore@gmail.com"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#144E35]/50 px-1">Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1C7A5B]" size={16} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl pl-10 pr-10 py-3 text-sm text-[#144E35] focus:ring-2 focus:ring-[#1C7A5B]/20 outline-none font-bold"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1C7A5B] hover:text-[#144E35] transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="text-right">
          <button type="button" onClick={onForgotPassword} className="text-xs font-bold text-[#1C7A5B] hover:text-[#144E35] transition-colors">
            Forgot Password?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#144E35] hover:bg-[#1f544f] disabled:opacity-50 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-[#144E35]/20 transition-all flex items-center justify-center gap-2 active:scale-95 group"
        >
          <>Sign In <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></>
        </button>
      </form>

      <div className="mt-5 pt-5 border-t border-[#CFE6D8] space-y-2 text-center">
        <p className="text-sm text-[#144E35]/60">
          Don't have an account?{' '}
          <button onClick={onSignup} className="font-bold text-[#1C7A5B] hover:text-[#144E35] transition-colors">Sign Up</button>
        </p>
        {onSupplierSignup && (
          <p className="text-sm text-[#144E35]/60">
            Are you a supplier?{' '}
            <button onClick={onSupplierSignup} className="font-bold text-[#2EA1B8] hover:text-[#1C7A5B] transition-colors">Register as Supplier</button>
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthPages;
