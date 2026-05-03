import React, { useEffect, useState } from 'react';
import { Check, Star, Building2, Truck, UserCog, Loader2 } from 'lucide-react';
import ClinicLogo from './ClinicLogo';
import { useClinic } from '../contexts/ClinicContext';
import { suppliersAPI } from '../services';
import apiClient from '../services/api/client';

interface ClinicSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabKey = 'clinics' | 'suppliers' | 'freelancers';

interface SupplierEntry {
  id: string;
  name: string;
  category?: string;
  rating?: number;
}

interface FreelancerEntry {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

const STORAGE_KEYS = {
  suppliers: 'selectedSupplierIds',
  freelancers: 'selectedFreelancerIds',
};

const readSelection = (key: string): string[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const writeSelection = (key: string, ids: string[]) => {
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch {}
};

const ClinicSwitcherModal: React.FC<ClinicSwitcherModalProps> = ({ isOpen, onClose }) => {
  const { clinics, selectedClinicIds, toggleClinic } = useClinic();
  const [tab, setTab] = useState<TabKey>('clinics');

  const [suppliers, setSuppliers] = useState<SupplierEntry[]>([]);
  const [freelancers, setFreelancers] = useState<FreelancerEntry[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingFreelancers, setLoadingFreelancers] = useState(false);

  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>(() => readSelection(STORAGE_KEYS.suppliers));
  const [selectedFreelancerIds, setSelectedFreelancerIds] = useState<string[]>(() => readSelection(STORAGE_KEYS.freelancers));

  // Load tab data lazily on first activation.
  useEffect(() => {
    if (!isOpen) return;
    if (tab === 'suppliers' && suppliers.length === 0 && !loadingSuppliers) {
      setLoadingSuppliers(true);
      suppliersAPI.getAll({ page: 1, limit: 100 })
        .then((res: any) => {
          const items = (res?.data?.data ?? res?.data?.suppliers ?? []) as any[];
          setSuppliers(items.map(s => ({
            id: String(s.id),
            name: s.name,
            category: s.category,
            rating: s.rating,
          })));
        })
        .catch(() => {})
        .finally(() => setLoadingSuppliers(false));
    }
    if (tab === 'freelancers' && freelancers.length === 0 && !loadingFreelancers) {
      setLoadingFreelancers(true);
      apiClient.get('/users/freelancers/all')
        .then((res: any) => {
          const items = (res?.data?.freelancers ?? []) as any[];
          setFreelancers(items.map(f => ({
            id: String(f.id),
            name: [f.profile?.firstName, f.profile?.surname].filter(Boolean).join(' ') || f.email || `Freelancer ${f.id}`,
            email: f.email,
            role: f.role,
          })));
        })
        .catch(() => {})
        .finally(() => setLoadingFreelancers(false));
    }
  }, [isOpen, tab, suppliers.length, freelancers.length, loadingSuppliers, loadingFreelancers]);

  if (!isOpen) return null;

  const toggleSupplier = (id: string) => {
    const next = selectedSupplierIds.includes(id)
      ? selectedSupplierIds.filter(x => x !== id)
      : [...selectedSupplierIds, id];
    setSelectedSupplierIds(next);
    writeSelection(STORAGE_KEYS.suppliers, next);
  };

  const toggleFreelancer = (id: string) => {
    const next = selectedFreelancerIds.includes(id)
      ? selectedFreelancerIds.filter(x => x !== id)
      : [...selectedFreelancerIds, id];
    setSelectedFreelancerIds(next);
    writeSelection(STORAGE_KEYS.freelancers, next);
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'clinics', label: 'Clinics', icon: <Building2 size={14} />, count: clinics.length },
    { key: 'suppliers', label: 'Suppliers', icon: <Truck size={14} />, count: suppliers.length },
    { key: 'freelancers', label: 'Freelancers', icon: <UserCog size={14} />, count: freelancers.length },
  ];

  return (
    <div className="fixed inset-0 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-2xl z-[1000] flex flex-col items-center justify-center p-8 overflow-y-auto animate-in fade-in duration-300">
      <div className="max-w-6xl w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <h2 className="text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">
            Switch Context
          </h2>
          <p className="text-seafoam text-[10px] font-black uppercase tracking-[0.4em]">
            Select the entities you want to work with
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center">
          <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
            {tabs.map(t => {
              const isActive = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-4 sm:px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm border border-slate-200 dark:border-zinc-700'
                      : 'text-slate-400 hover:text-pine'
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                  {t.count > 0 && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-seafoam/20 text-seafoam' : 'bg-slate-200 dark:bg-zinc-700 text-slate-500'}`}>
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {tab === 'clinics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-6">
            {clinics.map((c) => {
              const isActive = selectedClinicIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleClinic(c.id)}
                  className={`relative p-6 rounded-xl border-3 transition-all hover:scale-105 active:scale-95 group text-left ${
                    isActive
                      ? 'bg-white dark:bg-zinc-900 border-seafoam shadow-xl'
                      : 'bg-white/5 border-slate-200 dark:border-zinc-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg overflow-hidden ${
                      isActive ? 'bg-seafoam text-white' : 'bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100'
                    }`}>
                      <ClinicLogo logo={c.logo} fallback="🐾" />
                    </div>
                    {isActive && (
                      <div className="p-2 bg-seafoam rounded-lg text-white shadow-md shadow-seafoam/20">
                        <Check size={16} />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h3 className={`text-xl font-black uppercase tracking-tight ${isActive ? 'text-pine dark:text-zinc-100' : 'text-slate-400'}`}>
                      {c.name}
                    </h3>
                    <p className={`text-[9px] font-bold uppercase tracking-widest ${isActive ? 'text-seafoam' : 'text-slate-400'}`}>
                      {c.subdomain}.vethub.com
                    </p>
                  </div>

                  {(c.balance !== undefined || c.rating !== undefined) && (
                    <div className="mt-8 pt-6 border-t border-dashed border-slate-200 dark:border-zinc-800">
                      <div className="flex justify-between items-end">
                        {c.balance !== undefined && (
                          <div>
                            <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isActive ? 'text-slate-400' : 'text-slate-500'}`}>
                              Revenue
                            </p>
                            <p className={`text-xl font-black font-mono ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {c.currency || 'KES'} {c.balance.toLocaleString()}
                            </p>
                          </div>
                        )}
                        {c.rating !== undefined && (
                          <div className={`flex items-center gap-1 text-[10px] font-black ${isActive ? 'text-amber-500' : 'text-slate-300'}`}>
                            <Star size={12} fill="currentColor" />
                            {c.rating}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {tab === 'suppliers' && (
          <div className="px-6">
            {loadingSuppliers ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <Loader2 size={20} className="animate-spin mr-2" /> Loading suppliers…
              </div>
            ) : suppliers.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                No suppliers available
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {suppliers.map(s => {
                  const isActive = selectedSupplierIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleSupplier(s.id)}
                      className={`relative p-5 rounded-xl border-2 transition-all hover:scale-105 active:scale-95 text-left ${
                        isActive
                          ? 'bg-white dark:bg-zinc-900 border-seafoam shadow-xl'
                          : 'bg-white/5 border-slate-200 dark:border-zinc-800 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isActive ? 'bg-seafoam text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}>
                          <Truck size={18} />
                        </div>
                        {isActive && (
                          <div className="p-1.5 bg-seafoam rounded-lg text-white">
                            <Check size={14} />
                          </div>
                        )}
                      </div>
                      <h3 className={`text-sm font-black uppercase tracking-tight ${isActive ? 'text-pine dark:text-zinc-100' : 'text-slate-400'}`}>
                        {s.name}
                      </h3>
                      {s.category && (
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                          {s.category}
                        </p>
                      )}
                      {s.rating !== undefined && (
                        <div className="flex items-center gap-1 text-[10px] font-black text-amber-500 mt-3">
                          <Star size={11} fill="currentColor" /> {s.rating}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'freelancers' && (
          <div className="px-6">
            {loadingFreelancers ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <Loader2 size={20} className="animate-spin mr-2" /> Loading freelancers…
              </div>
            ) : freelancers.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                No freelancers available
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {freelancers.map(f => {
                  const isActive = selectedFreelancerIds.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => toggleFreelancer(f.id)}
                      className={`relative p-5 rounded-xl border-2 transition-all hover:scale-105 active:scale-95 text-left ${
                        isActive
                          ? 'bg-white dark:bg-zinc-900 border-seafoam shadow-xl'
                          : 'bg-white/5 border-slate-200 dark:border-zinc-800 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isActive ? 'bg-seafoam text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}>
                          <UserCog size={18} />
                        </div>
                        {isActive && (
                          <div className="p-1.5 bg-seafoam rounded-lg text-white">
                            <Check size={14} />
                          </div>
                        )}
                      </div>
                      <h3 className={`text-sm font-black uppercase tracking-tight ${isActive ? 'text-pine dark:text-zinc-100' : 'text-slate-400'}`}>
                        {f.name}
                      </h3>
                      {f.email && (
                        <p className="text-[9px] font-bold tracking-tight text-slate-400 mt-1 truncate">
                          {f.email}
                        </p>
                      )}
                      {f.role && (
                        <p className="text-[8px] font-black uppercase tracking-widest text-seafoam mt-2">
                          {f.role.replace(/_/g, ' ')}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Apply Button — close the modal AND hard-refresh so every page
            re-fetches with the freshly-applied X-Clinic-Ids /
            X-Supplier-Ids / X-Freelancer-Ids headers. The reload is
            deliberate: it's the simplest guarantee that no stale
            in-memory cache from the previous selection lingers. */}
        <div className="flex justify-center">
          <button
            onClick={() => {
              onClose();
              if (typeof window !== 'undefined') window.location.reload();
            }}
            className="compact-button bg-seafoam hover:bg-seafoam/80 text-white shadow-xl transition-all"
          >
            Apply Session Matrix
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClinicSwitcherModal;
