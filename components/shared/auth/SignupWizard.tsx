import React, { useState, useEffect } from 'react';
import { User, Building2, CheckCircle, ArrowLeft, ArrowRight, Upload, ChevronDown, Eye, EyeOff, Tag } from 'lucide-react';
import { authAPI } from '../../../services';
import { salesRepAPI } from '../../../services/modules/salesRep.api';
import CountrySelect from '../common/CountrySelect';
import LoadingSpinner from '../common/LoadingSpinner';
import { detectCountryCode, getCountry, type Country } from '../../../utils/countries';

interface SignupWizardProps {
  onBackToLogin: () => void;
  onSignupSuccess: (data: any) => void;
  isDemo?: boolean;
}

const TITLES = ['', 'Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof', 'Rev', 'Eng', 'Hon', 'Sir'];

interface UserData {
  title: string;
  firstName: string;
  secondName: string;
  surname: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
}

interface ClinicData {
  name: string;
  address: string;
  city: string;
  country: string;       // display name (e.g. "Kenya") — kept for legacy/address use
  countryCode: string;   // ISO-2 (e.g. "KE")
  dialCode: string;      // E.164 prefix (e.g. "+254")
  region: string;        // AFRICA | ASIA | LATAM | MIDDLE_EAST | EUROPE | OCEANIA | NORTH_AMERICA
  currency: string;      // ISO-4217 (e.g. "KES")
  phone: string;         // local part only — full number = dialCode + phone
  email: string;
  logo: string | null;
  latitude: string;
  longitude: string;
}

export default function SignupWizard({ onBackToLogin, onSignupSuccess, isDemo = false }: SignupWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Sales-rep referral code: ?ref=CODE in the URL auto-fills it; users can
  // also type it manually. We pre-validate against the backend so the badge
  // turns green once the code resolves to a real rep.
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) setReferralCode(ref.toUpperCase());
  }, []);
  useEffect(() => {
    const code = referralCode.trim();
    if (!code) { setReferralValid(null); return; }
    const t = setTimeout(async () => {
      try {
        const res = await salesRepAPI.resolveCode(code);
        setReferralValid(!!res.data?.valid);
      } catch {
        setReferralValid(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [referralCode]);

  const [userData, setUserData] = useState<UserData>({
    title: '',
    firstName: '',
    secondName: '',
    surname: '',
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
    countryCode: 'KE',
    dialCode: '+254',
    region: 'AFRICA',
    currency: 'KES',
    phone: '',
    email: '',
    logo: null,
    latitude: '',
    longitude: '',
  });
  const [locating, setLocating] = useState(false);

  // Auto-detect the user's country once on mount and lock it onto state.
  // The user can override via the dropdown.
  useEffect(() => {
    const detected = detectCountryCode();
    if (!detected) return;
    const c = getCountry(detected);
    if (!c) return;
    setClinicData((prev) => ({
      ...prev,
      country: c.name,
      countryCode: c.code,
      dialCode: c.dialCode,
      region: c.region,
      currency: c.currency,
    }));
  }, []);

  const handleCountryChange = (c: Country) => {
    setClinicData((prev) => ({
      ...prev,
      country: c.name,
      countryCode: c.code,
      dialCode: c.dialCode,
      region: c.region,
      currency: c.currency,
    }));
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setClinicData((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(4),
          longitude: pos.coords.longitude.toFixed(4),
        }));
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const validateStep1 = (): boolean => {
    if (!userData.firstName || !userData.surname || !userData.email || !userData.password || !userData.phone) {
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

    const composedUserPhone = userData.phone
      ? `${clinicData.dialCode} ${userData.phone.trim()}`
      : '';
    const composedClinicPhone = clinicData.phone
      ? `${clinicData.dialCode} ${clinicData.phone.trim()}`
      : '';

    try {
      const response = await authAPI.signup(
        {
          title: userData.title || undefined,
          firstName: userData.firstName,
          secondName: userData.secondName || undefined,
          surname: userData.surname,
          email: userData.email,
          password: userData.password,
          phone: composedUserPhone,
        },
        {
          name: clinicData.name,
          address: clinicData.address,
          city: clinicData.city,
          country: clinicData.country,
          countryCode: clinicData.countryCode,
          dialCode: clinicData.dialCode,
          region: clinicData.region,
          currency: clinicData.currency,
          phone: composedClinicPhone,
          email: clinicData.email,
          logo: clinicData.logo,
          latitude: clinicData.latitude ? parseFloat(clinicData.latitude) : undefined,
          longitude: clinicData.longitude ? parseFloat(clinicData.longitude) : undefined,
          referralCode: referralCode || undefined,
          isDemo,
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

  const steps = [
    { label: 'Your Info', icon: <User size={14} /> },
    { label: 'Clinic', icon: <Building2 size={14} /> },
    { label: 'Review', icon: <CheckCircle size={14} /> },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Primary loading overlay — animated C, dead center, covers the page */}
      {isLoading && <LoadingSpinner fullScreen />}
      {/* Background: pets photo */}
      <img
        src="https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1920&q=80&auto=format&fit=crop"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        aria-hidden="true"
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-[#144E35]/70 backdrop-blur-[2px]" />

      <div className="bg-white border border-[#CFE6D8] rounded-xl shadow-xl shadow-[#144E35]/5 w-full max-w-2xl relative z-10 animate-in fade-in zoom-in-95 duration-500 overflow-hidden">
        {/* Header — supplier-style banner with step indicators */}
        <div className="bg-[#144E35] px-6 pt-5 pb-6">
          {/* Title row */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center shrink-0 shadow-inner p-3">
              <img src="/vethubcore-mark-white.svg" alt="VetHub Core" className="w-full h-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black tracking-tighter text-white">{isDemo ? 'Start Free Demo' : 'Create Your Account'}</h2>
                {isDemo && (
                  <span className="px-2 py-0.5 bg-amber-400/20 text-amber-300 text-[8px] font-black uppercase tracking-widest rounded-full border border-amber-400/30">
                    1-Month Free Demo
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-[#1C7A5B]">{isDemo ? 'Full access for 1 month — no credit card required' : 'Join VetHubCore Enterprise and start managing your clinic'}</p>
            </div>
          </div>
          {/* Step indicators */}
          <div className="relative flex items-start justify-between">
            {/* Connector line behind icons */}
            <div className="absolute top-[18px] left-[18px] right-[18px] h-px bg-white/15">
              <div
                className="h-full bg-[#1C7A5B] transition-all duration-500"
                style={{ width: `${(currentStep - 1) * 50}%` }}
              />
            </div>
            {steps.map((step, i) => {
              const stepNum = i + 1;
              const done = currentStep > stepNum;
              const active = currentStep === stepNum;
              return (
                <div key={stepNum} className="flex flex-col items-center gap-1.5 z-10">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm transition-all duration-300 ${
                    done ? 'bg-[#1C7A5B] text-white' : active ? 'bg-white text-[#144E35]' : 'bg-white/10 text-white/40'
                  }`}>
                    {done ? <CheckCircle size={16} /> : step.icon}
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest transition-all ${
                    active ? 'text-white' : done ? 'text-[#1C7A5B]' : 'text-white/30'
                  }`}>{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6">

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
              <User className="w-5 h-5 text-[#1C7A5B]" />
              <h3 className="text-xl font-black text-[#144E35]">Your Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name fields — full row */}
              <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-[#144E35]/40 uppercase tracking-widest mb-2">Title</label>
                  <div className="relative">
                    <select
                      value={userData.title}
                      onChange={(e) => setUserData({ ...userData, title: e.target.value })}
                      className="w-full bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl px-4 py-3 text-sm text-[#144E35] focus:ring-2 focus:ring-[#1C7A5B]/20 outline-none font-black appearance-none"
                    >
                      {TITLES.map(t => <option key={t} value={t}>{t || '—'}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#144E35]/30 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#144E35]/40 uppercase tracking-widest mb-2">First Name *</label>
                  <input
                    type="text"
                    value={userData.firstName}
                    onChange={(e) => setUserData({ ...userData, firstName: e.target.value })}
                    className="w-full bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl px-4 py-3 text-sm text-[#144E35] focus:ring-2 focus:ring-[#1C7A5B]/20 outline-none font-bold transition-all"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#144E35]/40 uppercase tracking-widest mb-2">Second Name</label>
                  <input
                    type="text"
                    value={userData.secondName}
                    onChange={(e) => setUserData({ ...userData, secondName: e.target.value })}
                    className="w-full bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl px-4 py-3 text-sm text-[#144E35] focus:ring-2 focus:ring-[#1C7A5B]/20 outline-none font-bold transition-all"
                    placeholder="Michael"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#144E35]/40 uppercase tracking-widest mb-2">Surname *</label>
                  <input
                    type="text"
                    value={userData.surname}
                    onChange={(e) => setUserData({ ...userData, surname: e.target.value })}
                    className="w-full bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl px-4 py-3 text-sm text-[#144E35] focus:ring-2 focus:ring-[#1C7A5B]/20 outline-none font-bold transition-all"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#144E35]/40 uppercase tracking-widest mb-2">Email Address *</label>
                <input
                  type="email"
                  value={userData.email}
                  onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                  className="w-full bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl px-4 py-3 text-sm text-[#144E35] focus:ring-2 focus:ring-[#1C7A5B]/20 outline-none font-bold transition-all"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#144E35]/40 uppercase tracking-widest mb-2">Phone Number *</label>
                <div className="flex items-stretch bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl focus-within:ring-2 focus-within:ring-[#1C7A5B]/20 transition-all">
                  <span className="px-3 flex items-center gap-1.5 text-sm font-black text-[#144E35] border-r border-[#CFE6D8]">
                    <span className="text-base leading-none">{getCountry(clinicData.countryCode)?.flag ?? '🌍'}</span>
                    <span>{clinicData.dialCode}</span>
                  </span>
                  <input
                    type="tel"
                    value={userData.phone}
                    onChange={(e) => setUserData({ ...userData, phone: e.target.value.replace(/^\+\d{1,4}\s?/, '') })}
                    className="flex-1 bg-transparent px-3 py-3 text-sm text-[#144E35] outline-none font-bold"
                    placeholder="700 000 000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#144E35]/40 uppercase tracking-widest mb-2">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={userData.password}
                    onChange={(e) => setUserData({ ...userData, password: e.target.value })}
                    className="w-full bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl pl-4 pr-10 py-3 text-sm text-[#144E35] focus:ring-2 focus:ring-[#1C7A5B]/20 outline-none font-bold transition-all"
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1C7A5B] hover:text-[#144E35] transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-[#144E35]/40 uppercase tracking-widest mb-2">Confirm Password *</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={userData.confirmPassword}
                    onChange={(e) => setUserData({ ...userData, confirmPassword: e.target.value })}
                    className="w-full bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl pl-4 pr-10 py-3 text-sm text-[#144E35] focus:ring-2 focus:ring-[#1C7A5B]/20 outline-none font-bold transition-all"
                    placeholder="Re-enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1C7A5B] hover:text-[#144E35] transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Clinic Details */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-[#1C7A5B]" />
              <h3 className="text-xl font-black text-[#144E35]">Clinic Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-[#144E35]/40 uppercase tracking-widest mb-2">Clinic Name *</label>
                <input
                  type="text"
                  value={clinicData.name}
                  onChange={(e) => setClinicData({ ...clinicData, name: e.target.value })}
                  className="w-full bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl px-4 py-3 text-sm text-[#144E35] focus:ring-2 focus:ring-[#1C7A5B]/20 outline-none font-bold transition-all"
                  placeholder="VetHubCore Veterinary Clinic"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-[#144E35]/40 uppercase tracking-widest mb-2">Address *</label>
                <input
                  type="text"
                  value={clinicData.address}
                  onChange={(e) => setClinicData({ ...clinicData, address: e.target.value })}
                  className="w-full bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl px-4 py-3 text-sm text-[#144E35] focus:ring-2 focus:ring-[#1C7A5B]/20 outline-none font-bold transition-all"
                  placeholder="123 Main Street"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#144E35]/40 uppercase tracking-widest mb-2">City *</label>
                <input
                  type="text"
                  value={clinicData.city}
                  onChange={(e) => setClinicData({ ...clinicData, city: e.target.value })}
                  className="w-full bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl px-4 py-3 text-sm text-[#144E35] focus:ring-2 focus:ring-[#1C7A5B]/20 outline-none font-bold transition-all"
                  placeholder="Nairobi"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#144E35]/40 uppercase tracking-widest mb-2">Country *</label>
                <CountrySelect
                  value={clinicData.countryCode}
                  onChange={handleCountryChange}
                />
                <p className="mt-1.5 text-[10px] text-[#144E35]/40 font-bold">
                  Used for billing currency &amp; regional pricing.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#144E35]/40 uppercase tracking-widest mb-2">Clinic Phone *</label>
                <div className="flex items-stretch bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl focus-within:ring-2 focus-within:ring-[#1C7A5B]/20 transition-all">
                  <span className="px-3 flex items-center gap-1.5 text-sm font-black text-[#144E35] border-r border-[#CFE6D8]">
                    <span className="text-base leading-none">{getCountry(clinicData.countryCode)?.flag ?? '🌍'}</span>
                    <span>{clinicData.dialCode}</span>
                  </span>
                  <input
                    type="tel"
                    value={clinicData.phone}
                    onChange={(e) => setClinicData({ ...clinicData, phone: e.target.value.replace(/^\+\d{1,4}\s?/, '') })}
                    className="flex-1 bg-transparent px-3 py-3 text-sm text-[#144E35] outline-none font-bold"
                    placeholder="700 000 000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#144E35]/40 uppercase tracking-widest mb-2">Clinic Email *</label>
                <input
                  type="email"
                  value={clinicData.email}
                  onChange={(e) => setClinicData({ ...clinicData, email: e.target.value })}
                  className="w-full bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl px-4 py-3 text-sm text-[#144E35] focus:ring-2 focus:ring-[#1C7A5B]/20 outline-none font-bold transition-all"
                  placeholder="clinic@example.com"
                />
              </div>

              {/* Coordinates (optional) */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] font-black text-[#144E35]/40 uppercase tracking-widest">Coordinates (Optional)</label>
                  <button
                    type="button"
                    onClick={useMyLocation}
                    disabled={locating}
                    className="text-[10px] font-black text-[#1C7A5B] uppercase tracking-widest hover:underline disabled:opacity-50"
                  >
                    {locating ? 'Locating…' : 'Use my location'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    step="any"
                    value={clinicData.latitude}
                    onChange={(e) => setClinicData({ ...clinicData, latitude: e.target.value })}
                    className="w-full bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl px-4 py-3 text-sm text-[#144E35] focus:ring-2 focus:ring-[#1C7A5B]/20 outline-none font-bold transition-all"
                    placeholder="Latitude (e.g. -1.286389)"
                  />
                  <input
                    type="number"
                    step="any"
                    value={clinicData.longitude}
                    onChange={(e) => setClinicData({ ...clinicData, longitude: e.target.value })}
                    className="w-full bg-[#f4f7f7] border border-[#CFE6D8] rounded-xl px-4 py-3 text-sm text-[#144E35] focus:ring-2 focus:ring-[#1C7A5B]/20 outline-none font-bold transition-all"
                    placeholder="Longitude (e.g. 36.817223)"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-[#144E35]/40 uppercase tracking-widest mb-2">Clinic Logo (Optional)</label>
                <div className="flex items-center gap-4">
                  {clinicData.logo && (
                    <img src={clinicData.logo} alt="Logo preview" className="w-16 h-16 rounded-2xl object-cover border border-[#CFE6D8]" />
                  )}
                  <label className="flex items-center gap-2 px-4 py-2 border border-[#CFE6D8] rounded-2xl cursor-pointer hover:bg-[#f4f7f7] transition-colors">
                    <Upload className="w-5 h-5 text-[#1C7A5B]" />
                    <span className="text-sm text-[#144E35] font-bold">Upload Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Sales-rep referral code — optional. Auto-fills from
                  ?ref=CODE in the URL; turns green once it resolves to a
                  real rep. Bad codes are silently ignored on submit. */}
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-[#144E35]/40 uppercase tracking-widest mb-2">
                  Sales Rep Code (optional)
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1C7A5B]" />
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="e.g. JOHN-K7Q3"
                    className={`w-full bg-[#f4f7f7] border rounded-xl pl-10 pr-12 py-3 text-sm text-[#144E35] outline-none font-mono font-bold transition-all ${
                      referralValid === true
                        ? 'border-emerald-400 focus:ring-2 focus:ring-emerald-300/40'
                        : referralValid === false
                        ? 'border-rose-300 focus:ring-2 focus:ring-rose-300/40'
                        : 'border-[#CFE6D8] focus:ring-2 focus:ring-[#1C7A5B]/20'
                    }`}
                  />
                  {referralValid === true && (
                    <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                  )}
                </div>
                <p className="mt-1 text-[10px] text-[#144E35]/40 font-bold">
                  {referralValid === false
                    ? 'Code not recognised — you can still continue without one.'
                    : 'Got a code from a VetHub Core rep? Drop it here so we attribute your signup to them.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review & Confirm */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-[#1C7A5B]" />
              <h3 className="text-xl font-black text-[#144E35]">Review Your Information</h3>
            </div>

            <div className="bg-[#f4f7f7] border border-[#CFE6D8] rounded-2xl p-6 space-y-4">
              <div>
                <h4 className="font-black text-[#144E35] mb-2 text-sm uppercase tracking-widest">User Details</h4>
                <div className="text-sm text-[#144E35]/70 font-bold space-y-1">
                  <p><strong className="text-[#1C7A5B]">Name:</strong> {[userData.title, userData.firstName, userData.secondName, userData.surname].filter(Boolean).join(' ')}</p>
                  <p><strong className="text-[#1C7A5B]">Email:</strong> {userData.email}</p>
                  <p><strong className="text-[#1C7A5B]">Phone:</strong> {clinicData.dialCode} {userData.phone}</p>
                </div>
              </div>

              <div className="border-t border-[#CFE6D8] pt-4">
                <h4 className="font-black text-[#144E35] mb-2 text-sm uppercase tracking-widest">Clinic Details</h4>
                <div className="text-sm text-[#144E35]/70 font-bold space-y-1">
                  <p><strong className="text-[#1C7A5B]">Clinic Name:</strong> {clinicData.name}</p>
                  <p><strong className="text-[#1C7A5B]">Address:</strong> {clinicData.address}, {clinicData.city}, {getCountry(clinicData.countryCode)?.flag} {clinicData.country}</p>
                  <p><strong className="text-[#1C7A5B]">Phone:</strong> {clinicData.dialCode} {clinicData.phone}</p>
                  <p><strong className="text-[#1C7A5B]">Email:</strong> {clinicData.email}</p>
                  <p><strong className="text-[#1C7A5B]">Billing:</strong> {clinicData.currency} • {clinicData.region.replace('_', ' ')} pricing</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="terms"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 w-4 h-4 text-[#1C7A5B] border-[#CFE6D8] rounded focus:ring-[#1C7A5B]/20"
              />
              <label htmlFor="terms" className="text-sm text-[#144E35]/70 font-bold">
                I agree to the <a href="#" className="text-[#1C7A5B] hover:text-[#144E35] font-black transition-colors">Terms and Conditions</a> and{' '}
                <a href="#" className="text-[#1C7A5B] hover:text-[#144E35] font-black transition-colors">Privacy Policy</a>
              </label>
            </div>

            {/* Onboarding nudge — import feature is discoverable right after signup */}
            <div className="bg-[#f4f7f7] border border-[#CFE6D8] rounded-2xl p-5 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1C7A5B]/10 text-[#1C7A5B] grid place-items-center shrink-0">
                <Upload className="w-5 h-5" />
              </div>
              <div className="text-sm text-[#144E35]/80 font-bold leading-relaxed">
                <p className="font-black text-[#144E35]">Bringing data from another system?</p>
                <p className="mt-1">
                  After signup, head to <span className="text-[#1C7A5B]">Clinic Management &rarr; Import Data</span> to upload your clients, pets, inventory, and staff from a CSV or Excel file.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#CFE6D8]">
          <button
            onClick={currentStep === 1 ? onBackToLogin : handleBack}
            className="flex items-center gap-2 px-6 py-3 text-[#1C7A5B] hover:text-[#144E35] font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {currentStep === 1 ? 'Back to Login' : 'Back'}
          </button>

          {currentStep < 3 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-4 bg-[#144E35] hover:bg-[#1f544f] text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-[#144E35]/20 transition-all active:scale-95"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isLoading || !termsAccepted}
              className="px-6 py-4 bg-[#144E35] hover:bg-[#1f544f] disabled:opacity-50 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-[#144E35]/20 transition-all active:scale-95 disabled:cursor-not-allowed"
            >
              Create Account
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
  );
}

