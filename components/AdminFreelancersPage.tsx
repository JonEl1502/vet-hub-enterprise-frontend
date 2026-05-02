import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Building2, RefreshCw, Plus, X, Mail, Phone } from 'lucide-react';
import apiClient from '../services/api/client';
import { clinicsAPI, toast } from '../services';

interface Freelancer {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  profile: { firstName?: string; secondName?: string | null; surname?: string; phone?: string | null; avatarUrl?: string | null } | null;
  clinics: Array<{ id: string; name: string; clinicRole?: string | null }>;
}

const AdminFreelancersPage: React.FC<{ onNavigate?: (view: string, params?: any) => void }> = () => {
  const [list, setList] = useState<Freelancer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [allClinics, setAllClinics] = useState<Array<{ id: string; name: string }>>([]);
  const [assignFor, setAssignFor] = useState<Freelancer | null>(null);
  const [pickedClinic, setPickedClinic] = useState<string>('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await apiClient.get('/users/freelancers/all');
      const items = res?.data?.freelancers ?? [];
      setList(items);
    } catch (e: any) {
      setError(e?.message || 'Failed to load freelancers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    clinicsAPI.getAll()
      .then((res: any) => {
        const c = (res?.data?.clinics ?? res?.clinics ?? []).map((x: any) => ({ id: String(x.id), name: x.name }));
        setAllClinics(c);
      })
      .catch(() => {});
  }, []);

  const filteredAvailableClinics = useMemo(() => {
    if (!assignFor) return [];
    const owned = new Set(assignFor.clinics.map((c) => c.id));
    return allClinics.filter((c) => !owned.has(c.id));
  }, [assignFor, allClinics]);

  const assign = async () => {
    if (!assignFor || !pickedClinic) return;
    setSavingId(assignFor.id);
    try {
      await apiClient.post(`/users/freelancers/${assignFor.id}/assign`, { clinicId: pickedClinic });
      toast.success('Freelancer assigned');
      setAssignFor(null);
      setPickedClinic('');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Assignment failed');
    } finally {
      setSavingId(null);
    }
  };

  const unassign = async (userId: string, clinicId: string) => {
    if (!confirm('Detach this freelancer from the clinic?')) return;
    setSavingId(userId);
    try {
      await apiClient.post(`/users/freelancers/${userId}/unassign`, { clinicId });
      toast.success('Detached');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Detach failed');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <header className="flex items-center justify-between py-2 mb-3 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">Freelancers</h1>
          <p className="text-seafoam dark:text-zinc-400 font-bold text-[10px] uppercase tracking-widest mt-0.5">
            VetHub-wide registered freelancers and their clinic assignments
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="compact-button bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-pine dark:text-zinc-100 flex items-center gap-1.5"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Reload
        </button>
      </header>

      {error && <div className="p-3 mb-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold">{error}</div>}

      {loading && list.length === 0 ? (
        <div className="py-16 text-center"><Loader2 className="animate-spin text-seafoam mx-auto" size={28} /></div>
      ) : list.length === 0 ? (
        <div className="py-16 text-center text-sm font-bold text-slate-500">No freelancers registered yet.</div>
      ) : (
        <div className="space-y-2">
          {list.map((f) => {
            const fullName = [f.profile?.firstName, f.profile?.secondName, f.profile?.surname].filter(Boolean).join(' ') || f.email;
            return (
              <div key={f.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-pine dark:text-zinc-100 truncate">{fullName}</h3>
                    {!f.isActive && <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest">inactive</span>}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1"><Mail size={10} /> {f.email}</span>
                    {f.profile?.phone && <span className="flex items-center gap-1"><Phone size={10} /> {f.profile.phone}</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {f.clinics.length === 0 && (
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">unassigned</span>
                    )}
                    {f.clinics.map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 text-[10px] font-bold uppercase tracking-widest"
                      >
                        <Building2 size={9} /> {c.name}
                        <button
                          onClick={() => unassign(f.id, c.id)}
                          disabled={savingId === f.id}
                          className="ml-1 hover:text-red-500"
                          title="Detach"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => { setAssignFor(f); setPickedClinic(''); }}
                  className="compact-button bg-pine text-white flex items-center gap-1 shrink-0"
                >
                  <Plus size={11} /> Assign
                </button>
              </div>
            );
          })}
        </div>
      )}

      {assignFor && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-zinc-800">
              <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-wider">Assign to clinic</h2>
              <button onClick={() => setAssignFor(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X size={14} className="text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-500">
                Freelancer: <span className="font-bold text-pine dark:text-zinc-100">{[assignFor.profile?.firstName, assignFor.profile?.surname].filter(Boolean).join(' ') || assignFor.email}</span>
              </p>
              <div>
                <label className="field-label">Clinic</label>
                <select className="field-select" value={pickedClinic} onChange={(e) => setPickedClinic(e.target.value)}>
                  <option value="">Select a clinic</option>
                  {filteredAvailableClinics.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
              <button onClick={() => setAssignFor(null)} className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-700">Cancel</button>
              <button
                onClick={assign}
                disabled={!pickedClinic || savingId !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest bg-pine text-white disabled:opacity-40"
              >
                {savingId !== null ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFreelancersPage;
