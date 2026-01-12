
import React, { useState, useEffect } from 'react';
import { Clinic, User, UserRole, BillingSettings, SubscriptionPackage } from '../types';
import {
  Palette,
  Users,
  Globe,
  Shield,
  Save,
  Check,
  Layout,
  Sparkles,
  Image as ImageIcon,
  CreditCard,
  Box,
  Zap,
  Settings2,
  X,
  MousePointer2,
  Lock,
  Search,
  ArrowUpRight,
  TrendingUp,
  BarChart3,
  UserPlus,
  Briefcase,
  Coins,
  Edit,
  Eye,
  CheckCircle2,
  Building2,
  Plus,
  Trash2,
  Edit2
} from 'lucide-react';
import { COUNTRIES } from '../constants';
import { categoriesAPI, servicesAPI, Category, Service } from '../services';
import LoadingSpinner from './LoadingSpinner';

interface Props {
  clinic: Clinic;
  allStaff: User[];
  billingSettings: BillingSettings;
  onUpdateClinic: (id: number, data: Partial<Clinic>) => void;
  onUpdateStaff: (id: number, data: Partial<User>) => void;
  onAddStaff: () => void;
  onViewStaff: (user: User) => void;
  onEditStaff: (user: User) => void;
  onUpdateBilling: (data: Partial<BillingSettings>) => void;
  initialTabOverride?: 'branding' | 'visuals' | 'team' | 'categories' | 'billing';
}

const ClinicManagementView: React.FC<Props> = ({ 
  clinic, 
  allStaff, 
  billingSettings, 
  onUpdateClinic, 
  onUpdateStaff, 
  onAddStaff,
  onViewStaff,
  onEditStaff,
  onUpdateBilling, 
  initialTabOverride 
}) => {
  const [activeTab, setActiveTab] = useState<'branding' | 'visuals' | 'team' | 'categories' | 'billing'>(initialTabOverride || 'branding');
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Local state for live preview before saving
  const [localColors, setLocalColors] = useState(clinic.colors || { primary: '#438883', secondary: '#163C39' });
  const [localLogo, setLocalLogo] = useState(clinic.logo || '🐾');
  const [localCurrency, setLocalCurrency] = useState(clinic.currency || 'KES');

  // Categories and Services state
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  const clinicStaff = allStaff.filter(s => s.clinicIds.includes(clinic.id));
  const currentPlan = billingSettings.subscriptionPackages.find(p => p.id === clinic.currentPlanId) || billingSettings.subscriptionPackages[0];

  useEffect(() => {
    setLocalColors(clinic.colors || { primary: '#438883', secondary: '#163C39' });
    setLocalLogo(clinic.logo || '🐾');
    setLocalCurrency(clinic.currency || 'KES');
  }, [clinic.id, clinic.colors, clinic.logo, clinic.currency]);

  // Load categories and services when categories tab is active
  useEffect(() => {
    if (activeTab === 'categories') {
      loadCategories();
      loadServices();
    }
  }, [activeTab]);

  const loadCategories = async () => {
    setIsLoadingCategories(true);
    try {
      const data = await categoriesAPI.getAll();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const loadServices = async () => {
    setIsLoadingServices(true);
    try {
      const data = await servicesAPI.getAll();
      setServices(data);
    } catch (error) {
      console.error('Failed to load services:', error);
    } finally {
      setIsLoadingServices(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      return;
    }

    try {
      await categoriesAPI.delete(categoryId);
      setCategories(categories.filter(c => c.id !== categoryId));
      // Also remove services in this category
      setServices(services.filter(s => s.categoryId !== categoryId));
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert('Failed to delete category. It may be in use by existing appointments.');
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service? This action cannot be undone.')) {
      return;
    }

    try {
      await servicesAPI.delete(serviceId);
      setServices(services.filter(s => s.id !== serviceId));
    } catch (error) {
      console.error('Failed to delete service:', error);
      alert('Failed to delete service. It may be in use by existing appointments.');
    }
  };

  const handleAddCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      const newCategory = await categoriesAPI.create({
        name: formData.get('name') as string,
        description: formData.get('description') as string,
      });
      setCategories([...categories, newCategory]);
      setShowAddCategoryModal(false);
    } catch (error) {
      console.error('Failed to create category:', error);
      alert('Failed to create category');
    }
  };

  const handleAddService = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      const newService = await servicesAPI.create({
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        categoryId: formData.get('categoryId') as string,
        defaultPrice: parseFloat(formData.get('defaultPrice') as string) || undefined,
      });
      setServices([...services, newService]);
      setShowAddServiceModal(false);
    } catch (error) {
      console.error('Failed to create service:', error);
      alert('Failed to create service');
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCategory) return;

    const formData = new FormData(e.currentTarget);

    try {
      const updated = await categoriesAPI.update(editingCategory.id, {
        name: formData.get('name') as string,
        description: formData.get('description') as string,
      });
      setCategories(categories.map(c => c.id === updated.id ? updated : c));
      setEditingCategory(null);
    } catch (error) {
      console.error('Failed to update category:', error);
      alert('Failed to update category');
    }
  };

  const handleUpdateService = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingService) return;

    const formData = new FormData(e.currentTarget);

    try {
      const updated = await servicesAPI.update(editingService.id, {
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        categoryId: formData.get('categoryId') as string,
        defaultPrice: parseFloat(formData.get('defaultPrice') as string) || undefined,
      });
      setServices(services.map(s => s.id === updated.id ? updated : s));
      setEditingService(null);
    } catch (error) {
      console.error('Failed to update service:', error);
      alert('Failed to update service');
    }
  };

  const handleClinicUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    onUpdateClinic(clinic.id, {
      name: formData.get('name') as string,
      subdomain: formData.get('subdomain') as string,
      slogan: formData.get('slogan') as string,
      currency: localCurrency,
      logo: localLogo,
      colors: localColors,
    });
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const colorPresets = [
    { p: '#6366f1', s: '#1e1b4b', label: 'Classic Indigo' },
    { p: '#10b981', s: '#064e3b', label: 'Healing Emerald' },
    { p: '#f59e0b', s: '#451a03', label: 'Vital Amber' },
    { p: '#438883', s: '#163C39', label: 'Enterprise Teal' },
    { p: '#2EA1B8', s: '#163C39', label: 'Ocean Cyan' },
    { p: '#ec4899', s: '#500724', label: 'Soft Petal' },
    { p: '#ef4444', s: '#450a0a', label: 'Urgent Red' },
  ];

  const logoPresets = ['🐾', '🏥', '🐶', '🐱', '🩺', '❤️', '🦴', '🦁', '🦜', '🐹'];

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-zinc-800 pb-8">
        <div>
          <h1 className="text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter mb-1 uppercase leading-none">Clinic Management</h1>
          <p className="text-seafoam dark:text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Configuration matrix for <span className="text-pine dark:text-zinc-300">{clinic.name}</span></p>
        </div>
        
        <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl">
          {[
            { id: 'branding', label: 'Identity', icon: Globe },
            { id: 'visuals', label: 'Appearance', icon: Palette },
            { id: 'team', label: 'Personnel', icon: Users },
            { id: 'categories', label: 'Services', icon: Briefcase },
            { id: 'billing', label: 'Treasury', icon: CreditCard },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-lg' 
                  : 'text-seafoam dark:text-zinc-500 hover:text-pine'
              }`}
            >
              <tab.icon size={12} />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <form onSubmit={handleClinicUpdate} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
         <div className="lg:col-span-8">
            {activeTab === 'branding' && (
               <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-10 shadow-sm space-y-10 animate-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-4 border-b border-slate-50 dark:border-zinc-800 pb-6">
                     <div className="p-3 bg-seafoam text-white rounded-2xl shadow-lg"><Globe size={24}/></div>
                     <h2 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Core Identity</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Clinic Name</label>
                        <input name="name" defaultValue={clinic.name} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-6 py-4 text-pine dark:text-zinc-100 font-black outline-none focus:ring-4 focus:ring-seafoam/5" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Subdomain Protocol</label>
                        <div className="flex items-center bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-6 py-4">
                           <input name="subdomain" defaultValue={clinic.subdomain} className="bg-transparent border-none outline-none font-black text-pine dark:text-zinc-100 w-full" />
                           <span className="text-[10px] font-black text-slate-400 uppercase">.vethub.io</span>
                        </div>
                     </div>
                     <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Corporate Slogan</label>
                        <input name="slogan" defaultValue={clinic.slogan} className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-6 py-4 text-pine dark:text-zinc-100 font-bold outline-none focus:ring-4 focus:ring-seafoam/5" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Currency Node</label>
                        <select 
                          value={localCurrency} 
                          onChange={e => setLocalCurrency(e.target.value)} 
                          className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-6 py-4 text-pine dark:text-zinc-100 font-black outline-none appearance-none"
                        >
                           {COUNTRIES.map(c => <option key={c.code} value={c.currency}>{c.currency} ({c.name})</option>)}
                        </select>
                     </div>
                  </div>
               </div>
            )}

            {activeTab === 'visuals' && (
               <div className="space-y-8 animate-in slide-in-from-bottom-4">
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-10 shadow-sm space-y-10">
                     <div className="flex items-center gap-4 border-b border-slate-50 dark:border-zinc-800 pb-6">
                        <div className="p-3 bg-cyan text-white rounded-2xl shadow-lg"><Palette size={24}/></div>
                        <h2 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Visual Spectrum</h2>
                     </div>

                     <div className="space-y-6">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Node Colors</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                           {colorPresets.map(preset => (
                              <button 
                                key={preset.label}
                                type="button"
                                onClick={() => setLocalColors({ primary: preset.p, secondary: preset.s })}
                                className={`flex flex-col gap-3 p-4 rounded-[1.75rem] border-2 transition-all hover:scale-105 ${localColors.primary === preset.p ? 'border-seafoam bg-seafoam/5' : 'border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950'}`}
                              >
                                 <div className="flex -space-x-2">
                                    <div className="w-10 h-10 rounded-full border-4 border-white dark:border-zinc-900 shadow-lg" style={{ backgroundColor: preset.p }}></div>
                                    <div className="w-10 h-10 rounded-full border-4 border-white dark:border-zinc-900 shadow-lg" style={{ backgroundColor: preset.s }}></div>
                                 </div>
                                 <span className="text-[9px] font-black uppercase text-pine dark:text-zinc-400">{preset.label}</span>
                              </button>
                           ))}
                        </div>
                     </div>

                     <div className="space-y-6 pt-6 border-t border-slate-50 dark:border-zinc-800">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Symbolic Mark (Logo)</p>
                        <div className="flex flex-wrap gap-3">
                           {logoPresets.map(l => (
                              <button 
                                key={l}
                                type="button"
                                onClick={() => setLocalLogo(l)}
                                className={`w-14 h-14 rounded-2xl text-2xl flex items-center justify-center transition-all border-2 ${localLogo === l ? 'bg-seafoam text-white border-seafoam shadow-xl scale-110' : 'bg-slate-50 dark:bg-zinc-800 border-slate-100 dark:border-zinc-700 text-slate-400'}`}
                              >
                                 {l}
                              </button>
                           ))}
                           <button type="button" className="w-14 h-14 rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-300 hover:text-seafoam transition-colors"><ImageIcon size={20}/></button>
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {activeTab === 'team' && (
               <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-sm animate-in slide-in-from-bottom-4">
                  <div className="p-10 border-b border-slate-100 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-center bg-slate-50/50 dark:bg-zinc-800/30 gap-6">
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-500/20"><Users size={28}/></div>
                        <div>
                           <h2 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">Cluster Personnel</h2>
                           <p className="text-seafoam dark:text-zinc-500 text-[8px] font-black uppercase mt-0.5 tracking-widest">Active practitioners linked to this node</p>
                        </div>
                     </div>
                     <button 
                       type="button"
                       onClick={onAddStaff}
                       className="bg-pine dark:bg-zinc-100 text-white dark:text-pine px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-2"
                     >
                        <UserPlus size={16}/> Initialize Practitioner
                     </button>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                       <thead>
                         <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                           <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Practitioner Identity</th>
                           <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Role Node</th>
                           <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Registry ID</th>
                           <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                          {clinicStaff.map(staff => (
                            <tr key={staff.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-all group">
                               <td className="px-10 py-8">
                                  <div className="flex items-center gap-5 cursor-pointer" onClick={() => onViewStaff(staff)}>
                                     <img src={staff.avatar} className="w-14 h-14 rounded-2xl bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 shadow-md group-hover:scale-105 transition-transform" alt="" />
                                     <div>
                                        <p className="text-pine dark:text-zinc-100 font-black text-base leading-tight uppercase truncate">{staff.name}</p>
                                        <p className="text-seafoam dark:text-zinc-500 text-[10px] font-bold mt-0.5">{staff.email}</p>
                                     </div>
                                  </div>
                               </td>
                               <td className="px-10 py-8">
                                  <span className="bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-300 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase border border-slate-200 dark:border-zinc-700 shadow-sm">
                                     {staff.role.replace('_', ' ')}
                                  </span>
                               </td>
                               <td className="px-10 py-8">
                                  <p className="text-[10px] font-black text-slate-400 uppercase font-mono">{staff.idNumber || 'TX-PENDING'}</p>
                               </td>
                               <td className="px-10 py-8 text-right">
                                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <button type="button" onClick={() => onViewStaff(staff)} className="p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-seafoam hover:bg-seafoam hover:text-white rounded-xl transition-all shadow-sm"><Eye size={16}/></button>
                                     <button type="button" onClick={() => onEditStaff(staff)} className="p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-seafoam hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm"><Edit size={16}/></button>
                                  </div>
                               </td>
                            </tr>
                          ))}
                       </tbody>
                     </table>
                  </div>
               </div>
            )}

            {activeTab === 'categories' && (
               <div className="space-y-8 animate-in slide-in-from-bottom-4">
                  {/* Categories Section */}
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-sm">
                     <div className="p-10 border-b border-slate-100 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-center bg-slate-50/50 dark:bg-zinc-800/30 gap-6">
                        <div className="flex items-center gap-4">
                           <div className="p-3 bg-purple-500 text-white rounded-2xl shadow-lg shadow-purple-500/20"><Briefcase size={28}/></div>
                           <div>
                              <h2 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">Service Categories</h2>
                              <p className="text-seafoam dark:text-zinc-500 text-[8px] font-black uppercase mt-0.5 tracking-widest">Manage service categories</p>
                           </div>
                        </div>
                        <button
                           type="button"
                           onClick={() => setShowAddCategoryModal(true)}
                           className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center gap-2"
                        >
                           <Plus size={16} />
                           Add Category
                        </button>
                     </div>
                     <div className="p-10">
                        {isLoadingCategories ? (
                           <div className="py-20"><LoadingSpinner size="lg" message="Loading categories..." /></div>
                        ) : categories.length === 0 ? (
                           <div className="text-center py-20">
                              <Briefcase size={64} className="mx-auto text-slate-300 dark:text-zinc-700 mb-4" />
                              <h3 className="text-xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-2">No Categories Yet</h3>
                              <p className="text-seafoam dark:text-zinc-500 text-sm">
                                 Create your first service category to get started.
                              </p>
                           </div>
                        ) : (
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {categories.map(category => (
                                 <div key={category.id} className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 group hover:shadow-lg transition-all">
                                    {editingCategory?.id === category.id ? (
                                       <form onSubmit={handleUpdateCategory} className="space-y-4">
                                          <input
                                             type="text"
                                             name="name"
                                             defaultValue={category.name}
                                             className="w-full px-4 py-2 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 font-bold"
                                             required
                                          />
                                          <textarea
                                             name="description"
                                             defaultValue={category.description}
                                             className="w-full px-4 py-2 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100"
                                             rows={2}
                                          />
                                          <div className="flex gap-2">
                                             <button type="submit" className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2">
                                                <Save size={14} /> Save
                                             </button>
                                             <button type="button" onClick={() => setEditingCategory(null)} className="flex-1 bg-slate-300 hover:bg-slate-400 text-slate-700 px-4 py-2 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2">
                                                <X size={14} /> Cancel
                                             </button>
                                          </div>
                                       </form>
                                    ) : (
                                       <>
                                          <div className="flex justify-between items-start mb-3">
                                             <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase">{category.name}</h3>
                                             {category.isApproved && (
                                                <span className="bg-green-500 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase">Global</span>
                                             )}
                                          </div>
                                          <p className="text-seafoam dark:text-zinc-400 text-sm mb-4">{category.description || 'No description'}</p>
                                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                             <button
                                                type="button"
                                                onClick={() => setEditingCategory(category)}
                                                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-1"
                                                disabled={category.isApproved}
                                             >
                                                <Edit2 size={12} /> Edit
                                             </button>
                                             <button
                                                type="button"
                                                onClick={() => handleDeleteCategory(category.id)}
                                                className="flex-1 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-1"
                                                disabled={category.isApproved}
                                             >
                                                <Trash2 size={12} /> Delete
                                             </button>
                                          </div>
                                       </>
                                    )}
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Services Section */}
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-sm">
                     <div className="p-10 border-b border-slate-100 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-center bg-slate-50/50 dark:bg-zinc-800/30 gap-6">
                        <div className="flex items-center gap-4">
                           <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-500/20"><Settings2 size={28}/></div>
                           <div>
                              <h2 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">Services</h2>
                              <p className="text-seafoam dark:text-zinc-500 text-[8px] font-black uppercase mt-0.5 tracking-widest">Manage individual services</p>
                           </div>
                        </div>
                        <div className="flex gap-4 items-center">
                           <select
                              value={selectedCategoryFilter}
                              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                              className="px-4 py-2 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 font-bold text-sm"
                           >
                              <option value="ALL">All Categories</option>
                              {categories.map(cat => (
                                 <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                           </select>
                           <button
                              type="button"
                              onClick={() => setShowAddServiceModal(true)}
                              className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center gap-2"
                           >
                              <Plus size={16} />
                              Add Service
                           </button>
                        </div>
                     </div>
                     <div className="p-10">
                        {isLoadingServices ? (
                           <div className="py-20"><LoadingSpinner size="lg" message="Loading services..." /></div>
                        ) : services.filter(s => selectedCategoryFilter === 'ALL' || s.categoryId === selectedCategoryFilter).length === 0 ? (
                           <div className="text-center py-20">
                              <Settings2 size={64} className="mx-auto text-slate-300 dark:text-zinc-700 mb-4" />
                              <h3 className="text-xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-2">No Services Yet</h3>
                              <p className="text-seafoam dark:text-zinc-500 text-sm">
                                 Create your first service to get started.
                              </p>
                           </div>
                        ) : (
                           <div className="overflow-x-auto">
                              <table className="w-full">
                                 <thead>
                                    <tr className="border-b border-slate-200 dark:border-zinc-800">
                                       <th className="px-6 py-4 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">Service Name</th>
                                       <th className="px-6 py-4 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                                       <th className="px-6 py-4 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                                       <th className="px-6 py-4 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">Default Price</th>
                                       <th className="px-6 py-4 text-right text-[8px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                                    </tr>
                                 </thead>
                                 <tbody>
                                    {services.filter(s => selectedCategoryFilter === 'ALL' || s.categoryId === selectedCategoryFilter).map(service => (
                                       <tr key={service.id} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50 group">
                                          <td className="px-6 py-4 font-bold text-pine dark:text-zinc-100">{service.name}</td>
                                          <td className="px-6 py-4">
                                             <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-lg text-xs font-bold">
                                                {service.categoryName}
                                             </span>
                                          </td>
                                          <td className="px-6 py-4 text-seafoam dark:text-zinc-400 text-sm">{service.description || '-'}</td>
                                          <td className="px-6 py-4 font-mono font-bold text-pine dark:text-zinc-100">
                                             {service.defaultPrice ? `${localCurrency} ${service.defaultPrice.toLocaleString()}` : '-'}
                                          </td>
                                          <td className="px-6 py-4 text-right">
                                             <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                   type="button"
                                                   onClick={() => setEditingService(service)}
                                                   className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all"
                                                   disabled={service.isApproved}
                                                >
                                                   <Edit2 size={14} />
                                                </button>
                                                <button
                                                   type="button"
                                                   onClick={() => handleDeleteService(service.id)}
                                                   className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all"
                                                   disabled={service.isApproved}
                                                >
                                                   <Trash2 size={14} />
                                                </button>
                                             </div>
                                          </td>
                                       </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            )}

            {activeTab === 'billing' && (
               <div className="space-y-8 animate-in slide-in-from-bottom-4">
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-10 shadow-sm space-y-10">
                     <div className="flex items-center gap-4 border-b border-slate-50 dark:border-zinc-800 pb-6">
                        <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg"><CreditCard size={24}/></div>
                        <h2 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Plan Registry</h2>
                     </div>

                     <div className="p-10 bg-slate-50 dark:bg-zinc-950 rounded-[2rem] border-2 border-seafoam/20 relative overflow-hidden group">
                        <div className="absolute -right-10 -top-10 text-seafoam/5 group-hover:scale-110 transition-transform duration-1000 rotate-12"><Zap size={200}/></div>
                        <div className="relative z-10">
                           <div className="flex justify-between items-start">
                              <div>
                                 <span className="bg-seafoam text-white text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest">Active Plan</span>
                                 <h3 className="text-3xl font-black text-pine dark:text-zinc-100 uppercase mt-2">{currentPlan.name}</h3>
                              </div>
                              <p className="text-2xl font-black font-mono text-seafoam">KES {currentPlan.price.toLocaleString()}<span className="text-[10px] uppercase">/mo</span></p>
                           </div>
                           <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-6">
                              {[
                                 { label: 'Patient Ceiling', val: currentPlan.limits.patients, icon: Box },
                                 { label: 'Personnel Slots', val: currentPlan.limits.staff, icon: Users },
                                 { label: 'Bio-Archive Storage', val: `${currentPlan.limits.storageGb}GB`, icon: Layout },
                              ].map(l => (
                                 <div key={l.label}>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{l.label}</p>
                                    <p className="text-base font-black text-pine dark:text-zinc-200">{l.val}</p>
                                 </div>
                              ))}
                           </div>
                        </div>
                     </div>
                     
                     <div className="pt-6 flex justify-center">
                        <button type="button" className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all">Migrate Subscription Tier</button>
                     </div>
                  </div>
               </div>
            )}
         </div>

         <div className="lg:col-span-4 space-y-8">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-10 shadow-sm space-y-8 sticky top-24">
               <h3 className="text-lg font-black text-pine dark:text-zinc-100 uppercase">Live Preview</h3>
               
               <div className="p-8 rounded-[2rem] border shadow-2xl relative overflow-hidden group" style={{ backgroundColor: localColors.primary }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                  <div className="relative z-10 flex flex-col items-center gap-6 text-center">
                     <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center text-4xl shadow-xl border border-white/20">{localLogo}</div>
                     <div>
                        <h4 className="text-white text-xl font-black uppercase tracking-tight leading-none">{clinic.name}</h4>
                        <p className="text-white/60 text-[9px] font-bold uppercase tracking-widest mt-2">{clinic.slogan}</p>
                     </div>
                  </div>
               </div>

               <div className="space-y-4 pt-6">
                  <button type="submit" className="w-full bg-pine dark:bg-zinc-100 text-white dark:text-pine py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
                     {savedFeedback ? <CheckCircle2 size={18}/> : <Save size={18}/>}
                     {savedFeedback ? 'NODES COMMITTED' : 'COMMIT REGISTRY'}
                  </button>
                  <p className="text-[8px] font-black text-slate-400 uppercase text-center leading-relaxed">System updates will proliferate to all authorized practitioners instantly.</p>
               </div>
            </div>
         </div>
      </form>

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase">Add Category</h3>
              <button
                type="button"
                onClick={() => setShowAddCategoryModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Category Name</label>
                <input
                  type="text"
                  name="name"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 font-bold"
                  placeholder="e.g., Surgery, Grooming"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Description (Optional)</label>
                <textarea
                  name="description"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100"
                  placeholder="Brief description of this category"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(false)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Service Modal */}
      {showAddServiceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase">Add Service</h3>
              <button
                type="button"
                onClick={() => setShowAddServiceModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddService} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Service Name</label>
                <input
                  type="text"
                  name="name"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 font-bold"
                  placeholder="e.g., General Health Check"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Category</label>
                <select
                  name="categoryId"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 font-bold"
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Description (Optional)</label>
                <textarea
                  name="description"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100"
                  placeholder="Brief description of this service"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Default Price (Optional)</label>
                <input
                  type="number"
                  name="defaultPrice"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 font-mono font-bold"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddServiceModal(false)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Service Modal */}
      {editingService && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase">Edit Service</h3>
              <button
                type="button"
                onClick={() => setEditingService(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateService} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Service Name</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingService.name}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Category</label>
                <select
                  name="categoryId"
                  defaultValue={editingService.categoryId}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 font-bold"
                  required
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Description</label>
                <textarea
                  name="description"
                  defaultValue={editingService.description}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Default Price</label>
                <input
                  type="number"
                  name="defaultPrice"
                  defaultValue={editingService.defaultPrice || ''}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-pine dark:text-zinc-100 font-mono font-bold"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all"
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClinicManagementView;
