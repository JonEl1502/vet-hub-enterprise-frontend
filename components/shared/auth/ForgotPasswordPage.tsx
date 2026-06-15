import React, { useState } from 'react';
import { Mail, ArrowLeft, ArrowRight } from 'lucide-react';
import { authAPI } from '../../../services';
import LoadingSpinner from '../common/LoadingSpinner';

interface ForgotPasswordPageProps {
  onBackToLogin: () => void;
  onEmailVerified: (email: string) => void;
}

export default function ForgotPasswordPage({ onBackToLogin, onEmailVerified }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      // Actually request the OTP (this was previously a mock setTimeout that
      // never hit the API — the code only got sent when you clicked "Resend").
      // Resolves generically even for unknown emails (no account enumeration).
      await authAPI.forgotPassword(email.trim(), { showError: false });
      onEmailVerified(email.trim());
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not send the reset code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-[#CFE6D8] rounded-2xl p-8 shadow-2xl shadow-[#144E35]/10 w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
      {/* Primary loading overlay — animated C, dead center, covers the page */}
      {isLoading && <LoadingSpinner fullScreen />}
      {/* Header */}
      <div className="text-center mb-7">
        <div className="w-12 h-12 bg-[#144E35] rounded-xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-[#144E35]/20">
          <Mail size={22} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-[#144E35] tracking-tighter">Forgot Password?</h1>
        <p className="text-[#1C7A5B] text-xs font-semibold mt-1">Enter your email to reset your password</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-600 font-semibold">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#144E35]/50 px-1">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1C7A5B]" size={16} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl pl-10 pr-4 py-3 text-sm text-[#144E35] focus:ring-2 focus:ring-[#1C7A5B]/20 outline-none font-bold transition-all"
              placeholder="vethubcore@gmail.com"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#144E35] hover:bg-[#1f544f] disabled:opacity-50 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-[#144E35]/20 transition-all flex items-center justify-center gap-2 active:scale-95 group"
        >
          <>Continue <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></>
        </button>
      </form>

      <div className="mt-5 pt-5 border-t border-[#CFE6D8]">
        <button
          onClick={onBackToLogin}
          className="w-full flex items-center justify-center gap-2 text-sm font-bold text-[#1C7A5B] hover:text-[#144E35] transition-colors"
        >
          <ArrowLeft size={14} /> Back to Login
        </button>
      </div>
    </div>
  );
}
