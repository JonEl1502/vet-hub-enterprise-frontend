
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, Package, Settings, CheckCircle, ArrowRight, ArrowLeft, 
  Plus, X, Upload, FileText, Award, Globe, Users, Target
} from 'lucide-react';

interface OnboardingData {
  // Profile completion
  companyLogo?: File;
  companyBanner?: File;
  tagline?: string;
  specializations: string[];
  certifications: string[];
  
  // Product catalog
  initialProducts: Array<{
    name: string;
    category: string;
    sku: string;
    unitPrice: number;
    unit: string;
    minOrderQty: number;
    description?: string;
  }>;
  
  // Business settings
  paymentTerms: string;
  deliveryAreas: string[];
  minimumOrderValue?: number;
  leadTime: number; // in days
  returnPolicy?: string;
}

interface Props {
  supplierId: number;
  supplierName: string;
  onComplete: (data: OnboardingData) => Promise<void>;
  onSkip: () => void;
}

const SupplierOnboarding: React.FC<Props> = ({ supplierId, supplierName, onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<OnboardingData>({
    tagline: '',
    specializations: [],
    certifications: [],
    initialProducts: [],
    paymentTerms: 'Net 30',
    deliveryAreas: [],
    leadTime: 7,
  });

  const [newSpecialization, setNewSpecialization] = useState('');
  const [newCertification, setNewCertification] = useState('');
  const [newDeliveryArea, setNewDeliveryArea] = useState('');
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: 'Pharmaceuticals',
    sku: '',
    unitPrice: 0,
    unit: 'Units',
    minOrderQty: 1,
    description: ''
  });

  const steps = [
    { number: 1, title: 'Profile Setup', icon: Building2 },
    { number: 2, title: 'Product Catalog', icon: Package },
    { number: 3, title: 'Business Settings', icon: Settings }
  ];

  const productCategories = [
    'Pharmaceuticals',
    'Medical Equipment',
    'Laboratory Supplies',
    'Surgical Instruments',
    'Veterinary Nutrition',
    'Diagnostic Tools',
    'Pet Care Products',
    'Other'
  ];

  const paymentTermsOptions = [
    'Net 15',
    'Net 30',
    'Net 45',
    'Net 60',
    'Due on Receipt',
    'COD'
  ];

  const handleNext = () => {
    setCurrentStep(prev => Math.min(prev + 1, 3));
    setError('');
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError('');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      await onComplete(formData);
    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addSpecialization = () => {
    if (newSpecialization.trim()) {
      setFormData(prev => ({
        ...prev,
        specializations: [...prev.specializations, newSpecialization.trim()]
      }));
      setNewSpecialization('');
    }
  };

  const removeSpecialization = (index: number) => {
    setFormData(prev => ({
      ...prev,
      specializations: prev.specializations.filter((_, i) => i !== index)
    }));
  };

  const addCertification = () => {
    if (newCertification.trim()) {
      setFormData(prev => ({
        ...prev,
        certifications: [...prev.certifications, newCertification.trim()]
      }));
      setNewCertification('');
    }
  };

  const removeCertification = (index: number) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index)
    }));
  };

  const addDeliveryArea = () => {
    if (newDeliveryArea.trim()) {
      setFormData(prev => ({
        ...prev,
        deliveryAreas: [...prev.deliveryAreas, newDeliveryArea.trim()]
      }));
      setNewDeliveryArea('');
    }
  };

  const removeDeliveryArea = (index: number) => {
    setFormData(prev => ({
      ...prev,
      deliveryAreas: prev.deliveryAreas.filter((_, i) => i !== index)
    }));
  };

  const addProduct = () => {
    if (newProduct.name && newProduct.sku && newProduct.unitPrice > 0) {
      setFormData(prev => ({
        ...prev,
        initialProducts: [...prev.initialProducts, { ...newProduct }]
      }));
      setNewProduct({
        name: '',
        category: 'Pharmaceuticals',
        sku: '',
        unitPrice: 0,
        unit: 'Units',
        minOrderQty: 1,
        description: ''
      });
    }
  };

  const removeProduct = (index: number) => {
    setFormData(prev => ({
      ...prev,
      initialProducts: prev.initialProducts.filter((_, i) => i !== index)
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({
        ...prev,
        [type === 'logo' ? 'companyLogo' : 'companyBanner']: e.target.files![0]
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-950 dark:to-zinc-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-5xl w-full overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-pine to-seafoam dark:from-zinc-800 dark:to-zinc-900 p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center">
                <Target size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">Welcome to VetHubCore!</h1>
                <p className="text-white/80 text-sm font-bold">Let's set up your supplier profile - {supplierName}</p>
              </div>
            </div>
            <button
              onClick={onSkip}
              className="text-white/60 hover:text-white text-sm font-bold underline"
            >
              Skip for now
            </button>
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
            {/* Step 1: Profile Setup */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="section-header mb-4">Complete Your Profile</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Company Logo */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Company Logo
                    </label>
                    <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl p-4 text-center">
                      {formData.companyLogo ? (
                        <div className="space-y-2">
                          <FileText className="mx-auto text-seafoam" size={32} />
                          <p className="text-sm font-bold text-pine dark:text-zinc-100">{formData.companyLogo.name}</p>
                          <button
                            onClick={() => setFormData(prev => ({ ...prev, companyLogo: undefined }))}
                            className="text-red-500 text-xs font-bold hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload className="mx-auto text-slate-400 mb-2" size={24} />
                          <label className="compact-button bg-pine dark:bg-zinc-100 text-white dark:text-pine inline-flex items-center gap-2 cursor-pointer">
                            <Upload size={12} />
                            Upload Logo
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileUpload(e, 'logo')}
                              className="hidden"
                            />
                          </label>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Company Banner */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Company Banner
                    </label>
                    <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl p-4 text-center">
                      {formData.companyBanner ? (
                        <div className="space-y-2">
                          <FileText className="mx-auto text-seafoam" size={32} />
                          <p className="text-sm font-bold text-pine dark:text-zinc-100">{formData.companyBanner.name}</p>
                          <button
                            onClick={() => setFormData(prev => ({ ...prev, companyBanner: undefined }))}
                            className="text-red-500 text-xs font-bold hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload className="mx-auto text-slate-400 mb-2" size={24} />
                          <label className="compact-button bg-pine dark:bg-zinc-100 text-white dark:text-pine inline-flex items-center gap-2 cursor-pointer">
                            <Upload size={12} />
                            Upload Banner
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileUpload(e, 'banner')}
                              className="hidden"
                            />
                          </label>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tagline */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Company Tagline
                  </label>
                  <input
                    type="text"
                    value={formData.tagline}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                    placeholder="Your trusted partner in veterinary supplies"
                  />
                </div>

                {/* Specializations */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Specializations
                  </label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={newSpecialization}
                      onChange={(e) => setNewSpecialization(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialization())}
                      className="flex-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold text-sm"
                      placeholder="e.g., Equine Medicine, Small Animal Care"
                    />
                    <button
                      onClick={addSpecialization}
                      className="compact-button bg-pine dark:bg-zinc-100 text-white dark:text-pine"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.specializations.map((spec, index) => (
                      <div
                        key={index}
                        className="bg-seafoam/10 dark:bg-cyan/20 border border-seafoam/20 rounded-lg px-3 py-1.5 flex items-center gap-2"
                      >
                        <span className="text-sm font-bold text-pine dark:text-zinc-100">{spec}</span>
                        <button
                          onClick={() => removeSpecialization(index)}
                          className="text-red-500 hover:bg-red-500/10 rounded p-0.5"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Certifications */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Certifications & Awards
                  </label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={newCertification}
                      onChange={(e) => setNewCertification(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCertification())}
                      className="flex-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold text-sm"
                      placeholder="e.g., ISO 9001, GMP Certified"
                    />
                    <button
                      onClick={addCertification}
                      className="compact-button bg-pine dark:bg-zinc-100 text-white dark:text-pine"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.certifications.map((cert, index) => (
                      <div
                        key={index}
                        className="bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 rounded-lg px-3 py-1.5 flex items-center gap-2"
                      >
                        <Award className="text-amber-500" size={14} />
                        <span className="text-sm font-bold text-pine dark:text-zinc-100">{cert}</span>
                        <button
                          onClick={() => removeCertification(index)}
                          className="text-red-500 hover:bg-red-500/10 rounded p-0.5"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Product Catalog */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="section-header mb-4">Add Your Products</h2>

                {/* Add Product Form */}
                <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-4 space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">New Product</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold text-sm"
                        placeholder="Product name"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Category *
                      </label>
                      <select
                        value={newProduct.category}
                        onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold text-sm"
                      >
                        {productCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        SKU *
                      </label>
                      <input
                        type="text"
                        value={newProduct.sku}
                        onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold text-sm"
                        placeholder="SKU-001"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Unit Price *
                      </label>
                      <input
                        type="number"
                        value={newProduct.unitPrice || ''}
                        onChange={(e) => setNewProduct({ ...newProduct, unitPrice: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold text-sm"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Unit
                      </label>
                      <input
                        type="text"
                        value={newProduct.unit}
                        onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold text-sm"
                        placeholder="Units, Boxes, Bottles"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Min Order Qty
                      </label>
                      <input
                        type="number"
                        value={newProduct.minOrderQty}
                        onChange={(e) => setNewProduct({ ...newProduct, minOrderQty: parseInt(e.target.value) || 1 })}
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold text-sm"
                        min="1"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Description
                      </label>
                      <textarea
                        value={newProduct.description}
                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                        rows={2}
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold text-sm resize-none"
                        placeholder="Product description..."
                      />
                    </div>
                  </div>

                  <button
                    onClick={addProduct}
                    className="compact-button bg-seafoam text-white flex items-center gap-2"
                  >
                    <Plus size={14} />
                    Add Product
                  </button>
                </div>

                {/* Products List */}
                {formData.initialProducts.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">
                      Added Products ({formData.initialProducts.length})
                    </h3>
                    <div className="space-y-2">
                      {formData.initialProducts.map((product, index) => (
                        <div
                          key={index}
                          className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-4 flex items-start justify-between"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Package className="text-seafoam" size={20} />
                              <div>
                                <h4 className="font-black text-pine dark:text-zinc-100">{product.name}</h4>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">{product.category} • {product.sku}</p>
                              </div>
                            </div>
                            <div className="flex gap-4 text-sm">
                              <span className="text-pine dark:text-zinc-100 font-bold">
                                ${product.unitPrice.toFixed(2)} / {product.unit}
                              </span>
                              <span className="text-slate-400 font-bold">
                                Min Order: {product.minOrderQty}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => removeProduct(index)}
                            className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-all"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {formData.initialProducts.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <Package className="mx-auto mb-3" size={48} />
                    <p className="font-bold">No products added yet</p>
                    <p className="text-sm">Add your first product to get started</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3: Business Settings */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="section-header mb-4">Business Settings</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Payment Terms */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Payment Terms
                    </label>
                    <select
                      value={formData.paymentTerms}
                      onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                    >
                      {paymentTermsOptions.map(term => (
                        <option key={term} value={term}>{term}</option>
                      ))}
                    </select>
                  </div>

                  {/* Lead Time */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Lead Time (Days)
                    </label>
                    <input
                      type="number"
                      value={formData.leadTime}
                      onChange={(e) => setFormData({ ...formData, leadTime: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                      min="0"
                    />
                  </div>

                  {/* Minimum Order Value */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Minimum Order Value (Optional)
                    </label>
                    <input
                      type="number"
                      value={formData.minimumOrderValue || ''}
                      onChange={(e) => setFormData({ ...formData, minimumOrderValue: parseFloat(e.target.value) || undefined })}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                {/* Delivery Areas */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Delivery Areas
                  </label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={newDeliveryArea}
                      onChange={(e) => setNewDeliveryArea(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addDeliveryArea())}
                      className="flex-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold text-sm"
                      placeholder="e.g., Nairobi, Mombasa, Kisumu"
                    />
                    <button
                      onClick={addDeliveryArea}
                      className="compact-button bg-pine dark:bg-zinc-100 text-white dark:text-pine"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.deliveryAreas.map((area, index) => (
                      <div
                        key={index}
                        className="bg-cyan/10 dark:bg-cyan/20 border border-cyan/20 rounded-lg px-3 py-1.5 flex items-center gap-2"
                      >
                        <Globe className="text-cyan" size={14} />
                        <span className="text-sm font-bold text-pine dark:text-zinc-100">{area}</span>
                        <button
                          onClick={() => removeDeliveryArea(index)}
                          className="text-red-500 hover:bg-red-500/10 rounded p-0.5"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Return Policy */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Return Policy (Optional)
                  </label>
                  <textarea
                    value={formData.returnPolicy}
                    onChange={(e) => setFormData({ ...formData, returnPolicy: e.target.value })}
                    rows={4}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none font-bold resize-none"
                    placeholder="Describe your return and refund policy..."
                  />
                </div>

                <div className="bg-seafoam/10 dark:bg-cyan/20 border border-seafoam/20 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-pine dark:text-zinc-300">
                    <strong className="font-black">Almost Done!</strong> Review your settings and click Complete to finish setting up your supplier profile.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200 dark:border-zinc-800">
            <div>
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
              {currentStep < 3 ? (
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
                      Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={12} />
                      Complete Setup
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

export default SupplierOnboarding;

