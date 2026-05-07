
import React, { useState } from 'react';
import { BillingSettings, SubscriptionPackage } from '../../../types';
import { Plus, Check, Settings2, Zap, Layout, Shield, Box, Sparkles, X, Filter, BarChart3, Globe, Users } from 'lucide-react';

interface Props {
  billingSettings: BillingSettings;
  currency: string;
  onUpdateBilling: (data: Partial<BillingSettings>) => void;
}

const BillingTiersView: React.FC<Props> = ({ billingSettings, currency, onUpdateBilling }) => {
  const [selectedTierId, setSelectedTierId] = useState<number>(billingSettings.subscriptionPackages[0].id);

  const availableFeatures = [
    { id: 'PATIENTS_UNLIMITED', label: 'Unlimited Patients', icon: Box, category: 'CORE' },
    { id: 'INVENTORY_CORE', label: 'Inventory Management', icon: Shield, category: 'CORE' },
    { id: 'INVENTORY_FULL', label: 'Advanced Inventory (Expiry, POs)', icon: Shield, category: 'LOGISTICS' },
    { id: 'REPORTS_BASIC', label: 'Basic Financial Reports', icon: BarChart3, category: 'ANALYTICS' },
    { id: 'REPORTS_ADVANCED', label: 'Advanced Analytics', icon: BarChart3, category: 'ANALYTICS' },
    { id: 'REPORTS_AI', label: 'AI Business Intelligence', icon: Sparkles, category: 'ANALYTICS' },
    { id: 'B2B_REFERRALS', label: 'Global Referral Network', icon: Globe, category: 'NETWORK' },
    { id: 'AI_DIAGNOSTICS', label: 'Gemini AI Diagnostics', icon: Sparkles, category: 'CLINICAL' },
    { id: 'CUSTOM_BRANDING', label: 'White-label Visuals', icon: Layout, category: 'BRANDING' },
    { id: 'MULTI_LOCATION', label: 'Multi-location Support', icon: Globe, category: 'ENTERPRISE' },
    { id: 'API_ACCESS', label: 'Developer API Interface', icon: Settings2, category: 'ENTERPRISE' },
    { id: 'SMS_NOTIFICATIONS', label: 'SMS Notifications', icon: Zap, category: 'OUTREACH' },
  ];

  const selectedTier = billingSettings.subscriptionPackages.find(p => p.id === selectedTierId)!;

  const toggleFeature = (featureId: string) => {
    const updatedPackages = billingSettings.subscriptionPackages.map(pkg => {
      if (pkg.id === selectedTierId) {
        const hasFeature = pkg.features.includes(featureId);
        return {
          ...pkg,
          features: hasFeature 
            ? pkg.features.filter(f => f !== featureId) 
            : [...pkg.features, featureId]
        };
      }
      return pkg;
    });
    onUpdateBilling({ subscriptionPackages: updatedPackages });
  };

  const updateTierField = (field: keyof SubscriptionPackage, value: any) => {
    const updatedPackages = billingSettings.subscriptionPackages.map(pkg => {
      if (pkg.id === selectedTierId) {
        return { ...pkg, [field]: value };
      }
      return pkg;
    });
    onUpdateBilling({ subscriptionPackages: updatedPackages });
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-zinc-800 pb-8">
        <div>
          <h1 className="text-5xl font-black text-pine dark:text-zinc-100 tracking-tighter mb-2">Pricing & Plans</h1>
          <p className="text-seafoam dark:text-zinc-500 font-medium text-lg font-bold">Enterprise tier orchestration & feature mapping</p>
        </div>
        <button className="bg-pine dark:bg-zinc-100 text-white dark:text-pine px-10 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95">
          + Create New Tier
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tier Selector Sidebar */}
        <div className="lg:col-span-4 space-y-4">
           <p className="text-[8px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-[0.2em] px-3">Active Plans</p>
           <div className="space-y-2">
              {billingSettings.subscriptionPackages.map(pkg => (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedTierId(pkg.id)}
                  className={`w-full text-left p-6 rounded-xl border-2 transition-all group relative overflow-hidden ${
                    selectedTierId === pkg.id
                      ? 'border-seafoam bg-seafoam/5 shadow-lg shadow-seafoam/10'
                      : 'border-slate-100 dark:border-zinc-900 bg-white dark:bg-zinc-950 hover:border-slate-200 dark:hover:border-zinc-800'
                  }`}
                >
                  <div className="relative z-10">
                    <h3 className={`text-xl font-black tracking-tight ${selectedTierId === pkg.id ? 'text-pine dark:text-zinc-100' : 'text-slate-400 dark:text-zinc-700'}`}>{pkg.name}</h3>
                    <p className={`text-sm font-black font-mono mt-1.5 ${selectedTierId === pkg.id ? 'text-seafoam' : 'text-slate-300 dark:text-zinc-800'}`}>
                      {currency} {pkg.price.toLocaleString()}
                      <span className="text-[8px] uppercase">/{pkg.billingCycle.toLowerCase()}</span>
                    </p>
                  </div>
                  {selectedTierId === pkg.id && (
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-seafoam rounded-full animate-pulse shadow-[0_0_12px_rgba(67,136,131,0.6)]"></div>
                  )}
                </button>
              ))}
           </div>

           <div className="compact-card space-y-6">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-500 border border-indigo-100 dark:border-indigo-500/20"><Filter size={16}/></div>
                 <h4 className="text-xs font-black text-pine dark:text-zinc-100 uppercase tracking-widest">Pricing Parameters</h4>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                   <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Tax Rate (%)</label>
                   <input
                    type="number"
                    value={billingSettings.taxRate}
                    onChange={e => onUpdateBilling({ taxRate: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-black"
                   />
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-100 dark:border-zinc-700">
                   <span className="text-[8px] font-black text-pine dark:text-zinc-300 uppercase tracking-widest">Partial Settlements</span>
                   <div
                    onClick={() => onUpdateBilling({ allowPartialPayments: !billingSettings.allowPartialPayments })}
                    className={`w-11 h-5 rounded-full p-0.5 transition-all cursor-pointer ${billingSettings.allowPartialPayments ? 'bg-seafoam' : 'bg-slate-300'}`}
                   >
                    <div className={`w-4 h-4 bg-white rounded-full transition-all ${billingSettings.allowPartialPayments ? 'ml-5' : 'ml-0'}`}></div>
                   </div>
                </div>
              </div>
           </div>
        </div>

        {/* Feature Mapping Interface */}
        <div className="lg:col-span-8 space-y-6 animate-in slide-in-from-right-4">
           <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-8 shadow-lg space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 dark:border-zinc-800 pb-6">
                 <div>
                    <div className="flex items-center gap-2 mb-1.5">
                       <span className="bg-seafoam text-white text-[8px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest">Active Context</span>
                       <h2 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">{selectedTier.name}</h2>
                    </div>
                    <p className="text-slate-400 dark:text-zinc-500 text-xs font-bold">Map capabilities to this specific subscription tier.</p>
                 </div>
                 <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-100 dark:border-zinc-800 flex gap-6">
                    <div>
                       <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Fee</p>
                       <input 
                        type="number" 
                        value={selectedTier.price} 
                        onChange={e => updateTierField('price', Number(e.target.value))}
                        className="bg-transparent text-xl font-black text-pine dark:text-zinc-100 font-mono outline-none w-24" 
                       />
                    </div>
                    <div>
                       <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Cycle</p>
                       <select 
                        value={selectedTier.billingCycle} 
                        onChange={e => updateTierField('billingCycle', e.target.value)}
                        className="bg-transparent text-[10px] font-black text-seafoam uppercase outline-none"
                       >
                         <option>MONTHLY</option>
                         <option>YEARLY</option>
                       </select>
                    </div>
                 </div>
              </div>

              <div className="space-y-8">
                 <h4 className="text-[10px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-[0.2em]">Capability Matrix</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableFeatures.map(feature => {
                      const isActive = selectedTier.features.includes(feature.id);
                      return (
                        <button
                          key={feature.id}
                          onClick={() => toggleFeature(feature.id)}
                          className={`flex items-center gap-6 p-6 rounded-[2rem] border-2 transition-all group text-left ${
                            isActive 
                              ? 'border-seafoam bg-seafoam/5 shadow-inner' 
                              : 'border-slate-50 dark:border-zinc-800 hover:border-slate-100 dark:hover:border-zinc-700'
                          }`}
                        >
                          <div className={`p-4 rounded-2xl transition-all ${
                            isActive 
                              ? 'bg-seafoam text-white shadow-lg shadow-seafoam/20' 
                              : 'bg-slate-50 dark:bg-zinc-950 text-slate-300 dark:text-zinc-800 border border-slate-100 dark:border-zinc-900'
                          }`}>
                            <feature.icon size={24} />
                          </div>
                          <div className="flex-1">
                             <p className={`text-xs font-black uppercase tracking-widest ${isActive ? 'text-pine dark:text-zinc-100' : 'text-slate-400 dark:text-zinc-600'}`}>{feature.label}</p>
                             <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-tighter">{feature.category}</p>
                          </div>
                          {isActive && <div className="w-8 h-8 rounded-full bg-seafoam/10 text-seafoam flex items-center justify-center"><Check size={16}/></div>}
                        </button>
                      );
                    })}
                 </div>
              </div>

              <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-zinc-800">
                 <h4 className="text-[8px] font-black text-slate-400 dark:text-zinc-600 uppercase tracking-[0.2em]">Scale Thresholds</h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { id: 'patients', label: 'Patient Limit', icon: Box, unit: 'patients' },
                      // Fix: Imported 'Users' from lucide-react above to resolve the error on this line.
                      { id: 'staff', label: 'Staff Capacity', icon: Users, unit: 'Seats' },
                      { id: 'storageGb', label: 'Bio-Archive Storage', icon: Layout, unit: 'GB' },
                    ].map(limit => (
                      <div key={limit.id} className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-900 space-y-3">
                         <div className="flex items-center gap-2 text-slate-400 dark:text-zinc-600">
                            <limit.icon size={14}/>
                            <span className="text-[8px] font-black uppercase tracking-widest">{limit.label}</span>
                         </div>
                         <div className="flex items-baseline gap-2">
                            <input
                              type="number"
                              value={(selectedTier.limits as any)[limit.id]}
                              onChange={e => updateTierField('limits', { ...selectedTier.limits, [limit.id]: Number(e.target.value) })}
                              className="bg-transparent text-2xl font-black text-pine dark:text-zinc-100 font-mono outline-none w-full"
                            />
                            <span className="text-[10px] font-black text-slate-400 uppercase">{limit.unit}</span>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="pt-6 flex justify-end">
                 <button className="flex items-center gap-3 bg-pine dark:bg-zinc-100 text-white dark:text-pine px-12 py-5 rounded-[1.75rem] font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all">
                    Save Plan
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default BillingTiersView;
