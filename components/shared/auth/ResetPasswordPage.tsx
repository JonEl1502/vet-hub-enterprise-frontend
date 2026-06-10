import React, { useState } from 'react';
import { Lock, ArrowLeft, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { authAPI } from '../../../services';

interface ResetPasswordPageProps {
  email: string;
  onBackToLogin: () => void;
}

export default function ResetPasswordPage({ email, onBackToLogin }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = [];
    if (pwd.length < 8) errors.push('At least 8 characters');
    if (!/[A-Z]/.test(pwd)) errors.push('One uppercase letter');
    if (!/[a-z]/.test(pwd)) errors.push('One lowercase letter');
    if (!/[0-9]/.test(pwd)) errors.push('One number');
    return errors;
  };

  const validationErrors = password.length > 0 ? validatePassword(password) : [];
  const strength = password.length === 0 ? 0 : 4 - validationErrors.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    const errors = validatePassword(password);
    if (errors.length > 0) { setError(errors.join(' · ')); return; }
    setIsLoading(true);
    try {
      await authAPI.resetPassword(email, password);
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="bg-white border border-[#CFE6D8] rounded-2xl p-8 shadow-2xl shadow-[#144E35]/10 w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-[#1C7A5B]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={28} className="text-[#1C7A5B]" />
          </div>
          <h2 className="text-xl font-black text-[#144E35] tracking-tighter">Password Reset!</h2>
          <p className="text-[#1C7A5B] text-xs font-semibold mt-2 mb-6">Your password has been successfully updated.</p>
          <button
            onClick={onBackToLogin}
            className="w-full bg-[#144E35] hover:bg-[#1f544f] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-[#144E35]/20 transition-all active:scale-95"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#CFE6D8] rounded-2xl p-8 shadow-2xl shadow-[#144E35]/10 w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="text-center mb-7">
        <div className="w-12 h-12 bg-[#144E35] rounded-xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-[#144E35]/20">
          <Lock size={22} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-[#144E35] tracking-tighter">New Password</h1>
        <p className="text-[#1C7A5B] text-xs font-semibold mt-1">
          Setting password for <span className="text-[#144E35] font-black">{email}</span>
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
          <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 font-semibold">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#144E35]/50 px-1">New Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1C7A5B]" size={16} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="w-full bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl pl-10 pr-10 py-3 text-sm text-[#144E35] focus:ring-2 focus:ring-[#1C7A5B]/20 outline-none font-bold transition-all"
              required
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1C7A5B] hover:text-[#144E35] transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {password.length > 0 && (
            <div className="space-y-1.5 px-0.5">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      i <= strength
                        ? strength >= 4 ? 'bg-[#1C7A5B]' : strength >= 2 ? 'bg-amber-400' : 'bg-red-400'
                        : 'bg-[#CFE6D8]'
                    }`}
                  />
                ))}
              </div>
              {validationErrors.length > 0 && (
                <p className="text-[10px] text-[#144E35]/50 font-semibold leading-relaxed">
                  Needs: {validationErrors.join(' · ')}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#144E35]/50 px-1">Confirm Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1C7A5B]" size={16} />
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              className="w-full bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl pl-10 pr-10 py-3 text-sm text-[#144E35] focus:ring-2 focus:ring-[#1C7A5B]/20 outline-none font-bold transition-all"
              required
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1C7A5B] hover:text-[#144E35] transition-colors"
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || validationErrors.length > 0}
          className="w-full bg-[#144E35] hover:bg-[#1f544f] disabled:opacity-50 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-[#144E35]/20 transition-all flex items-center justify-center gap-2 active:scale-95 mt-2"
        >
          {isLoading
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Resetting…</>
            : 'Reset Password'
          }
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
