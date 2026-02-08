import React, { useState, useRef, useEffect } from 'react';
import { Shield, ArrowLeft } from 'lucide-react';
import { authAPI } from '../services';

interface VerifyOTPPageProps {
  email: string;
  onBackToForgotPassword: () => void;
  onOTPVerified: (resetToken: string) => void;
}

export default function VerifyOTPPage({ email, onBackToForgotPassword, onOTPVerified }: VerifyOTPPageProps) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = [...otp];
    pastedData.split('').forEach((char, index) => {
      if (index < 6) newOtp[index] = char;
    });
    setOtp(newOtp);

    // Focus last filled input
    const lastIndex = Math.min(pastedData.length, 5);
    inputRefs.current[lastIndex]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpValue = otp.join('');

    if (otpValue.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await authAPI.verifyResetOTP(email, otpValue);
      onOTPVerified(response.data.resetToken);
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7f7] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-[#438883]/10 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[40rem] h-[40rem] bg-[#2EA1B8]/10 rounded-full blur-[100px]"></div>

      <div className="bg-white border border-[#DAE7E6] rounded-[3rem] shadow-2xl shadow-[#163C39]/5 p-12 w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        {/* Back Button */}
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
          <p className="text-[#438883] font-bold">
            Enter the 6-digit code sent to <strong>{email}</strong>
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <p className="text-red-600 text-sm font-bold text-center">{error}</p>
          </div>
        )}

        {/* OTP Form */}
        <form onSubmit={handleSubmit}>
          <div className="flex gap-3 justify-center mb-8">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="w-12 h-14 text-center text-2xl font-black text-[#163C39] bg-[#f4f7f7] border-2 border-[#DAE7E6] rounded-xl focus:border-[#438883] focus:outline-none focus:ring-2 focus:ring-[#438883]/20 transition-all"
                disabled={isLoading}
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={isLoading || otp.join('').length !== 6}
            className="w-full bg-[#438883] hover:bg-[#357066] disabled:bg-[#438883]/50 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-[#438883]/20 transition-all active:scale-95 disabled:active:scale-100"
          >
            {isLoading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>

        {/* Resend OTP */}
        <div className="mt-6 text-center">
          <p className="text-sm text-[#163C39]/50 font-bold">
            Didn't receive the code?{' '}
            <button
              onClick={onBackToForgotPassword}
              className="text-[#438883] hover:text-[#357066] font-black transition-colors"
            >
              Resend OTP
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

