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

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // Support pasting full OTP into any box
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
    if (ch && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
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
    if (otp.length < OTP_LENGTH) {
      setError('Please enter all 5 characters of the OTP.');
      return;
    }
    setIsLoading(true);
    setError('');
    setTimeout(() => {
      if (VALID_OTPS.includes(otp)) {
        onOTPVerified();
      } else {
        setError('Invalid OTP. Please check the code and try again.');
        setDigits(Array(OTP_LENGTH).fill(''));
        setIsLoading(false);
        inputRefs.current[0]?.focus();
      }
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#f4f7f7] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-[#438883]/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[40rem] h-[40rem] bg-[#2EA1B8]/10 rounded-full blur-[100px]" />

      <div className="bg-white border border-[#DAE7E6] rounded-[3rem] shadow-2xl shadow-[#163C39]/5 p-12 w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        {/* Back */}
        <button
          onClick={onBackToForgotPassword}
          className="absolute top-8 left-8 text-[#163C39]/50 hover:text-[#163C39] transition-colors"
        >
          <ArrowLeft size={20} />
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-[#438883] rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-[#438883]/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-black text-[#163C39] tracking-tighter mb-2">Verify OTP</h2>
          <p className="text-[#438883] font-bold text-sm">
            Enter the 5-character code sent to{' '}
            <strong className="text-[#163C39]">{email}</strong>
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <p className="text-red-600 text-sm font-bold text-center">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* 5-box OTP input */}
          <div className="flex gap-3 justify-center mb-8">
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
                className={`w-12 h-14 text-center text-xl font-black text-[#163C39] bg-[#f4f7f7] border-2 rounded-xl outline-none transition-all uppercase tracking-widest
                  ${digit ? 'border-[#438883] bg-[#438883]/5' : 'border-[#DAE7E6]'}
                  focus:border-[#438883] focus:ring-2 focus:ring-[#438883]/20
                  disabled:opacity-60`}
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={isLoading || digits.join('').length < OTP_LENGTH}
            className="w-full bg-[#438883] hover:bg-[#357066] disabled:bg-[#438883]/50 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-[#438883]/20 transition-all active:scale-95 disabled:active:scale-100 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying…</>
            ) : (
              'Verify OTP'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-[#163C39]/50 font-bold">
            Didn't receive the code?{' '}
            <button
              type="button"
              onClick={onBackToForgotPassword}
              className="text-[#438883] hover:text-[#357066] font-black transition-colors inline-flex items-center gap-1"
            >
              <RefreshCw size={12} /> Resend OTP
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
