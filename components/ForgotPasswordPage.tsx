import React, { useState } from 'react';
import { Mail, ArrowLeft } from 'lucide-react';

interface ForgotPasswordPageProps {
  onBackToLogin: () => void;
  onEmailVerified: (email: string) => void;
}

export default function ForgotPasswordPage({ onBackToLogin, onEmailVerified }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    onEmailVerified(email);
  };

  return (
    <div className="min-h-screen bg-[#f4f7f7] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-[#438883]/10 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[40rem] h-[40rem] bg-[#2EA1B8]/10 rounded-full blur-[100px]"></div>

      <div className="bg-white border border-[#DAE7E6] rounded-[3rem] shadow-2xl shadow-[#163C39]/5 p-12 w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-[#163C39] rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-[#163C39]/20">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-black text-[#163C39] tracking-tighter mb-2">Forgot Password?</h2>
          <p className="text-[#438883] font-bold">
            Enter your email address to reset your password.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <p className="text-sm text-red-600 font-semibold">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-[10px] font-black text-[#163C39]/40 uppercase tracking-widest mb-2 px-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#438883] w-5 h-5" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#f4f7f7] border border-[#DAE7E6] rounded-2xl pl-12 pr-6 py-4 text-[#163C39] focus:ring-2 focus:ring-[#438883]/20 outline-none font-bold transition-all"
                placeholder="admin@vethub.com"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-[#163C39] hover:bg-[#1f544f] text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-[#163C39]/20 transition-all active:scale-95"
          >
            Continue to Reset Password
          </button>
        </form>

        {/* Back to Login */}
        <div className="mt-6">
          <button
            onClick={onBackToLogin}
            className="w-full flex items-center justify-center gap-2 text-[#438883] hover:text-[#163C39] font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-6 pt-6 border-t border-[#DAE7E6]">
          <p className="text-xs text-[#163C39]/40 font-bold text-center">
            Enter the email address for your account, then set a new password on the next screen.
          </p>
        </div>
      </div>
    </div>
  );
}

