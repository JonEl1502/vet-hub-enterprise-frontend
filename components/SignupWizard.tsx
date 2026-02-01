import React, { useState } from 'react';
import { User, Building2, CheckCircle, ArrowLeft, ArrowRight, Upload } from 'lucide-react';
import { authAPI } from '../services';

interface SignupWizardProps {
  onBackToLogin: () => void;
  onSignupSuccess: (data: any) => void;
}

interface UserData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
}

interface ClinicData {
  name: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  logo: string | null;
}

export default function SignupWizard({ onBackToLogin, onSignupSuccess }: SignupWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [userData, setUserData] = useState<UserData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });

  const [clinicData, setClinicData] = useState<ClinicData>({
    name: '',
    address: '',
    city: '',
    country: 'Kenya',
    phone: '',
    email: '',
    logo: null,
  });

  const validateStep1 = (): boolean => {
    if (!userData.name || !userData.email || !userData.password || !userData.phone) {
      setError('Please fill in all required fields');
      return false;
    }
    if (userData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }
    if (userData.password !== userData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!clinicData.name || !clinicData.address || !clinicData.city || !clinicData.phone || !clinicData.email) {
      setError('Please fill in all required fields');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError('');
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setError('');
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!termsAccepted) {
      setError('Please accept the terms and conditions');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await authAPI.signup(
        {
          name: userData.name,
          email: userData.email,
          password: userData.password,
          phone: userData.phone,
        },
        {
          name: clinicData.name,
          address: clinicData.address,
          city: clinicData.city,
          country: clinicData.country,
          phone: clinicData.phone,
          email: clinicData.email,
          logo: clinicData.logo,
        }
      );

      // The API returns { success, status, message, data: { user, tokens } }
      // Pass the entire response.data to onSignupSuccess
      onSignupSuccess(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setClinicData({ ...clinicData, logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const renderProgressBar = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center flex-1">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                currentStep >= step
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {currentStep > step ? <CheckCircle className="w-6 h-6" /> : step}
            </div>
            {step < 3 && (
              <div
                className={`flex-1 h-1 mx-2 ${
                  currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] font-black text-[#438883] uppercase tracking-widest">
        <span>User Details</span>
        <span>Clinic Details</span>
        <span>Review</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f4f7f7] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-[#438883]/10 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[40rem] h-[40rem] bg-[#2EA1B8]/10 rounded-full blur-[100px]"></div>

      <div className="bg-white border border-[#DAE7E6] rounded-xl shadow-xl shadow-[#163C39]/5 p-6 w-full max-w-2xl relative z-10 animate-in fade-in zoom-in-95 duration-500">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-[#163C39] rounded-xl flex items-center justify-center text-2xl mx-auto mb-3 shadow-lg shadow-[#163C39]/20">🐾</div>
          <h2 className="text-2xl font-black text-[#163C39] tracking-tighter mb-1.5">Create Your Account</h2>
          <p className="text-[#438883] text-xs font-bold">Join VetHub Enterprise and start managing your clinic</p>
        </div>

        {renderProgressBar()}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <p className="text-sm text-red-600 font-semibold">{error}</p>
          </div>
        )}

        {/* Step 1: User Details */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-[#438883]" />
              <h3 className="text-xl font-black text-[#163C39]">Your Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-[#163C39]/40 uppercase tracking-widest mb-2">Full Name *</label>
                <input
                  type="text"
                  value={userData.name}
                  onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                  className="w-full bg-[#f4f7f7] border border-[#DAE7E6] rounded-2xl px-4 py-3 text-[#163C39] focus:ring-2 focus:ring-[#438883]/20 outline-none font-bold transition-all"
                  placeholder="Dr. John Doe"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#163C39]/40 uppercase tracking-widest mb-2">Email Address *</label>
                <input
                  type="email"
                  value={userData.email}
                  onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                  className="w-full bg-[#f4f7f7] border border-[#DAE7E6] rounded-2xl px-4 py-3 text-[#163C39] focus:ring-2 focus:ring-[#438883]/20 outline-none font-bold transition-all"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#163C39]/40 uppercase tracking-widest mb-2">Phone Number *</label>
                <input
                  type="tel"
                  value={userData.phone}
                  onChange={(e) => setUserData({ ...userData, phone: e.target.value })}
                  className="w-full bg-[#f4f7f7] border border-[#DAE7E6] rounded-2xl px-4 py-3 text-[#163C39] focus:ring-2 focus:ring-[#438883]/20 outline-none font-bold transition-all"
                  placeholder="+254 700 000 000"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#163C39]/40 uppercase tracking-widest mb-2">Password *</label>
                <input
                  type="password"
                  value={userData.password}
                  onChange={(e) => setUserData({ ...userData, password: e.target.value })}
                  className="w-full bg-[#f4f7f7] border border-[#DAE7E6] rounded-2xl px-4 py-3 text-[#163C39] focus:ring-2 focus:ring-[#438883]/20 outline-none font-bold transition-all"
                  placeholder="Min. 8 characters"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-[#163C39]/40 uppercase tracking-widest mb-2">Confirm Password *</label>
                <input
                  type="password"
                  value={userData.confirmPassword}
                  onChange={(e) => setUserData({ ...userData, confirmPassword: e.target.value })}
                  className="w-full bg-[#f4f7f7] border border-[#DAE7E6] rounded-2xl px-4 py-3 text-[#163C39] focus:ring-2 focus:ring-[#438883]/20 outline-none font-bold transition-all"
                  placeholder="Re-enter password"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Clinic Details */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-[#438883]" />
              <h3 className="text-xl font-black text-[#163C39]">Clinic Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-[#163C39]/40 uppercase tracking-widest mb-2">Clinic Name *</label>
                <input
                  type="text"
                  value={clinicData.name}
                  onChange={(e) => setClinicData({ ...clinicData, name: e.target.value })}
                  className="w-full bg-[#f4f7f7] border border-[#DAE7E6] rounded-2xl px-4 py-3 text-[#163C39] focus:ring-2 focus:ring-[#438883]/20 outline-none font-bold transition-all"
                  placeholder="VetHub Veterinary Clinic"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-[#163C39]/40 uppercase tracking-widest mb-2">Address *</label>
                <input
                  type="text"
                  value={clinicData.address}
                  onChange={(e) => setClinicData({ ...clinicData, address: e.target.value })}
                  className="w-full bg-[#f4f7f7] border border-[#DAE7E6] rounded-2xl px-4 py-3 text-[#163C39] focus:ring-2 focus:ring-[#438883]/20 outline-none font-bold transition-all"
                  placeholder="123 Main Street"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#163C39]/40 uppercase tracking-widest mb-2">City *</label>
                <input
                  type="text"
                  value={clinicData.city}
                  onChange={(e) => setClinicData({ ...clinicData, city: e.target.value })}
                  className="w-full bg-[#f4f7f7] border border-[#DAE7E6] rounded-2xl px-4 py-3 text-[#163C39] focus:ring-2 focus:ring-[#438883]/20 outline-none font-bold transition-all"
                  placeholder="Nairobi"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#163C39]/40 uppercase tracking-widest mb-2">Country *</label>
                <select
                  value={clinicData.country}
                  onChange={(e) => setClinicData({ ...clinicData, country: e.target.value })}
                  className="w-full bg-[#f4f7f7] border border-[#DAE7E6] rounded-2xl px-4 py-3 text-[#163C39] focus:ring-2 focus:ring-[#438883]/20 outline-none font-bold transition-all"
                >
                  <option value="Kenya">Kenya</option>
                  <option value="Uganda">Uganda</option>
                  <option value="Tanzania">Tanzania</option>
                  <option value="Rwanda">Rwanda</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#163C39]/40 uppercase tracking-widest mb-2">Clinic Phone *</label>
                <input
                  type="tel"
                  value={clinicData.phone}
                  onChange={(e) => setClinicData({ ...clinicData, phone: e.target.value })}
                  className="w-full bg-[#f4f7f7] border border-[#DAE7E6] rounded-2xl px-4 py-3 text-[#163C39] focus:ring-2 focus:ring-[#438883]/20 outline-none font-bold transition-all"
                  placeholder="+254 700 000 000"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#163C39]/40 uppercase tracking-widest mb-2">Clinic Email *</label>
                <input
                  type="email"
                  value={clinicData.email}
                  onChange={(e) => setClinicData({ ...clinicData, email: e.target.value })}
                  className="w-full bg-[#f4f7f7] border border-[#DAE7E6] rounded-2xl px-4 py-3 text-[#163C39] focus:ring-2 focus:ring-[#438883]/20 outline-none font-bold transition-all"
                  placeholder="clinic@example.com"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-[#163C39]/40 uppercase tracking-widest mb-2">Clinic Logo (Optional)</label>
                <div className="flex items-center gap-4">
                  {clinicData.logo && (
                    <img src={clinicData.logo} alt="Logo preview" className="w-16 h-16 rounded-2xl object-cover border border-[#DAE7E6]" />
                  )}
                  <label className="flex items-center gap-2 px-4 py-2 border border-[#DAE7E6] rounded-2xl cursor-pointer hover:bg-[#f4f7f7] transition-colors">
                    <Upload className="w-5 h-5 text-[#438883]" />
                    <span className="text-sm text-[#163C39] font-bold">Upload Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review & Confirm */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-[#438883]" />
              <h3 className="text-xl font-black text-[#163C39]">Review Your Information</h3>
            </div>

            <div className="bg-[#f4f7f7] border border-[#DAE7E6] rounded-2xl p-6 space-y-4">
              <div>
                <h4 className="font-black text-[#163C39] mb-2 text-sm uppercase tracking-widest">User Details</h4>
                <div className="text-sm text-[#163C39]/70 font-bold space-y-1">
                  <p><strong className="text-[#438883]">Name:</strong> {userData.name}</p>
                  <p><strong className="text-[#438883]">Email:</strong> {userData.email}</p>
                  <p><strong className="text-[#438883]">Phone:</strong> {userData.phone}</p>
                </div>
              </div>

              <div className="border-t border-[#DAE7E6] pt-4">
                <h4 className="font-black text-[#163C39] mb-2 text-sm uppercase tracking-widest">Clinic Details</h4>
                <div className="text-sm text-[#163C39]/70 font-bold space-y-1">
                  <p><strong className="text-[#438883]">Clinic Name:</strong> {clinicData.name}</p>
                  <p><strong className="text-[#438883]">Address:</strong> {clinicData.address}, {clinicData.city}, {clinicData.country}</p>
                  <p><strong className="text-[#438883]">Phone:</strong> {clinicData.phone}</p>
                  <p><strong className="text-[#438883]">Email:</strong> {clinicData.email}</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="terms"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 w-4 h-4 text-[#438883] border-[#DAE7E6] rounded focus:ring-[#438883]/20"
              />
              <label htmlFor="terms" className="text-sm text-[#163C39]/70 font-bold">
                I agree to the <a href="#" className="text-[#438883] hover:text-[#163C39] font-black transition-colors">Terms and Conditions</a> and{' '}
                <a href="#" className="text-[#438883] hover:text-[#163C39] font-black transition-colors">Privacy Policy</a>
              </label>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#DAE7E6]">
          <button
            onClick={currentStep === 1 ? onBackToLogin : handleBack}
            className="flex items-center gap-2 px-6 py-3 text-[#438883] hover:text-[#163C39] font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {currentStep === 1 ? 'Back to Login' : 'Back'}
          </button>

          {currentStep < 3 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-4 bg-[#163C39] hover:bg-[#1f544f] text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-[#163C39]/20 transition-all active:scale-95"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isLoading || !termsAccepted}
              className="px-6 py-4 bg-[#163C39] hover:bg-[#1f544f] disabled:opacity-50 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-[#163C39]/20 transition-all active:scale-95 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating Account...
                </div>
              ) : (
                'Create Account'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

