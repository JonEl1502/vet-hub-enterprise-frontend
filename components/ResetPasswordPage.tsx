import React, { useState, useEffect } from 'react';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { authAPI } from '../services';

interface ResetPasswordPageProps {
  resetToken?: string;
  onBackToLogin: () => void;
}

export default function ResetPasswordPage({ resetToken, onBackToLogin }: ResetPasswordPageProps) {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    // Get token from prop (OTP flow) or URL parameter (direct link)
    if (resetToken) {
      setToken(resetToken);
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenParam = urlParams.get('token');
      if (tokenParam) {
        setToken(tokenParam);
      } else {
        setError('Invalid reset link. Please request a new password reset.');
      }
    }
  }, [resetToken]);

  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = [];
    if (pwd.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(pwd)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(pwd)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(pwd)) {
      errors.push('Password must contain at least one number');
    }
    return errors;
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    setValidationErrors(validatePassword(newPassword));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    const errors = validatePassword(password);
    if (errors.length > 0) {
      setError(errors.join('. '));
      return;
    }

    setIsLoading(true);

    try {
      await authAPI.resetPassword(token, password);
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#f4f7f7] flex items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative Orbs */}
        <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-[#438883]/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[40rem] h-[40rem] bg-[#2EA1B8]/10 rounded-full blur-[100px]"></div>

        <div className="bg-white border border-[#DAE7E6] rounded-[3rem] shadow-2xl shadow-[#163C39]/5 p-12 w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-[#438883]/10 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-[#438883]/10">
              <CheckCircle className="w-10 h-10 text-[#438883]" />
            </div>
            <h2 className="text-2xl font-black text-[#163C39] tracking-tighter mb-2">Password Reset Successful!</h2>
            <p className="text-[#163C39]/70 font-bold mb-6">
              Your password has been successfully reset. You can now login with your new password.
            </p>
            <button
              onClick={onBackToLogin}
              className="w-full bg-[#163C39] hover:bg-[#1f544f] text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-[#163C39]/20 transition-all active:scale-95"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7f7] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-[#438883]/10 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[40rem] h-[40rem] bg-[#2EA1B8]/10 rounded-full blur-[100px]"></div>

      <div className="bg-white border border-[#DAE7E6] rounded-[3rem] shadow-2xl shadow-[#163C39]/5 p-12 w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-[#163C39] rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-[#163C39]/20">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-black text-[#163C39] tracking-tighter mb-2">Reset Password</h2>
          <p className="text-[#438883] font-bold">
            Enter your new password below.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 font-semibold">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-[10px] font-black text-[#163C39]/40 uppercase tracking-widest mb-2 px-1">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#438883] w-5 h-5" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={handlePasswordChange}
                className="w-full bg-[#f4f7f7] border border-[#DAE7E6] rounded-2xl pl-12 pr-6 py-4 text-[#163C39] focus:ring-2 focus:ring-[#438883]/20 outline-none font-bold transition-all"
                placeholder="Enter new password"
                required
                disabled={isLoading || !token}
              />
            </div>
            {validationErrors.length > 0 && password.length > 0 && (
              <ul className="mt-2 text-xs text-[#163C39]/60 font-bold space-y-1">
                {validationErrors.map((err, idx) => (
                  <li key={idx} className="flex items-center gap-1">
                    <span className="text-red-500">•</span> {err}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-[10px] font-black text-[#163C39]/40 uppercase tracking-widest mb-2 px-1">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#438883] w-5 h-5" />
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#f4f7f7] border border-[#DAE7E6] rounded-2xl pl-12 pr-6 py-4 text-[#163C39] focus:ring-2 focus:ring-[#438883]/20 outline-none font-bold transition-all"
                placeholder="Confirm new password"
                required
                disabled={isLoading || !token}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !token || validationErrors.length > 0}
            className="w-full bg-[#163C39] hover:bg-[#1f544f] disabled:opacity-50 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-[#163C39]/20 transition-all active:scale-95 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Resetting...
              </div>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

