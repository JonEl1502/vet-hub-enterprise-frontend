import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Search, Mail, Building2, Shield, KeyRound, X, Eye, EyeOff } from 'lucide-react';
import { usersAPI, clinicsAPI, toast } from '../../../services';
import type { AdminUserRow as ApiUser } from '../../../services/modules/users.api';
import { useAuth } from '../../../contexts/AuthContext';
import StatusToggle from '../../shared/common/StatusToggle';
import LoadingSpinner from '../../shared/common/LoadingSpinner';

const ROLE_OPTIONS = [
  'ALL', 'SUPER_ADMIN', 'MERCHANT_ADMIN', 'CLINIC_OWNER', 'CLINIC_MANAGER',
  'CLINIC_VIEWER', 'VET', 'STAFF', 'FREELANCER', 'SUPPLIER',
];

const roleBadge = (role: string) => {
  const base = 'px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ';
  switch (role) {
    case 'SUPER_ADMIN':
    case 'MERCHANT_ADMIN': return base + 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    case 'CLINIC_OWNER': return base + 'bg-seafoam/10 text-seafoam border-seafoam/20';
    case 'CLINIC_MANAGER': return base + 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20';
    case 'VET': return base + 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
    case 'FREELANCER': return base + 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'SUPPLIER': return base + 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    default: return base + 'bg-slate-500/10 text-slate-500 border-slate-200';
  }
};

const AdminUsersPage: React.FC<{ onNavigate?: (view: string, params?: any) => void }> = () => {
  const { user } = useAuth();
  const currentUserId = user ? Number(user.id) : undefined;

  const [users, setUsers] = useState<ApiUser[]>([]);
  const [clinics, setClinics] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const [search, setSearch] = useState('');
  const [clinicId, setClinicId] = useState<string>('');
  const [role, setRole] = useState<string>('ALL');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Set-password modal state
  const [pwUser, setPwUser] = useState<ApiUser | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [pwShow, setPwShow] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const submitPassword = async () => {
    if (!pwUser) return;
    if (pwValue.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setPwSaving(true);
    try {
      const res = await usersAPI.setPassword(pwUser.id, pwValue);
      if (res.success) {
        toast.success(`Password updated for ${pwUser.name || pwUser.email}`);
        setPwUser(null); setPwValue(''); setPwShow(false);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to set password');
    } finally {
      setPwSaving(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await usersAPI.adminList({
        search: search.trim() || undefined,
        clinicId: clinicId || undefined,
        role: role !== 'ALL' ? role : undefined,
        status: status !== 'all' ? status : undefined,
      });
      if (res.success && res.data?.users) setUsers(res.data.users);
      else setError('Could not load users.');
    } catch (e: any) {
      setError(e?.message || 'Could not load users.');
    } finally {
      setLoading(false);
    }
  };

  // Reload whenever a filter changes (search is debounced).
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, clinicId, role, status]);

  useEffect(() => {
    clinicsAPI.getAll()
      .then((res: any) => {
        const c = (res?.data?.clinics ?? res?.clinics ?? []).map((x: any) => ({ id: String(x.id), name: x.name }));
        setClinics(c);
      })
      .catch(() => {});
  }, []);

  const clinicName = useMemo(() => {
    const map = new Map(clinics.map(c => [c.id, c.name]));
    return (id: string) => map.get(id) || `#${id}`;
  }, [clinics]);

  const toggleStatus = async (u: ApiUser, next: boolean) => {
    setSavingId(u.id);
    try {
      await usersAPI.update(u.id, { isActive: next } as any);
      toast.success(next ? 'User activated' : 'User deactivated');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update status');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pt-6 pb-20 px-4 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between py-4 mb-4 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">Users</h1>
          <p className="text-seafoam dark:text-zinc-400 font-bold text-[10px] uppercase tracking-widest mt-1">
            Every account across VetHubCore — activate or deactivate access
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

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
        <div className="relative md:col-span-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-seafoam" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or email..."
            className="field-input w-full pl-9"
          />
        </div>
        <select value={clinicId} onChange={e => setClinicId(e.target.value)} className="field-select">
          <option value="">All clinics</option>
          {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={role} onChange={e => setRole(e.target.value)} className="field-select">
          {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r === 'ALL' ? 'All roles' : r.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {/* Status segmented filter */}
      <div className="inline-flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800 mb-4">
        {(['all', 'active', 'inactive'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${status === s ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-md' : 'text-slate-400 hover:text-pine'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <div className="p-3 mb-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold">{error}</div>}

      {loading && users.length === 0 ? (
        <LoadingSpinner contentArea message="Loading..." />
      ) : users.length === 0 ? (
        <div className="py-16 text-center text-sm font-bold text-slate-500">No users match these filters.</div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img src={(u as any).avatar || u.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.email}`} alt="" className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-pine dark:text-zinc-100 truncate">{u.name || u.email}</h3>
                    <span className={roleBadge(u.role)}>{u.role.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1"><Mail size={10} /> {u.email}</span>
                    {(u.clinicIds?.length ?? 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <Building2 size={10} />
                        {(u.clinicIds || []).slice(0, 2).map(clinicName).join(', ')}
                        {(u.clinicIds?.length ?? 0) > 2 ? ` +${(u.clinicIds!.length - 2)}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <button
                  onClick={() => { setPwUser(u); setPwValue(''); setPwShow(false); }}
                  title="Set password"
                  className="p-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-pine dark:hover:text-zinc-100 hover:border-pine/40 transition-colors"
                >
                  <KeyRound size={14} />
                </button>
                {u.id === currentUserId ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-400">
                    <Shield size={11} /> You
                  </span>
                ) : (
                  <StatusToggle
                    isActive={u.isActive}
                    entityName={u.name || u.email}
                    entityKind="user"
                    disabled={savingId === u.id}
                    onToggle={(next) => toggleStatus(u, next)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Set-password modal */}
      {pwUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPwUser(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pine/10 dark:bg-pine/20 flex items-center justify-center text-pine dark:text-seafoam"><KeyRound size={18} /></div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black text-pine dark:text-zinc-100">Set password</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{pwUser.name || pwUser.email}</p>
              </div>
              <button onClick={() => setPwUser(null)} className="text-slate-400 hover:text-pine dark:hover:text-zinc-100"><X size={16} /></button>
            </div>
            <div>
              <label className="field-label">New password</label>
              <div className="relative">
                <input
                  type={pwShow ? 'text' : 'password'}
                  value={pwValue}
                  onChange={(e) => setPwValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitPassword(); }}
                  placeholder="At least 6 characters"
                  autoFocus
                  className="field-input pr-10"
                />
                <button type="button" onClick={() => setPwShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pine dark:hover:text-zinc-200">
                  {pwShow ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="field-help">The user signs in with this password immediately. It stays valid until changed.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPwUser(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800">Cancel</button>
              <button onClick={submitPassword} disabled={pwSaving || pwValue.length < 6} className="flex-1 py-2.5 rounded-xl bg-pine text-white text-xs font-black uppercase tracking-widest hover:opacity-95 disabled:opacity-50">
                {pwSaving ? 'Saving…' : 'Set password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;
