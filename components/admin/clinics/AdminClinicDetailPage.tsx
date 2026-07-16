import React, { useEffect, useState } from 'react';
import { ArrowLeft, Building2, Edit, Power, UserCheck, Sparkles, Loader2 } from 'lucide-react';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import { clinicsAPI, Clinic, toast, cache } from '../../../services';
import ClinicLogo from '../../clinic/clinic-mgmt/ClinicLogo';
import { useAuth } from '../../../contexts/AuthContext';

// Full-page admin clinic detail — converted from the tabbed modal on the
// Clinics management page so the drill-down is a real navigable page
// (nav key 'admin-clinic-detail', param clinicId).

interface Props {
  clinicId: string | number;
  onBack: () => void;
  onNavigate?: (view: string, params?: any) => void;
}

type Tab = 'overview' | 'users' | 'branches' | 'partners';

const AdminClinicDetailPage: React.FC<Props> = ({ clinicId, onBack, onNavigate }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'MERCHANT_ADMIN';
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [details, setDetails] = useState<{ users: any[]; branches: any[]; partners: any[] } | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  // Status flow — inline confirm card with a branch-scope choice when the
  // clinic has branches (mirrors the list page's chooser).
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [statusScope, setStatusScope] = useState<'this' | 'with-branches'>('this');
  const [statusBusy, setStatusBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setClinic(null); setDetails(null); setTab('overview'); setConfirmStatus(false);
    clinicsAPI.getById(Number(clinicId), { cache: false })
      .then(r => { if (alive && r.success && r.data?.clinic) setClinic(r.data.clinic); })
      .catch(() => {});
    clinicsAPI.adminDetails(Number(clinicId))
      .then(r => { if (alive && r.success && r.data) setDetails(r.data as any); })
      .catch(() => {});
    return () => { alive = false; };
  }, [clinicId]);

  const applyStatus = async () => {
    if (!clinic) return;
    const next = !clinic.isActive;
    setStatusBusy(true);
    try {
      await clinicsAPI.setStatus(Number(clinic.id), next, { scope: (details?.branches.length ?? 0) > 0 ? statusScope : 'this' });
      cache.invalidatePattern('/clinics');
      setClinic({ ...clinic, isActive: next });
      setConfirmStatus(false);
      toast.success(`Clinic ${next ? 'activated' : 'deactivated'}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update status');
    } finally {
      setStatusBusy(false);
    }
  };

  if (!clinic) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-all">
          <ArrowLeft size={13} /> Clinics
        </button>
        <div className="py-20 flex justify-center"><LoadingSpinner contentArea message="Loading clinic…" /></div>
      </div>
    );
  }

  const c: any = clinic;
  const rows: Array<[string, React.ReactNode]> = [
    ['Status', c.isActive ? 'Active' : 'Inactive'],
    ['Email', c.email || '—'],
    ['Phone', c.phone || '—'],
    ['Address', c.address || '—'],
    ['City', c.city || '—'],
    ['Region', c.region || '—'],
    ['Subdomain', c.subdomain || '—'],
    ['Currency', c.currency || '—'],
    ['Rating', c.rating != null ? String(c.rating) : '—'],
    ['Branches', details ? String(details.branches.length) : '…'],
    ['Brought in by', 'referredBy' in c
      ? (c.referredBy
          ? <span className="inline-flex items-center gap-1.5 text-violet-600 dark:text-violet-300">
              <UserCheck size={13} /> {c.referredBy.name}
              {c.referredBy.code && <span className="font-mono text-[11px] opacity-70">· {c.referredBy.code}</span>}
            </span>
          : <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
              <Sparkles size={13} /> Self-registered
            </span>)
      : '—'],
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-all">
        <ArrowLeft size={13} /> Clinics
      </button>

      {/* Header banner */}
      <div className="bg-gradient-to-br from-pine to-pine/90 text-white rounded-2xl p-5 flex flex-wrap items-center gap-4 shadow-lg">
        <div className="w-14 h-14 rounded-2xl bg-white/15 overflow-hidden flex items-center justify-center text-2xl shrink-0">
          {c.logo ? <ClinicLogo logo={c.logo} /> : <Building2 size={28} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white/60 text-[9px] font-black uppercase tracking-widest">Clinic</p>
          <h1 className="text-xl font-black tracking-tight truncate">{c.name}</h1>
          {c.slogan && <p className="text-[11px] text-white/70 italic truncate">"{c.slogan}"</p>}
        </div>
        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${c.isActive ? 'bg-green-400/20 text-green-100' : 'bg-red-400/20 text-red-100'}`}>
          <Power size={12} /> {c.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Main — tabbed detail */}
        <div className="lg:col-span-8 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm">
          <div className="px-5 pt-4 flex flex-wrap gap-1.5 border-b border-slate-100 dark:border-zinc-800 pb-3">
            {([['overview', 'Overview'], ['users', `Users${details ? ` · ${details.users.length}` : ''}`], ['branches', `Branches${details ? ` · ${details.branches.length}` : ''}`], ['partners', `Partners${details ? ` · ${details.partners.length}` : ''}`]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tab === id ? 'bg-pine text-white dark:bg-zinc-100 dark:text-pine' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-pine'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="p-5">
            {tab === 'overview' && (
              <>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  {rows.map(([k, v]) => (
                    <div key={k} className="flex flex-col">
                      <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">{k}</dt>
                      <dd className="text-sm font-bold text-pine dark:text-zinc-100 break-words">{v}</dd>
                    </div>
                  ))}
                </dl>
                {Array.isArray(c.specialties) && c.specialties.length > 0 && (
                  <div className="mt-5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Specialties</p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.specialties.map((s: string) => (
                        <span key={s} className="px-2.5 py-1 rounded-lg bg-seafoam/10 text-seafoam text-[10px] font-black uppercase tracking-wider">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {tab !== 'overview' && !details && (
              <div className="py-10 flex justify-center"><LoadingSpinner contentArea message="Loading…" /></div>
            )}
            {tab === 'users' && details && (
              details.users.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">No users attached to this clinic.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-slate-400 uppercase tracking-wider text-[9px] font-black border-b border-slate-100 dark:border-zinc-800">
                    <th className="py-2 pr-3">Name</th><th className="py-2 px-3">Email</th><th className="py-2 px-3">Role</th><th className="py-2 px-3">Status</th><th className="py-2 pl-3">Joined</th>
                  </tr></thead>
                  <tbody>
                    {details.users.map((u: any) => (
                      <tr key={u.id} className="border-b border-slate-50 dark:border-zinc-800/60">
                        <td className="py-2 pr-3 font-bold text-pine dark:text-zinc-100">{u.name}</td>
                        <td className="py-2 px-3 text-slate-500 dark:text-zinc-400">{u.email}</td>
                        <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-wider">{String(u.role).replace('_', ' ')}</span></td>
                        <td className="py-2 px-3">{u.isActive ? <span className="text-green-600 font-bold">Active</span> : <span className="text-red-500 font-bold">Inactive</span>}</td>
                        <td className="py-2 pl-3 text-slate-400">{u.joinedAt ? new Date(u.joinedAt).toLocaleDateString('en-GB') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>)
            )}
            {tab === 'branches' && details && (
              details.branches.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">This clinic has no branches.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-slate-400 uppercase tracking-wider text-[9px] font-black border-b border-slate-100 dark:border-zinc-800">
                    <th className="py-2 pr-3">Branch</th><th className="py-2 px-3">City</th><th className="py-2 px-3">Subdomain</th><th className="py-2 px-3">Status</th><th className="py-2 pl-3">Created</th>
                  </tr></thead>
                  <tbody>
                    {details.branches.map((b: any) => (
                      <tr key={b.id} className="border-b border-slate-50 dark:border-zinc-800/60">
                        <td className="py-2 pr-3 font-bold text-pine dark:text-zinc-100">{b.name}</td>
                        <td className="py-2 px-3 text-slate-500 dark:text-zinc-400">{[b.city, b.countryCode].filter(Boolean).join(', ') || '—'}</td>
                        <td className="py-2 px-3 font-mono text-slate-500 dark:text-zinc-400">{b.subdomain}</td>
                        <td className="py-2 px-3">{b.isActive ? <span className="text-green-600 font-bold">Active</span> : <span className="text-red-500 font-bold">Inactive</span>}</td>
                        <td className="py-2 pl-3 text-slate-400">{b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-GB') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>)
            )}
            {tab === 'partners' && details && (
              details.partners.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">No partnerships (handshakes) yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-slate-400 uppercase tracking-wider text-[9px] font-black border-b border-slate-100 dark:border-zinc-800">
                    <th className="py-2 pr-3">Partner clinic</th><th className="py-2 px-3">Direction</th><th className="py-2 px-3">Services</th><th className="py-2 px-3">Status</th><th className="py-2 pl-3">Since</th>
                  </tr></thead>
                  <tbody>
                    {details.partners.map((h: any) => (
                      <tr key={`${h.id}-${h.direction}`} className="border-b border-slate-50 dark:border-zinc-800/60">
                        <td className="py-2 pr-3 font-bold text-pine dark:text-zinc-100">{h.partner}{h.partnerCity ? <span className="text-slate-400 font-medium"> · {h.partnerCity}</span> : null}</td>
                        <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${h.direction === 'SENT' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-violet-500/10 text-violet-500'}`}>{h.direction === 'SENT' ? 'Sent' : 'Received'}</span></td>
                        <td className="py-2 px-3 text-slate-500 dark:text-zinc-400">{(h.services || []).join(', ') || '—'}</td>
                        <td className="py-2 px-3"><span className={`font-bold ${h.status === 'ACCEPTED' ? 'text-green-600' : h.status === 'PENDING' ? 'text-amber-600' : 'text-red-500'}`}>{String(h.status).toLowerCase()}</span></td>
                        <td className="py-2 pl-3 text-slate-400">{h.createdAt ? new Date(h.createdAt).toLocaleDateString('en-GB') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>)
            )}
          </div>
        </div>

        {/* Side rail — admin actions */}
        {isAdmin && (
          <div className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm sticky top-4 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</p>
            <button
              onClick={() => onNavigate?.('admin-clinic-edit', { clinicId: String(c.id) })}
              className="w-full px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            >
              <Edit size={14} /> Edit
            </button>
            {!confirmStatus ? (
              <button
                onClick={() => { setStatusScope('this'); setConfirmStatus(true); }}
                className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 ${c.isActive ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600' : 'bg-green-500/10 hover:bg-green-500/20 text-green-600'}`}
              >
                <Power size={14} /> {c.isActive ? 'Deactivate' : 'Activate'}
              </button>
            ) : (
              <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2.5">
                <p className="text-xs font-bold text-pine dark:text-zinc-100">
                  {c.isActive ? 'Deactivate' : 'Activate'} “{c.name}”?
                </p>
                {(details?.branches.length ?? 0) > 0 && (
                  <div className="space-y-1.5">
                    {([['this', 'This clinic only'], ['with-branches', `Also its ${details!.branches.length} branch${details!.branches.length === 1 ? '' : 'es'}`]] as const).map(([v, label]) => (
                      <label key={v} className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-zinc-300 cursor-pointer">
                        <input type="radio" name="status-scope" checked={statusScope === v} onChange={() => setStatusScope(v)} className="accent-seafoam" />
                        {label}
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setConfirmStatus(false)} disabled={statusBusy} className="flex-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 text-[10px] font-black uppercase tracking-widest">Cancel</button>
                  <button onClick={applyStatus} disabled={statusBusy} className={`flex-1 px-3 py-2 rounded-lg text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 ${c.isActive ? 'bg-amber-500' : 'bg-green-600'}`}>
                    {statusBusy ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />} Confirm
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminClinicDetailPage;
