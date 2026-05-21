
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SupplierRegistrationData, SupplierVerificationStatus } from '../../../types';
import { Building2, Mail, Phone, MapPin, User, Lock, FileText, CheckCircle, ArrowRight, ArrowLeft, Upload, X, Eye, EyeOff } from 'lucide-react';

interface Props {
  onSubmit: (data: SupplierRegistrationData) => Promise<void>;
  onCancel: () => void;
}

const SupplierRegistration: React.FC<Props> = ({ onSubmit, onCancel }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState<SupplierRegistrationData>({
    companyName: '',
    category: 'Pharmaceuticals',
    registrationNumber: '',
    taxId: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    city: '',
    country: 'Kenya',
    website: '',
    userName: '',
    userEmail: '',
    userPassword: '',
    description: '',
    yearsInBusiness: 0,
    certifications: [],
    verificationStatus: SupplierVerificationStatus.PENDING,
    documents: []
  });

  const categories = [
    'Pharmaceuticals',
    'Medical Equipment',
    'Laboratory Supplies',
    'Surgical Instruments',
    'Veterinary Nutrition',
    'Diagnostic Tools',
    'Pet Care Products',
    'Other'
  ];

  const steps = [
    { number: 1, title: 'Company Info', icon: Building2 },
    { number: 2, title: 'Contact Details', icon: Mail },
    { number: 3, title: 'Account Setup', icon: User },
    { number: 4, title: 'Verification', icon: FileText }
  ];

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
      setError('');
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError('');
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.companyName || !formData.category) {
          setError('Please fill in all required fields');
          return false;
        }
        break;
      case 2:
        if (!formData.contactEmail || !formData.contactPhone || !formData.address || !formData.city) {
          setError('Please fill in all required contact details');
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
          setError('Please enter a valid email address');
          return false;
        }
        break;
      case 3:
        if (!formData.userName || !formData.userEmail || !formData.userPassword) {
          setError('Please fill in all account details');
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.userEmail)) {
          setError('Please enter a valid email address');
          return false;
        }
        if (formData.userPassword.length < 8) {
          setError('Password must be at least 8 characters');
          return false;
        }
        break;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit(formData);
    } catch (err: any) {
      setError(err.message || 'Failed to submit registration');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setFormData(prev => ({
        ...prev,
        documents: [...(prev.documents || []), ...files]
      }));
    }
  };

  const removeDocument = (index: number) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents?.filter((_, i) => i !== index) || []
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background: vet supplies / medicine / pet transport */}
      <img
        src="https://images.unsplash.com/photo-1548767797-d8c844163c4a?w=1920&q=80&auto=format&fit=crop"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-slate-900/65 backdrop-blur-[2px]" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-pine to-seafoam dark:from-zinc-800 dark:to-zinc-900 p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center">
              <Building2 size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Supplier Registration</h1>
              <p className="text-white/80 text-sm font-bold">Join VetHubCore's supplier network</p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-between mt-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;

              return (
                <React.Fragment key={step.number}>
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        isCompleted
                          ? 'bg-white text-seafoam'
                          : isActive
                          ? 'bg-white text-pine'
                          : 'bg-white/20 text-white/60'
                      }`}
                    >
                      {isCompleted ? <CheckCircle size={20} /> : <Icon size={20} />}
                    </div>
                    <div className="text-center">
                      <div className={`text-[9px] font-black uppercase tracking-wider ${isActive || isCompleted ? 'text-white' : 'text-white/60'}`}>
                        {step.title}
                      </div>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 ${isCompleted ? 'bg-white' : 'bg-white/20'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-bold">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* Step 1: Company Information */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h2 className="section-header mb-4">Company Information</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                      placeholder="ABC Pharmaceuticals Ltd"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Category *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Registration Number
                    </label>
                    <input
                      type="text"
                      value={formData.registrationNumber}
                      onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                      placeholder="REG123456"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Tax ID
                    </label>
                    <input
                      type="text"
                      value={formData.taxId}
                      onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                      placeholder="TAX123456"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Company Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold resize-none"
                      placeholder="Brief description of your company and services..."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Years in Business
                    </label>
                    <input
                      type="number"
                      value={formData.yearsInBusiness || ''}
                      onChange={(e) => setFormData({ ...formData, yearsInBusiness: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                      placeholder="5"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Website
                    </label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Contact Details */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h2 className="section-header mb-4">Contact Details</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Contact Email *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="email"
                        value={formData.contactEmail}
                        onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                        placeholder="contact@company.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Contact Phone *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="tel"
                        value={formData.contactPhone}
                        onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                        placeholder="+254 700 000000"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Address *
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 text-slate-400" size={16} />
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                        placeholder="123 Business Street"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      City *
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                      placeholder="Nairobi"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Country *
                    </label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                      placeholder="Kenya"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Account Setup */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h2 className="section-header mb-4">Account Setup</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        value={formData.userName}
                        onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="email"
                        value={formData.userEmail}
                        onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                        placeholder="john@company.com"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Password *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.userPassword}
                        onChange={(e) => setFormData({ ...formData, userPassword: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-10 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-200 transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold mt-1">Minimum 8 characters</p>
                  </div>
                </div>

                <div className="bg-cyan/10 dark:bg-cyan/20 border border-cyan/20 rounded-xl p-4 mt-4">
                  <p className="text-[10px] font-bold text-pine dark:text-zinc-300">
                    <strong className="font-black">Note:</strong> This account will be used to access the supplier dashboard and manage your products.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 4: Verification */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h2 className="section-header mb-4">Verification Documents</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Upload Documents (Optional)
                    </label>
                    <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl p-6 text-center">
                      <Upload className="mx-auto text-slate-400 mb-3" size={32} />
                      <p className="text-sm font-bold text-pine dark:text-zinc-300 mb-2">
                        Upload business registration, certifications, or licenses
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold mb-4">
                        PDF, JPG, PNG up to 10MB each
                      </p>
                      <label className="compact-button bg-pine dark:bg-zinc-100 text-white dark:text-pine inline-flex items-center gap-2 cursor-pointer">
                        <Upload size={12} />
                        Choose Files
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {formData.documents && formData.documents.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                        Uploaded Documents ({formData.documents.length})
                      </div>
                      {formData.documents.map((doc, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-slate-50 dark:bg-zinc-800 rounded-xl p-3"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="text-seafoam" size={20} />
                            <div>
                              <div className="text-sm font-bold text-pine dark:text-zinc-100">{doc.name}</div>
                              <div className="text-[9px] text-slate-400 font-bold">
                                {(doc.size / 1024).toFixed(2)} KB
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => removeDocument(index)}
                            className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-all"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-pine dark:text-zinc-300">
                      <strong className="font-black">Verification Process:</strong> Your application will be reviewed by our team within 2-3 business days. You'll receive an email notification once approved.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200 dark:border-zinc-800">
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="compact-button bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100"
              >
                Cancel
              </button>
              {currentStep > 1 && (
                <button
                  onClick={handlePrevious}
                  className="compact-button bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100 flex items-center gap-2"
                >
                  <ArrowLeft size={12} />
                  Previous
                </button>
              )}
            </div>

            <div className="flex gap-3">
              {currentStep < 4 ? (
                <button
                  onClick={handleNext}
                  className="compact-button bg-pine dark:bg-zinc-100 text-white dark:text-pine flex items-center gap-2"
                >
                  Next
                  <ArrowRight size={12} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="compact-button bg-seafoam text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={12} />
                      Submit Registration
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SupplierRegistration;

