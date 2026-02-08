
import React, { useState } from 'react';
import { User, MapPin, Mail, Phone, ArrowRight, X, User as UserIcon, Globe, CreditCard, Calendar, CheckSquare, Square, Coins, Loader2 } from 'lucide-react';
import { Client, ClientRegion } from '../types';
import { COUNTRIES } from '../constants';
import { clientsAPI } from '../services';
import { CacheInvalidators } from '../services/utils/cache';
import { useClinic } from '../contexts/ClinicContext';
import { useData } from '../contexts/DataContext';

interface Props {
  onSave?: (data: Omit<Client, 'id' | 'totalSpent' | 'joinDate'>) => void;
  onCancel: () => void;
  clinicId?: number;
}

const REGIONS: ClientRegion[] = [
  'Local', 'African', 'European', 'North American', 'South American',
  'Australian', 'Arabic', 'East Asian', 'Southeast Asian', 'Indian/Pakistani/Bangladeshi'
];

const RegisterClientView: React.FC<Props> = ({ onSave, onCancel, clinicId }) => {
  const { selectedClinicIds } = useClinic();
  const { refreshClients } = useData();
  const [useCustomCurrency, setUseCustomCurrency] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', address: '', country: 'Kenya', currency: 'KES',
    gender: 'Female' as const, region: 'Local' as ClientRegion, dob: '1990-01-01'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Use clinicId from props or from context
      const activeClinicId = clinicId || selectedClinicIds[0];

      if (!activeClinicId) {
        throw new Error('No clinic selected');
      }

      const clientData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        country: formData.country,
        gender: formData.gender,
        dob: formData.dob ? new Date(formData.dob).toISOString() : undefined,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.name || 'Owner'}`,
      };

      const response: any = await clientsAPI.create(clientData);

      if (response.success) {
        console.log('✅ Client created successfully:', response.data.client);

        // Invalidate cache then refresh the clients list
        CacheInvalidators.invalidateClients();
        await refreshClients();

        // Call onSave callback if provided (for backward compatibility)
        if (onSave) {
          onSave({
            ...formData,
            clinicId: parseInt(activeClinicId),
            avatar: clientData.avatarUrl,
          });
        } else {
          // Close the form
          onCancel();
        }
      } else {
        throw new Error(response.message || 'Failed to create client');
      }
    } catch (err: any) {
      console.error('Failed to create client:', err);
      setError(err.message || 'Failed to create client. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto px-2">
      <header className="flex items-center justify-between py-8 mb-8 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase leading-none">Register Client</h1>
          <p className="text-seafoam dark:text-zinc-400 font-bold mt-1 uppercase tracking-widest text-[10px]">Create a new client profile</p>
        </div>
        <button onClick={onCancel} className="p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-seafoam dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-100 rounded-[1.25rem] transition-all shadow-xl active:scale-95">
          <X size={24}/>
        </button>
      </header>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
           <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[3rem] p-12 shadow-2xl space-y-10">
              <div className="flex items-center gap-4 border-b border-slate-50 dark:border-zinc-800 pb-6">
                 <div className="p-3 bg-seafoam text-white rounded-2xl aspect-square shadow-lg shadow-seafoam/20"><UserIcon size={24}/></div>
                 <h2 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Identity Profile</h2>
              </div>

              <div className="space-y-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Full Legal Name</label>
                  <input required className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-6 py-5 text-pine dark:text-zinc-100 font-black text-lg outline-none focus:ring-4 focus:ring-seafoam/5" placeholder="e.g. Alice Mwikali" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Email Address</label>
                    <div className="relative group">
                      <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-seafoam transition-colors" size={20} />
                      <input type="email" required className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl pl-14 pr-6 py-5 text-pine dark:text-zinc-100 font-bold outline-none" placeholder="alice@example.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Mobile Frequency</label>
                    <div className="relative group">
                      <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-seafoam transition-colors" size={20} />
                      <input required className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl pl-14 pr-6 py-5 text-pine dark:text-zinc-100 font-bold outline-none" placeholder="+254..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Gender</label>
                      <select className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-6 py-5 text-pine dark:text-zinc-100 font-black outline-none appearance-none" value={formData.gender} onChange={e=>setFormData({...formData, gender: e.target.value as any})}>
                        <option>Female</option><option>Male</option><option>Other</option>
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Client Region</label>
                      <select className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-6 py-5 text-pine dark:text-zinc-100 font-black outline-none appearance-none" value={formData.region} onChange={e=>setFormData({...formData, region: e.target.value as any})}>
                         {REGIONS.map(r => <option key={r}>{r}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Temporal Origin (DOB)</label>
                      <div className="relative group">
                         <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-seafoam transition-colors" size={20}/>
                         <input type="date" required className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl pl-14 pr-6 py-5 text-pine dark:text-zinc-100 font-black outline-none" value={formData.dob} onChange={e=>setFormData({...formData, dob: e.target.value})}/>
                      </div>
                   </div>
                </div>

                <div className="space-y-2 pt-6 border-t border-slate-50 dark:border-zinc-800">
                  <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Address</label>
                  <div className="relative group">
                    <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-seafoam transition-colors" size={20} />
                    <input required className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl pl-14 pr-6 py-5 text-pine dark:text-zinc-100 font-bold outline-none" placeholder="e.g. Westlands, Nairobi" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                  </div>
                </div>
              </div>
           </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
           <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[3rem] p-12 shadow-2xl space-y-10 sticky top-24">
              <div className="flex items-center gap-4 border-b border-slate-50 dark:border-zinc-800 pb-6">
                 <div className="p-3 bg-cyan text-white rounded-2xl aspect-square shadow-lg shadow-cyan/20"><Globe size={24}/></div>
                 <h2 className="text-xl font-black text-pine dark:text-zinc-100 tracking-tight uppercase">Location Details</h2>
              </div>
              
              <div className="space-y-10">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Base Origin (Country)</label>
                   <select 
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-6 py-5 text-pine dark:text-zinc-100 font-black outline-none appearance-none" 
                    value={formData.country} 
                    onChange={e => { 
                      const c = COUNTRIES.find(x => x.name === e.target.value); 
                      setFormData({...formData, country: e.target.value, currency: c?.currency || 'KES'}); 
                    }}
                   >
                     {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                   </select>
                </div>
                
                <div className="space-y-6 pt-6 border-t border-slate-50 dark:border-zinc-800">
                  <button 
                    type="button"
                    onClick={() => setUseCustomCurrency(!useCustomCurrency)}
                    className="flex items-center gap-4 group transition-all"
                  >
                    {useCustomCurrency ? <CheckSquare className="text-seafoam" size={28}/> : <Square className="text-slate-300 group-hover:text-seafoam transition-colors" size={28}/>}
                    <span className="text-[11px] font-black uppercase text-pine dark:text-zinc-300 tracking-widest">Set client specific currency</span>
                  </button>

                  {useCustomCurrency && (
                    <div className="space-y-3 animate-in slide-in-from-top-4">
                       <label className="text-[10px] font-black text-seafoam uppercase tracking-widest px-1">Assigned Currency</label>
                       <div className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl px-6 py-5 text-pine dark:text-zinc-100 font-black flex items-center gap-3">
                         <Coins size={18} className="text-seafoam"/>
                         <select className="bg-transparent outline-none flex-1 font-black appearance-none cursor-pointer" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})}>
                            {COUNTRIES.map(c => <option key={c.currency} value={c.currency}>{c.currency} ({c.name})</option>)}
                         </select>
                       </div>
                       <p className="text-[8px] font-black text-slate-400 uppercase leading-relaxed px-1">This currency will override the global clinic default for this client.</p>
                    </div>
                  )}

                  {!useCustomCurrency && (
                    <div className="p-8 bg-slate-50 dark:bg-zinc-800/50 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-zinc-700">
                      <p className="text-[10px] font-black text-slate-400 uppercase leading-relaxed text-center italic">The global clinic currency will be used for all transactions.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl">
                  <p className="text-xs font-bold text-red-600 dark:text-red-400 text-center">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-pine dark:bg-zinc-100 text-white dark:text-pine py-7 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95 group mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    PROCESSING...
                  </>
                ) : (
                  <>
                    REGISTER CLIENT <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
                  </>
                )}
              </button>
           </div>
        </div>
      </form>
    </div>
  );
};

export default RegisterClientView;
