import React, { useState } from 'react';
import { Mail, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { authAPI } from '../../../services';

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
    <div className="bg-white border border-[#DAE7E6] rounded-2xl p-8 shadow-2xl shadow-[#163C39]/10 w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="text-center mb-7">
        <div className="w-12 h-12 bg-[#163C39] rounded-xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-[#163C39]/20">
          <Mail size={22} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-[#163C39] tracking-tighter">Forgot Password?</h1>
        <p className="text-[#438883] text-xs font-semibold mt-1">Enter your email to reset your password</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-600 font-semibold">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#163C39]/50 px-1">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#438883]" size={16} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#f4f7f7] border border-[#DAE7E6] rounded-xl pl-10 pr-4 py-3 text-sm text-[#163C39] focus:ring-2 focus:ring-[#438883]/20 outline-none font-bold transition-all"
              placeholder="vethubcore@gmail.com"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#163C39] hover:bg-[#1f544f] disabled:opacity-50 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-[#163C39]/20 transition-all flex items-center justify-center gap-2 active:scale-95 group"
        >
          {isLoading
            ? <><Loader2 size={16} className="animate-spin" /> Sending…</>
            : <>Continue <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></>
          }
        </button>
      </form>

      <div className="mt-5 pt-5 border-t border-[#DAE7E6]">
        <button
          onClick={onBackToLogin}
          className="w-full flex items-center justify-center gap-2 text-sm font-bold text-[#438883] hover:text-[#163C39] transition-colors"
        >
          <ArrowLeft size={14} /> Back to Login
        </button>
      </div>
    </div>
  );
}
