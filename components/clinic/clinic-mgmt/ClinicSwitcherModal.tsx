import React, { useEffect, useState } from 'react';
import { Check, Star, Building2, Truck, UserCog, Loader2, Globe } from 'lucide-react';
import ClinicLogo from './ClinicLogo';
import { useClinic } from '../../../contexts/ClinicContext';
import { useSupplier } from '../../../contexts/SupplierContext';
import { useAuth } from '../../../contexts/AuthContext';
import apiClient from '../../../services/api/client';

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
  // Suppliers + Freelancers are a platform-admin lens. Clinic users
  // (CLINIC_OWNER + clinic staff) only ever see their own clinics +
  // branches via this modal; suppliers/freelancers tabs are hidden for
  // them. The FREELANCER role doesn't reach this component at all —
  // the navbar gate stops the trigger upstream.
  const { user } = useAuth();
  const role = user?.role;
  const isAdmin = role === 'SUPER_ADMIN' || role === 'MERCHANT_ADMIN';
  const { clinics, selectedClinicIds } = useClinic();

  // Draft selections — the modal stages user picks locally and only commits
  // them to localStorage + reload when the "Apply" button is clicked. That
  // keeps mid-pick toggles from spamming API calls with intermediate scopes.
  const [draftClinicIds, setDraftClinicIds] = useState<string[]>(selectedClinicIds);
  useEffect(() => {
    // Re-prime the draft each time the modal opens so it reflects the active
    // selection, not whatever the user was tinkering with last time.
    if (isOpen) setDraftClinicIds(selectedClinicIds);
  }, [isOpen, selectedClinicIds]);
  const toggleDraftClinic = (id: string) => {
    setDraftClinicIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  // Suppliers come from SupplierContext now — same source the sidebar
  // dropdown uses, so the modal and sidebar stay in lockstep.
  const supplierCtx = useSupplier();
  const suppliers: SupplierEntry[] = supplierCtx.suppliers.map((s: any) => ({
    id: String(s.id),
    name: s.name,
    category: s.category,
    rating: s.rating,
  }));
  const selectedSupplierIds = supplierCtx.selectedSupplierIds;
  const loadingSuppliers = supplierCtx.isLoading;

  const [tab, setTab] = useState<TabKey>('clinics');
  // Defensive: if the user lands on a non-clinic tab and loses
  // admin scope mid-session, snap back to clinics.
  useEffect(() => {
    if (!isAdmin && tab !== 'clinics') setTab('clinics');
  }, [isAdmin, tab]);
  const [freelancers, setFreelancers] = useState<FreelancerEntry[]>([]);
  const [loadingFreelancers, setLoadingFreelancers] = useState(false);
  const [selectedFreelancerIds, setSelectedFreelancerIds] = useState<string[]>(() => readSelection(STORAGE_KEYS.freelancers));

  // Freelancers stay lazy — there's no FreelancerContext yet and this
  // modal is the only place that needs the list.
  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, tab, freelancers.length, loadingFreelancers]);

  if (!isOpen) return null;

  const toggleSupplier = (id: string) => {
    supplierCtx.toggleSupplier(id);
  };

  const toggleFreelancer = (id: string) => {
    const next = selectedFreelancerIds.includes(id)
      ? selectedFreelancerIds.filter(x => x !== id)
      : [...selectedFreelancerIds, id];
    setSelectedFreelancerIds(next);
    writeSelection(STORAGE_KEYS.freelancers, next);
  };

  // "All" across every scope is represented as an EMPTY selection so the
  // axios interceptor omits the X-Clinic-Ids / X-Supplier-Ids header. Backend
  // reads a missing header as "all entities the user is allowed to see",
  // which is faster (no IN(...) query) and avoids enumerating branch IDs the
  // user may not have direct userClinics access to.
  const allSuppliersActive = selectedSupplierIds.length === 0;
  const allFreelancersActive = selectedFreelancerIds.length === 0;
  const allClinicsActive = draftClinicIds.length === 0;

  const handleAllSuppliers = () => {
    supplierCtx.selectAllSuppliers();
  };

  const handleAllFreelancers = () => {
    setSelectedFreelancerIds([]);
    writeSelection(STORAGE_KEYS.freelancers, []);
  };

  const handleAllClinics = () => {
    setDraftClinicIds([]);
  };

  const AllTile: React.FC<{
    label: string;
    sublabel: string;
    isActive: boolean;
    onClick: () => void;
  }> = ({ label, sublabel, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`relative p-5 rounded-xl border-2 border-dashed transition-all hover:scale-105 active:scale-95 text-left ${
        isActive
          ? 'bg-seafoam/5 dark:bg-seafoam/10 border-seafoam shadow-xl'
          : 'bg-white/5 border-slate-300 dark:border-zinc-700 opacity-70 hover:opacity-100'
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isActive ? 'bg-seafoam text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}>
          <Globe size={18} />
        </div>
        {isActive && (
          <div className="p-1.5 bg-seafoam rounded-lg text-white">
            <Check size={14} />
          </div>
        )}
      </div>
      <h3 className={`text-sm font-black uppercase tracking-tight ${isActive ? 'text-pine dark:text-zinc-100' : 'text-slate-400'}`}>
        {label}
      </h3>
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">
        {sublabel}
      </p>
    </button>
  );

  // Suppliers + Freelancers tabs are admin-only — clinic users get a
  // single-tab modal scoped to the clinics + branches they belong to.
  const tabs: { key: TabKey; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'clinics', label: 'Clinics', icon: <Building2 size={14} />, count: clinics.length },
    ...(isAdmin ? [
      { key: 'suppliers' as TabKey,   label: 'Suppliers',   icon: <Truck size={14} />,   count: suppliers.length },
      { key: 'freelancers' as TabKey, label: 'Freelancers', icon: <UserCog size={14} />, count: freelancers.length },
    ] : []),
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
            <AllTile
              label="All Clinics"
              sublabel={`${clinics.length} total · select every clinic`}
              isActive={allClinicsActive}
              onClick={handleAllClinics}
            />
            {clinics.map((c) => {
              const isActive = draftClinicIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleDraftClinic(c.id)}
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
                      {c.subdomain}.vethubcore.com
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
                <AllTile
                  label="All Suppliers"
                  sublabel={`${suppliers.length} total · platform-wide view`}
                  isActive={allSuppliersActive}
                  onClick={handleAllSuppliers}
                />
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
                <AllTile
                  label="All Freelancers"
                  sublabel={`${freelancers.length} total · platform-wide view`}
                  isActive={allFreelancersActive}
                  onClick={handleAllFreelancers}
                />
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

        {/* Apply Button — commit the modal's draft selection to localStorage
            and hard-refresh so every page re-fetches with the freshly-applied
            X-Clinic-Ids header. Draft staging means mid-pick toggles never
            triggered API calls; only this commit does. The reload is
            deliberate: it's the simplest guarantee that no stale in-memory
            cache from the previous selection lingers. */}
        <div className="flex justify-center">
          <button
            onClick={() => {
              try {
                // Commit the user's picks verbatim. The backend grants a
                // CLINIC_OWNER / CLINIC_ADMIN access to any child branch
                // under a clinic in their userClinics, so picking the
                // Kikuyu branch actually scopes data to Kikuyu (not the
                // parent). Empty draft → header omitted → backend serves
                // every clinic the user can see.
                const ids = Array.from(new Set(draftClinicIds));
                if (ids.length === 0) {
                  localStorage.removeItem('selectedClinicIds');
                } else {
                  localStorage.setItem('selectedClinicIds', JSON.stringify(ids));
                }
                localStorage.setItem('hasCompletedInitialSelection', 'true');
              } catch {}
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
