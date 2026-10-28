import React, { useEffect, useMemo, useState } from 'react';
import {
  Loader2, Building2, RefreshCw, Plus, X, Mail, Phone, UserCog, Layers, UserRound,
  CheckCircle, XCircle, Link2, Unlink, BarChart3, LayoutGrid, Search, KeyRound, Copy, ChevronRight,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import apiClient from '../../../services/api/client';
import EntityScopeDropdown, { ScopeItem } from '../../shared/common/EntityScopeDropdown';
import { clinicsAPI, usersAPI, freelancerCategoriesAPI, toast, dialog, type FreelancerCategory } from '../../../services';
import StatusToggle from '../../shared/common/StatusToggle';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import AdminPageHeader from '../shared/AdminPageHeader';

interface Freelancer {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt?: string;
  profile: { firstName?: string; secondName?: string | null; surname?: string; phone?: string | null; avatarUrl?: string | null } | null;
  clinics: Array<{ id: string; name: string; clinicRole?: string | null }>;
  categories?: Array<{ id: string; name: string }>;
}

type Drill = 'all' | 'active' | 'inactive' | 'assigned' | 'unassigned';

const nameOf = (f: Freelancer) =>
  [f.profile?.firstName, f.profile?.secondName, f.profile?.surname].filter(Boolean).join(' ') || f.email;

// Readable, no look-alike characters (0/O, 1/l) — the admin reads it out to
// the freelancer once, who changes it on first login.
const makePassword = () => {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 10 }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
};

const CHART_COLORS = ['#1C7A5B', '#6366F1', '#F59E0B', '#06B6D4', '#EC4899', '#84CC16', '#8B5CF6', '#F97316'];

/**
 * Tenants → Freelancers (user, 2026-10-28: "finish the freelancer ui n admin
 * view"). Same shape as Clinics and Suppliers: KPI tiles, a search dropdown,
 * Charts | Directory, and an Add button — the page had no way to create a
 * freelancer at all, which is why the list was always empty.
 */
const AdminFreelancersPage: React.FC<{ onNavigate?: (view: string, params?: any) => void }> = ({ onNavigate }) => {
  const [list, setList] = useState<Freelancer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [allClinics, setAllClinics] = useState<Array<{ id: string; name: string }>>([]);
  const [assignFor, setAssignFor] = useState<Freelancer | null>(null);
  const [pickedClinic, setPickedClinic] = useState<string>('');
  const [allCategories, setAllCategories] = useState<FreelancerCategory[]>([]);
  const [catsFor, setCatsFor] = useState<Freelancer | null>(null);
  const [pickedCatIds, setPickedCatIds] = useState<string[]>([]);
  const [tab, setTab] = useState<'charts' | 'directory'>('directory');
  const [drill, setDrill] = useState<Drill>('all');
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string>('');
  const [addOpen, setAddOpen] = useState(false);

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
    freelancerCategoriesAPI.list()
      .then((res) => { if (res.success && res.data?.categories) setAllCategories(res.data.categories); })
      .catch(() => {});
  }, []);

  const openCats = (f: Freelancer) => {
    setCatsFor(f);
    setPickedCatIds((f.categories || []).map(c => c.id));
  };

  const saveCats = async () => {
    if (!catsFor) return;
    setSavingId(catsFor.id);
    try {
      await usersAPI.update(Number(catsFor.id), { freelancerCategoryIds: pickedCatIds } as any);
      toast.success('Services updated');
      setCatsFor(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update services');
    } finally {
      setSavingId(null);
    }
  };

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

  const toggleStatus = async (f: Freelancer, next: boolean) => {
    setSavingId(f.id);
    try {
      await usersAPI.update(Number(f.id), { isActive: next } as any);
      toast.success(next ? 'Freelancer activated' : 'Freelancer deactivated');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update status');
    } finally {
      setSavingId(null);
    }
  };

  const unassign = async (userId: string, clinicId: string) => {
    const ok = await dialog.confirm({
      title: 'Detach freelancer?',
      message: 'They will lose access to this clinic. You can re-attach them later.',
      confirmLabel: 'Detach',
      variant: 'warning',
    });
    if (!ok) return;
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

  // Scope items for the dropdown — pick one and the whole app re-scopes
  // (X-Freelancer-Ids header) to that freelancer; "All" clears the scope.
  const scopeItems: ScopeItem[] = useMemo(
    () => list.map(f => ({
      id: String(f.id),
      name: nameOf(f),
      subtitle: [f.email, (f.categories || []).map(c => c.name).join(', ')].filter(Boolean).join(' · ') || undefined,
    })),
    [list],
  );

  const stats = useMemo(() => {
    const active = list.filter(f => f.isActive).length;
    const assigned = list.filter(f => f.clinics.length > 0).length;
    return {
      total: list.length,
      active,
      inactive: list.length - active,
      assigned,
      unassigned: list.length - assigned,
      services: allCategories.filter(c => c.isActive).length,
    };
  }, [list, allCategories]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list
      .filter(f => drill === 'all' ? true
        : drill === 'active' ? f.isActive
        : drill === 'inactive' ? !f.isActive
        : drill === 'assigned' ? f.clinics.length > 0
        : f.clinics.length === 0)
      .filter(f => !catFilter || (f.categories || []).some(c => c.id === catFilter))
      .filter(f => !q || `${nameOf(f)} ${f.email} ${f.profile?.phone ?? ''} ${(f.categories || []).map(c => c.name).join(' ')} ${f.clinics.map(c => c.name).join(' ')}`
        .toLowerCase().includes(q));
  }, [list, drill, query, catFilter]);

  // Chart data, all derived from the list already loaded — no extra endpoint.
  const byService = useMemo(() => {
    const m = new Map<string, number>();
    list.forEach(f => {
      const cats = f.categories || [];
      if (cats.length === 0) m.set('No service set', (m.get('No service set') ?? 0) + 1);
      cats.forEach(c => m.set(c.name, (m.get(c.name) ?? 0) + 1));
    });
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [list]);

  const byMonth = useMemo(() => {
    const m = new Map<string, number>();
    list.forEach(f => {
      if (!f.createdAt) return;
      const k = f.createdAt.slice(0, 7);
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, joined]) => ({ period, joined }));
  }, [list]);

  const byClinic = useMemo(() => {
    const m = new Map<string, number>();
    list.forEach(f => f.clinics.forEach(c => m.set(c.name, (m.get(c.name) ?? 0) + 1)));
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [list]);

  const tiles: Array<{ key: Drill | null; label: string; value: number; icon: React.ElementType; tone: string }> = [
    { key: 'all', label: 'Total', value: stats.total, icon: UserRound, tone: 'text-blue-500 bg-blue-500/10' },
    { key: 'active', label: 'Active', value: stats.active, icon: CheckCircle, tone: 'text-green-500 bg-green-500/10' },
    { key: 'inactive', label: 'Inactive', value: stats.inactive, icon: XCircle, tone: 'text-red-500 bg-red-500/10' },
    { key: 'assigned', label: 'Working with clinics', value: stats.assigned, icon: Link2, tone: 'text-cyan-500 bg-cyan-500/10' },
    { key: 'unassigned', label: 'Independent', value: stats.unassigned, icon: Unlink, tone: 'text-amber-500 bg-amber-500/10' },
    { key: null, label: 'Services offered', value: stats.services, icon: Layers, tone: 'text-fuchsia-500 bg-fuchsia-500/10' },
  ];

  return (
    <div className="space-y-5 pb-20">
      <AdminPageHeader
        title="Freelancers"
        subtitle="Dog walkers, groomers and independent vets — who they are, what they offer and where they work."
        icon={UserRound}
        actions={(
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {list.length > 1 && (
              <EntityScopeDropdown
                label="Freelancer"
                items={scopeItems}
                loading={loading}
                storageKey="selectedFreelancerIds"
                icon={<UserCog size={12} className="text-seafoam shrink-0" />}
                className="w-full sm:w-72"
              />
            )}
            <button
              onClick={load}
              disabled={loading}
              title="Reload"
              className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-seafoam hover:border-seafoam transition-all"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="bg-pine dark:bg-zinc-100 text-white dark:text-pine px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
            >
              <Plus size={18} /> Add Freelancer
            </button>
          </div>
        )}
      />

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold">{error}</div>}

      {/* KPI tiles — the list-backed ones filter the directory below. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map(t => {
          const on = t.key !== null && drill === t.key && tab === 'directory';
          const inner = (
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.tone}`}>
                <t.icon size={20} />
              </div>
              <div className="min-w-0 text-left">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 truncate">{t.label}</p>
                <p className="text-xl font-black text-pine dark:text-zinc-100">{loading && list.length === 0 ? '—' : t.value.toLocaleString()}</p>
              </div>
            </div>
          );
          return t.key === null ? (
            <button key={t.label} type="button" onClick={() => onNavigate?.('freelancer-categories')}
              title="Manage the services freelancers can offer"
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 transition-all hover:border-seafoam">
              {inner}
            </button>
          ) : (
            <button key={t.label} type="button"
              onClick={() => { setTab('directory'); setDrill(t.key as Drill); }}
              className={`bg-white dark:bg-zinc-900 border rounded-2xl p-4 transition-all hover:border-seafoam active:scale-[0.98] ${on ? 'border-seafoam' : 'border-slate-200 dark:border-zinc-800'}`}>
              {inner}
            </button>
          );
        })}
      </div>

      {/* Charts | Directory — same switch as Clinics */}
      <div className="flex gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 w-max">
        {([['directory', 'Directory', LayoutGrid], ['charts', 'Charts', BarChart3]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${tab === id ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm' : 'text-slate-400 hover:text-pine'}`}>
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {loading && list.length === 0 ? (
        <LoadingSpinner contentArea message="Loading freelancers…" />
      ) : list.length === 0 ? (
        <div className="py-16 px-6 text-center bg-white dark:bg-zinc-900 border border-dashed border-slate-300 dark:border-zinc-700 rounded-2xl">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-seafoam/10 text-seafoam flex items-center justify-center"><UserRound size={26} /></div>
          <p className="text-sm font-black text-pine dark:text-zinc-100">No freelancers yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Add a dog walker, groomer or independent vet. They get their own login, list the services they offer, and can be attached to clinics they work with.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button onClick={() => setAddOpen(true)} className="bg-pine text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
              <Plus size={14} /> Add the first freelancer
            </button>
            <button onClick={() => onNavigate?.('freelancer-categories')} className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-200 dark:border-zinc-700 text-slate-500 hover:border-seafoam hover:text-seafoam flex items-center gap-1.5">
              <Layers size={14} /> Services ({stats.services})
            </button>
          </div>
        </div>
      ) : tab === 'charts' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Freelancers · by service">
            <ResponsiveContainer width="100%" height={Math.max(180, byService.length * 36)}>
              <BarChart data={byService} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                <RTooltip />
                <Bar dataKey="count" fill="#1C7A5B" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Status">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Active · with clinics', value: list.filter(f => f.isActive && f.clinics.length > 0).length },
                    { name: 'Active · independent', value: list.filter(f => f.isActive && f.clinics.length === 0).length },
                    { name: 'Inactive', value: stats.inactive },
                  ].filter(d => d.value > 0)}
                  dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}
                >
                  {CHART_COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <RTooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Joined · by month">
            {byMonth.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} width={30} tick={{ fontSize: 10 }} />
                  <RTooltip />
                  <Bar dataKey="joined" fill="#6366F1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
          <ChartCard title="Clinics using freelancers">
            {byClinic.length === 0 ? <Empty text="No freelancer is attached to a clinic yet" /> : (
              <div className="space-y-2.5">
                {byClinic.map(c => (
                  <div key={c.name}>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1">
                      <span className="text-pine dark:text-zinc-100 truncate">{c.name}</span>
                      <span className="text-slate-400 font-mono ml-2">{c.count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-seafoam rounded-full" style={{ width: `${(c.count / byClinic[0].count) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Search + service filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name, email, phone, service or clinic…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm focus:border-seafoam outline-none"
              />
            </div>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="field-select sm:w-56">
              <option value="">All services</option>
              {allCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            {visible.length} of {list.length}
            {drill !== 'all' && (
              <button onClick={() => setDrill('all')} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-seafoam/10 text-seafoam">
                {tiles.find(t => t.key === drill)?.label} <X size={10} />
              </button>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Nothing matches</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {visible.map((f) => {
                const fullName = nameOf(f);
                const initials = fullName.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <div key={f.id} className={`bg-white dark:bg-zinc-900 border rounded-2xl p-4 flex flex-col gap-3 ${f.isActive ? 'border-slate-200 dark:border-zinc-800' : 'border-dashed border-slate-300 dark:border-zinc-700 opacity-75'}`}>
                    <div className="flex items-start gap-3">
                      {f.profile?.avatarUrl ? (
                        <img src={f.profile.avatarUrl} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-seafoam/10 text-seafoam flex items-center justify-center text-sm font-black shrink-0">{initials}</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black text-pine dark:text-zinc-100 truncate">{fullName}</h3>
                          <StatusToggle
                            isActive={f.isActive}
                            entityName={fullName}
                            entityKind="freelancer"
                            disabled={savingId === f.id}
                            onToggle={(next) => toggleStatus(f, next)}
                          />
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1 truncate"><Mail size={10} /> {f.email}</span>
                          {f.profile?.phone && <span className="flex items-center gap-1"><Phone size={10} /> {f.profile.phone}</span>}
                        </div>
                      </div>
                    </div>

                    {/* What they do */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(f.categories || []).length === 0 ? (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">no services set</span>
                      ) : (f.categories || []).map((c) => (
                        <span key={c.id} className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-widest">{c.name}</span>
                      ))}
                      <button onClick={() => openCats(f)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-slate-300 dark:border-zinc-700 text-slate-500 text-[10px] font-bold uppercase tracking-widest hover:border-seafoam hover:text-seafoam">
                        <Layers size={9} /> Edit services
                      </button>
                    </div>

                    {/* Where they work */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100 dark:border-zinc-800">
                      {f.clinics.length === 0 && (
                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">independent · no clinic</span>
                      )}
                      {f.clinics.map((c) => (
                        <span key={c.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 text-[10px] font-bold uppercase tracking-widest">
                          <button type="button" onClick={() => onNavigate?.('admin-clinic-detail', { clinicId: c.id })} className="inline-flex items-center gap-1 hover:underline">
                            <Building2 size={9} /> {c.name}
                          </button>
                          <button onClick={() => unassign(f.id, c.id)} disabled={savingId === f.id} className="ml-1 hover:text-red-500" title="Detach">
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                      <button onClick={() => { setAssignFor(f); setPickedClinic(''); }}
                        className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pine text-white text-[10px] font-black uppercase tracking-widest">
                        <Plus size={10} /> Attach to clinic <ChevronRight size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {assignFor && (
        <Modal title="Attach to clinic" onClose={() => setAssignFor(null)}
          footer={(
            <button onClick={assign} disabled={!pickedClinic || savingId !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest bg-pine text-white disabled:opacity-40">
              {savingId !== null ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Attach
            </button>
          )}>
          <p className="text-xs text-slate-500">
            Freelancer: <span className="font-bold text-pine dark:text-zinc-100">{nameOf(assignFor)}</span>
          </p>
          <div>
            <label className="field-label">Clinic</label>
            <select className="field-select" value={pickedClinic} onChange={(e) => setPickedClinic(e.target.value)}>
              <option value="">Select a clinic</option>
              {filteredAvailableClinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </Modal>
      )}

      {catsFor && (
        <Modal title="Services offered" onClose={() => setCatsFor(null)}
          footer={(
            <button onClick={saveCats} disabled={savingId !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest bg-pine text-white disabled:opacity-40">
              {savingId !== null ? <Loader2 size={12} className="animate-spin" /> : <Layers size={12} />} Save
            </button>
          )}>
          <p className="text-xs text-slate-500">
            Freelancer: <span className="font-bold text-pine dark:text-zinc-100">{nameOf(catsFor)}</span>
          </p>
          <CategoryPicker categories={allCategories} picked={pickedCatIds} onChange={setPickedCatIds} onManage={() => onNavigate?.('freelancer-categories')} />
        </Modal>
      )}

      {addOpen && (
        <AddFreelancerModal
          categories={allCategories}
          clinics={allClinics}
          onManageCategories={() => onNavigate?.('freelancer-categories')}
          onClose={() => setAddOpen(false)}
          onCreated={async () => { setAddOpen(false); await load(); }}
        />
      )}
    </div>
  );
};

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
    <h3 className="text-sm font-black uppercase tracking-tight text-pine dark:text-zinc-100 mb-4">{title}</h3>
    {children}
  </div>
);

const Empty: React.FC<{ text?: string }> = ({ text = 'No data yet' }) => (
  <p className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">{text}</p>
);

const Modal: React.FC<{ title: string; onClose: () => void; footer: React.ReactNode; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, footer, children, wide }) => (
  <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
    <div className={`bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full overflow-hidden max-h-[90vh] flex flex-col ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-zinc-800">
        <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-wider">{title}</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"><X size={14} className="text-slate-500" /></button>
      </div>
      <div className="p-5 space-y-3 overflow-y-auto">{children}</div>
      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-700">Cancel</button>
        {footer}
      </div>
    </div>
  </div>
);

const CategoryPicker: React.FC<{ categories: FreelancerCategory[]; picked: string[]; onChange: (ids: string[]) => void; onManage?: () => void }> = ({ categories, picked, onChange, onManage }) => {
  const active = categories.filter(c => c.isActive);
  if (active.length === 0) {
    return (
      <p className="text-[11px] text-slate-400">
        No services defined yet.{' '}
        {onManage && <button type="button" onClick={onManage} className="text-seafoam font-bold hover:underline">Add some under Freelancer Categories</button>}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
      {active.map((c) => {
        const on = picked.includes(c.id);
        return (
          <button key={c.id} type="button" title={c.description || undefined}
            onClick={() => onChange(on ? picked.filter(id => id !== c.id) : [...picked, c.id])}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
              on ? 'bg-seafoam text-white border-seafoam shadow-md' : 'bg-slate-50 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700 hover:border-seafoam'
            }`}>
            {c.name}
          </button>
        );
      })}
    </div>
  );
};

/**
 * Creates the FREELANCER login through the ordinary admin user-create path,
 * then sets their services. The password is shown once so the admin can hand
 * it over; createUser marks admin-created accounts email-verified.
 */
const AddFreelancerModal: React.FC<{
  categories: FreelancerCategory[];
  clinics: Array<{ id: string; name: string }>;
  onClose: () => void;
  onCreated: () => void;
  onManageCategories?: () => void;
}> = ({ categories, clinics, onClose, onCreated, onManageCategories }) => {
  const [form, setForm] = useState({ firstName: '', surname: '', email: '', phone: '', password: makePassword(), clinicId: '' });
  const [catIds, setCatIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ email: string; password: string } | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const canSave = form.firstName.trim() && form.surname.trim() && emailOk && form.password.length >= 8 && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      const res: any = await usersAPI.create({
        email: form.email.trim().toLowerCase(),
        firstName: form.firstName.trim(),
        surname: form.surname.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        role: 'FREELANCER',
        clinicIds: form.clinicId ? [form.clinicId] : [],
      } as any, { showError: false } as any);
      const id = res?.data?.user?.id;
      if (!res?.success || !id) throw new Error(res?.message || 'Could not create the freelancer');
      if (catIds.length > 0) {
        await usersAPI.update(Number(id), { freelancerCategoryIds: catIds } as any);
      }
      toast.success('Freelancer added');
      setDone({ email: form.email.trim().toLowerCase(), password: form.password });
    } catch (e: any) {
      toast.error(e?.message || 'Could not create the freelancer');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Modal title="Freelancer added" onClose={onCreated}
        footer={<button onClick={onCreated} className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest bg-pine text-white">Done</button>}>
        <p className="text-xs text-slate-500">Hand these over once. They should change the password after first sign-in.</p>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 font-mono text-sm space-y-1">
          <p>{done.email}</p>
          <p className="flex items-center gap-2"><KeyRound size={12} className="text-seafoam" /> {done.password}</p>
        </div>
        <button type="button"
          onClick={() => { navigator.clipboard?.writeText(`${done.email}\n${done.password}`).then(() => toast.success('Copied')).catch(() => {}); }}
          className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-seafoam">
          <Copy size={11} /> Copy login
        </button>
      </Modal>
    );
  }

  return (
    <Modal title="Add freelancer" wide onClose={onClose}
      footer={(
        <button onClick={save} disabled={!canSave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest bg-pine text-white disabled:opacity-40">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add freelancer
        </button>
      )}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="field-label">First name *</label>
          <input className="field-input" value={form.firstName} onChange={set('firstName')} autoFocus />
        </div>
        <div>
          <label className="field-label">Surname *</label>
          <input className="field-input" value={form.surname} onChange={set('surname')} />
        </div>
        <div>
          <label className="field-label">Email *</label>
          <input className="field-input" type="email" value={form.email} onChange={set('email')} />
          {form.email && !emailOk && <p className="text-[10px] text-red-500 mt-1">Enter a valid email</p>}
        </div>
        <div>
          <label className="field-label">Phone</label>
          <input className="field-input" value={form.phone} onChange={set('phone')} placeholder="+254…" />
        </div>
        <div>
          <label className="field-label">Initial password *</label>
          <div className="flex gap-2">
            <input className="field-input font-mono" value={form.password} onChange={set('password')} />
            <button type="button" onClick={() => setForm(f => ({ ...f, password: makePassword() }))}
              title="Generate another" className="px-3 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-500 hover:text-seafoam hover:border-seafoam">
              <RefreshCw size={13} />
            </button>
          </div>
          {form.password.length > 0 && form.password.length < 8 && <p className="text-[10px] text-red-500 mt-1">At least 8 characters</p>}
        </div>
        <div>
          <label className="field-label">Attach to a clinic (optional)</label>
          <select className="field-select" value={form.clinicId} onChange={set('clinicId')}>
            <option value="">Independent — no clinic</option>
            {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="field-label">Services they offer</label>
        <CategoryPicker categories={categories} picked={catIds} onChange={setCatIds} onManage={onManageCategories} />
      </div>
    </Modal>
  );
};

export default AdminFreelancersPage;
