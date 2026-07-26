import React, { useState, useRef, useEffect } from 'react';
import { Shield, ArrowLeft, RefreshCw, LogOut, MailCheck } from 'lucide-react';
import { authAPI } from '../../../services/modules/auth.api';

const OTP_LENGTH = 5;
const RESEND_COOLDOWN_SECONDS = 60;

type VerifyMode = 'reset' | 'account-verify';

interface VerifyOTPPageProps {
  email: string;
  /** 'reset' (default) = password-reset OTP. 'account-verify' = post-login
   *  email-verification gate (anti-fake-account). */
  mode?: VerifyMode;
  onOTPVerified: () => void;
  /** Reset mode: go back to the forgot-password step. */
  onBackToForgotPassword?: () => void;
  /** Account-verify mode: log the user out from the gate. */
  onLogout?: () => void;
}

export default function VerifyOTPPage({
  email,
  mode = 'reset',
  onOTPVerified,
  onBackToForgotPassword,
  onLogout,
}: VerifyOTPPageProps) {
  const isAccountVerify = mode === 'account-verify';
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const autoSentRef = useRef(false);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Account-verify mode: auto-send a code once on mount so one is waiting.
  useEffect(() => {
    if (!isAccountVerify || autoSentRef.current) return;
    autoSentRef.current = true;
    setCooldown(RESEND_COOLDOWN_SECONDS);
    authAPI.sendVerificationOtp(email, { showError: false }).catch(() => { /* generic */ });
  }, [isAccountVerify, email]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      const pasted = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, OTP_LENGTH).split('');
      const next = Array(OTP_LENGTH).fill('');
      pasted.forEach((ch, i) => { next[i] = ch; });
      setDigits(next);
      setError('');
      inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
      return;
    }
    const ch = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const next = [...digits];
    next[index] = ch;
    setDigits(next);
    setError('');
    if (ch && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) { setError('Please enter all 5 characters.'); return; }
    setIsLoading(true);
    setError('');
    try {
      const res = isAccountVerify
        ? await authAPI.verifyAccount(email, otp, { showError: false })
        : await authAPI.verifyResetOtp(email, otp, { showError: false });
      if (res.success) {
        onOTPVerified();
      } else {
        throw new Error(res.message || 'Invalid code');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Invalid code. Please check and try again.');
      setDigits(Array(OTP_LENGTH).fill(''));
      setIsLoading(false);
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError('');
    setDigits(Array(OTP_LENGTH).fill(''));
    inputRefs.current[0]?.focus();
    setCooldown(RESEND_COOLDOWN_SECONDS);
    try {
      if (isAccountVerify) {
        await authAPI.sendVerificationOtp(email, { showError: false });
      } else {
        await authAPI.forgotPassword(email, { showError: false });
      }
    } catch { /* generic — backend never reveals account existence */ }
  };

  return (
    <div className="bg-white border border-[#CFE6D8] rounded-2xl p-8 shadow-2xl shadow-[#144E35]/10 w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="text-center mb-7">
        <div className="w-12 h-12 bg-[#1C7A5B] rounded-xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-[#1C7A5B]/20">
          {isAccountVerify ? <MailCheck size={22} className="text-white" /> : <Shield size={22} className="text-white" />}
        </div>
        <h1 className="text-2xl font-black text-[#144E35] tracking-tighter">
          {isAccountVerify ? 'Verify Your Email' : 'Verify Code'}
        </h1>
        <p className="text-[#1C7A5B] text-xs font-semibold mt-1">
          {isAccountVerify ? 'Enter the code we sent to ' : 'Code sent to '}
          <span className="text-[#144E35] font-black">{email}</span>
        </p>
        {isAccountVerify && (
          <p className="text-[#6b8a80] text-xs mt-2">Confirm your email to finish setting up your account.</p>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-600 font-semibold text-center">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex gap-2.5 justify-center">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={el => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="text"
              maxLength={OTP_LENGTH}
              value={digit}
              onChange={e => handleChange(index, e.target.value)}
              onKeyDown={e => handleKeyDown(index, e)}
              disabled={isLoading}
              className={`w-11 h-13 text-center text-lg font-black text-[#144E35] bg-[#f4f7f7] border-2 rounded-xl outline-none transition-all uppercase
                ${digit ? 'border-[#1C7A5B] bg-[#1C7A5B]/5' : 'border-[#CFE6D8]'}
                focus:border-[#1C7A5B] focus:ring-2 focus:ring-[#1C7A5B]/20 disabled:opacity-60`}
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={isLoading || digits.join('').length < OTP_LENGTH}
          className="w-full bg-[#1C7A5B] hover:bg-[#357066] disabled:opacity-50 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-[#1C7A5B]/20 transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          {isLoading
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {isAccountVerify ? 'Verifying…' : 'Verifying…'}</>
            : (isAccountVerify ? 'Verify Email' : 'Verify Code')
          }
        </button>
      </form>

      <div className="mt-5 pt-5 border-t border-[#CFE6D8] flex items-center justify-between">
        {isAccountVerify ? (
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 text-sm font-bold text-[#1C7A5B] hover:text-[#144E35] transition-colors"
          >
            <LogOut size={14} /> Log out
          </button>
        ) : (
          <button
            type="button"
            onClick={onBackToForgotPassword}
            className="flex items-center gap-1.5 text-sm font-bold text-[#1C7A5B] hover:text-[#144E35] transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </button>
        )}
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0}
          className="flex items-center gap-1.5 text-sm font-bold text-[#1C7A5B] hover:text-[#144E35] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={13} /> {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
        </button>
      </div>
    </div>
  );
}
