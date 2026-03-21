import React, { useState, useRef, useEffect } from 'react';
import { Shield, ArrowLeft, RefreshCw } from 'lucide-react';

const VALID_OTPS = ['5T74R', '000AB'];
const OTP_LENGTH = 5;

interface VerifyOTPPageProps {
  email: string;
  onBackToForgotPassword: () => void;
  onOTPVerified: () => void;
}

export default function VerifyOTPPage({ email, onBackToForgotPassword, onOTPVerified }: VerifyOTPPageProps) {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) { setError('Please enter all 5 characters.'); return; }
    setIsLoading(true);
    setError('');
    setTimeout(() => {
      if (VALID_OTPS.includes(otp)) {
        onOTPVerified();
      } else {
        setError('Invalid code. Please check and try again.');
        setDigits(Array(OTP_LENGTH).fill(''));
        setIsLoading(false);
        inputRefs.current[0]?.focus();
      }
    }, 600);
  };

  return (
    <div className="bg-white border border-[#DAE7E6] rounded-2xl p-8 shadow-2xl shadow-[#163C39]/10 w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="text-center mb-7">
        <div className="w-12 h-12 bg-[#438883] rounded-xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-[#438883]/20">
          <Shield size={22} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-[#163C39] tracking-tighter">Verify Code</h1>
        <p className="text-[#438883] text-xs font-semibold mt-1">
          Code sent to <span className="text-[#163C39] font-black">{email}</span>
        </p>
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
              className={`w-11 h-13 text-center text-lg font-black text-[#163C39] bg-[#f4f7f7] border-2 rounded-xl outline-none transition-all uppercase
                ${digit ? 'border-[#438883] bg-[#438883]/5' : 'border-[#DAE7E6]'}
                focus:border-[#438883] focus:ring-2 focus:ring-[#438883]/20 disabled:opacity-60`}
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={isLoading || digits.join('').length < OTP_LENGTH}
          className="w-full bg-[#438883] hover:bg-[#357066] disabled:opacity-50 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-[#438883]/20 transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          {isLoading
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying…</>
            : 'Verify Code'
          }
        </button>
      </form>

      <div className="mt-5 pt-5 border-t border-[#DAE7E6] flex items-center justify-between">
        <button
          onClick={onBackToForgotPassword}
          className="flex items-center gap-1.5 text-sm font-bold text-[#438883] hover:text-[#163C39] transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <button
          type="button"
          onClick={onBackToForgotPassword}
          className="flex items-center gap-1.5 text-sm font-bold text-[#438883] hover:text-[#163C39] transition-colors"
        >
          <RefreshCw size={13} /> Resend Code
        </button>
      </div>
    </div>
  );
}
