import React, { useState, useEffect, useMemo } from 'react';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import {
  Search, Plus, Building2, Mail, Phone, MapPin, Globe,
  Edit, Trash2, X, Eye, EyeOff, DollarSign, Users, CheckCircle, XCircle
} from 'lucide-react';
import { clinicsAPI, Clinic, platformMetricsAPI, type PlatformMetrics } from '../../../services';
import ClinicLogo from '../../clinic/clinic-mgmt/ClinicLogo';
import { toast, dialog, cache } from '../../../services';
import { useAuth } from '../../../contexts/AuthContext';
import { CLINIC_SPECIALTIES } from '../../../constants';
import { Power, Loader2, ShieldCheck, Clock, PawPrint, CircleDollarSign, UserCheck, Sparkles } from 'lucide-react';

interface ClinicsManagementViewProps {
  /**
   * If provided, the Add/Edit buttons navigate to the page-based admin
   * form instead of opening the legacy modal. Existing call-sites that
   * don't pass this prop keep the modal flow.
   */
  onNavigate?: (view: string, params?: any) => void;
}

const ClinicsManagementView: React.FC<ClinicsManagementViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  // Attribution filter: 'all' | 'self' (self-registered) | a sales-rep id.
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    subdomain: '',
    slogan: '',
    primaryColor: '#1a5f4a',
    secondaryColor: '#7dd3c0',
    currency: 'USD',
    prodTest: false,
  });
  const [formSpecialties, setFormSpecialties] = useState<string[]>([]);

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'MERCHANT_ADMIN';

  useEffect(() => {
    fetchClinics();
  }, []);

  const fetchClinics = async () => {
    try {
      setLoading(true);
      const response = await clinicsAPI.getAll();
      setClinics(response.data.clinics || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load clinics');
    } finally {
      setLoading(false);
    }
  };

  const filteredClinics = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return clinics.filter(c => {
      const matchesSearch =
        c.name.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.subdomain && c.subdomain.toLowerCase().includes(q));
      if (!matchesSearch) return false;
      if (sourceFilter === 'all') return true;
      if (sourceFilter === 'self') return !c.referredBy;
      return c.referredBy?.id === sourceFilter;
    });
  }, [clinics, searchQuery, sourceFilter]);

  // Distinct sales reps that appear as a source in the current clinic list —
  // drives the attribution filter dropdown. Self-registered clinics have no
  // referredBy. `referredBy` is undefined on non-admin payloads; we only show
  // the filter when the field is actually present.
  const sourceOptions = useMemo(() => {
    const reps = new Map<string, string>();
    let hasSelf = false;
    let attributionKnown = false;
    clinics.forEach(c => {
      if ('referredBy' in c) attributionKnown = true;
      if (c.referredBy) reps.set(c.referredBy.id, c.referredBy.name);
      else if ('referredBy' in c) hasSelf = true;
    });
    return {
      show: attributionKnown,
      hasSelf,
      reps: Array.from(reps, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [clinics]);

  const stats = useMemo(() => ({
    total: clinics.length,
    active: clinics.filter(c => c.isActive).length,
    inactive: clinics.filter(c => !c.isActive).length,
  }), [clinics]);

  // Platform-wide aggregates for the KPI tiles (verified/pending, clients, pets,
  // MRR). Best-effort: silent fetch, tiles fall back to the local clinic counts.
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  useEffect(() => {
    platformMetricsAPI.get({ silent: true }).then((r) => setMetrics(r.data ?? null)).catch(() => {});
  }, []);

  // Branches grouped by their parent clinic id — used to offer a deactivation
  // scope (this clinic only vs. this clinic + its branches).
  const branchesByParent = useMemo(() => {
    const map = new Map<string, Clinic[]>();
    clinics.forEach(c => {
      if (c.parentClinicId) {
        const key = String(c.parentClinicId);
        map.set(key, [...(map.get(key) || []), c]);
      }
    });
    return map;
  }, [clinics]);

  // Bespoke status flow for clinics: a main clinic with branches gets a scope
  // chooser; everything else uses the shared StatusToggle.
  const [statusTarget, setStatusTarget] = useState<Clinic | null>(null);
  const [statusScope, setStatusScope] = useState<'this' | 'with-branches'>('this');
  const [statusBusy, setStatusBusy] = useState(false);
  const [viewingClinic, setViewingClinic] = useState<Clinic | null>(null);
  // Detail modal tabs: Overview + Users / Branches / Partners tables
  // (fetched per clinic from /clinics/:id/admin-details).
  const [detailTab, setDetailTab] = useState<'overview' | 'users' | 'branches' | 'partners'>('overview');
  const [clinicDetails, setClinicDetails] = useState<{ users: any[]; branches: any[]; partners: any[] } | null>(null);
  useEffect(() => {
    setDetailTab('overview');
    setClinicDetails(null);
    if (!viewingClinic) return;
    let alive = true;
    clinicsAPI.adminDetails(Number(viewingClinic.id))
      .then(r => { if (alive && r.success && r.data) setClinicDetails(r.data as any); })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingClinic?.id]);

  const applyStatus = async () => {
    if (!statusTarget) return;
    const next = !statusTarget.isActive;
    const branches = branchesByParent.get(String(statusTarget.id)) || [];
    const scope = branches.length > 0 ? statusScope : 'this';
    setStatusBusy(true);
    try {
      const res = await clinicsAPI.setStatus(Number(statusTarget.id), next, { scope });
      // The clinics GET is cached, so a plain refetch returns the stale list and
      // the card never flips. Optimistically update the affected rows from the
      // response, bust the cache, then refetch for consistency.
      const affected = new Set((res.data?.affected ?? [String(statusTarget.id)]).map(String));
      setClinics((prev) => prev.map((c) => (affected.has(String(c.id)) ? { ...c, isActive: next } : c)));
      cache.invalidatePattern('/clinics');
      toast.success(`Clinic ${next ? 'activated' : 'deactivated'}`);
      setStatusTarget(null);
      fetchClinics();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update clinic status');
    } finally {
      setStatusBusy(false);
    }
  };

  const handleOpenCreateModal = () => {
    if (onNavigate) {
      onNavigate('admin-clinic-new');
      return;
    }
    setEditingClinic(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      subdomain: '',
      slogan: '',
      primaryColor: '#1a5f4a',
      secondaryColor: '#7dd3c0',
      currency: 'USD',
      prodTest: false,
    });
    setFormSpecialties([]);
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (clinic: Clinic) => {
    if (onNavigate) {
      onNavigate('admin-clinic-edit', { clinicId: String(clinic.id) });
      return;
    }
    setEditingClinic(clinic);
    setFormData({
      name: clinic.name,
      email: clinic.email || '',
      phone: clinic.phone || '',
      address: clinic.address || '',
      subdomain: clinic.subdomain || '',
      slogan: clinic.slogan || '',
      primaryColor: clinic.primaryColor || '#1a5f4a',
      secondaryColor: clinic.secondaryColor || '#7dd3c0',
      currency: clinic.currency || 'USD',
      prodTest: (clinic as any).prodTest === true,
    });
    setFormSpecialties(clinic.specialties || []);
    setShowCreateModal(true);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingClinic(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      subdomain: '',
      slogan: '',
      primaryColor: '#1a5f4a',
      secondaryColor: '#7dd3c0',
      currency: 'USD',
      prodTest: false,
    });
    setFormSpecialties([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error('Clinic name is required');
      return;
    }

    try {
      const payload = { ...formData, specialties: formSpecialties };
      if (editingClinic) {
        await clinicsAPI.update(Number(editingClinic.id), payload);
        toast.success('Clinic updated successfully');
      } else {
        await clinicsAPI.create(payload);
        toast.success('Clinic created successfully');
      }
      handleCloseModal();
      fetchClinics();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${editingClinic ? 'update' : 'create'} clinic`);
    }
  };

  const handleDelete = async (clinicId: number, clinicName: string) => {
    const ok = await dialog.confirmDelete({
      title: 'Delete Clinic',
      message: 'This will permanently remove the clinic and all related data. This action cannot be undone.',
      entityName: clinicName,
    });
    if (!ok) return;

    try {
      await clinicsAPI.delete(clinicId);
      toast.success('Clinic deleted successfully');
      fetchClinics();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete clinic');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner contentArea message="Loading clinics..." />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header — platform dashboard treatment (matches Suppliers) */}
      <header className="mb-8">
        <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-seafoam mb-1">Platform · Clinics</p>
            <h1 className="text-4xl font-black text-pine dark:text-zinc-100 mb-1">All Clinics</h1>
            <p className="text-slate-600 dark:text-zinc-400 text-sm">Every clinic on the platform — counts, verification and subscription value at a glance.</p>
          </div>
          {isAdmin && (
            <button
              onClick={handleOpenCreateModal}
              className="bg-pine dark:bg-zinc-100 text-white dark:text-pine px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
            >
              <Plus size={18} />
              Create Clinic
            </button>
          )}
        </div>

        {/* KPI tiles */}
        {(() => {
          const fmt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString());
          const tiles = [
            { label: 'Total', value: fmt(metrics?.clinics.total ?? stats.total), icon: Building2, tone: 'text-blue-500 bg-blue-500/10' },
            { label: 'Active', value: fmt(metrics?.clinics.active ?? stats.active), icon: CheckCircle, tone: 'text-green-500 bg-green-500/10' },
            { label: 'Inactive', value: fmt(metrics?.clinics.inactive ?? stats.inactive), icon: XCircle, tone: 'text-red-500 bg-red-500/10' },
            { label: 'Verified', value: fmt(metrics?.clinics.verified), icon: ShieldCheck, tone: 'text-emerald-500 bg-emerald-500/10' },
            { label: 'Pending', value: fmt(metrics?.clinics.pending), icon: Clock, tone: 'text-amber-500 bg-amber-500/10' },
            { label: 'Clients', value: fmt(metrics?.totals?.clients), icon: Users, tone: 'text-cyan-500 bg-cyan-500/10' },
            { label: 'Pets', value: fmt(metrics?.totals?.pets), icon: PawPrint, tone: 'text-fuchsia-500 bg-fuchsia-500/10' },
            { label: 'MRR', value: fmt(metrics?.subscriptions.mrr), icon: CircleDollarSign, tone: 'text-pine bg-pine/10 dark:text-zinc-200 dark:bg-zinc-100/10' },
          ];
          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
              {tiles.map((t) => (
                <div key={t.label} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.tone}`}>
                      <t.icon size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 truncate">{t.label}</p>
                      <p className="text-xl font-black text-pine dark:text-zinc-100">{t.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Top clinics + region distribution (matches the Suppliers dashboard row) */}
        {metrics && ((metrics.clinics.top?.length ?? 0) > 0 || (metrics.clinics.byRegion?.length ?? 0) > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400 mb-3">Top clinics · by clients</p>
              {(metrics.clinics.top?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-400">No client data yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {(() => {
                    const max = Math.max(...metrics.clinics.top!.map((t) => t.clientCount), 1);
                    return metrics.clinics.top!.map((t, i) => (
                      <div key={t.clinicId} className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-400 w-4 shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-bold text-pine dark:text-zinc-100 truncate">{t.clinicName}</span>
                            <span className="text-xs font-black text-seafoam shrink-0">{t.clientCount.toLocaleString()}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                            <div className="h-full rounded-full bg-seafoam" style={{ width: `${Math.round((t.clientCount / max) * 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400 mb-3">Clinics · by region</p>
              {(metrics.clinics.byRegion?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-400">No region data.</p>
              ) : (
                <div className="space-y-2">
                  {metrics.clinics.byRegion!.slice(0, 6).map((r) => (
                    <div key={r.region ?? 'none'} className="flex items-center justify-between text-sm">
                      <span className="font-bold text-pine dark:text-zinc-100">{r.region ?? 'Unspecified'}</span>
                      <span className="font-black text-slate-400">{r.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search + attribution filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search clinics by name, email, or subdomain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl pl-12 pr-6 py-3 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none transition-all"
            />
          </div>
          {sourceOptions.show && (
            <div className="relative sm:w-64">
              <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                title="Filter by who brought in the clinic"
                className="w-full appearance-none bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl pl-11 pr-8 py-3 text-sm font-bold text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none transition-all cursor-pointer"
              >
                <option value="all">All sources</option>
                {sourceOptions.hasSelf && <option value="self">Self-registered</option>}
                {sourceOptions.reps.length > 0 && <optgroup label="Sales reps">
                  {sourceOptions.reps.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </optgroup>}
              </select>
            </div>
          )}
        </div>
      </header>

      {/* Clinics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClinics.map((clinic) => (
          <div
            key={clinic.id}
            className="bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm hover:shadow-lg transition-all relative"
          >
            {/* Status badge — admins can click to activate / deactivate */}
            <div className="absolute top-4 right-4">
              <button
                type="button"
                disabled={!isAdmin}
                onClick={() => { setStatusScope('this'); setStatusTarget(clinic); }}
                title={isAdmin ? (clinic.isActive ? 'Deactivate clinic' : 'Activate clinic') : undefined}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${isAdmin ? 'cursor-pointer hover:ring-2 hover:ring-offset-1' : 'cursor-default'} ${
                  clinic.isActive
                    ? 'bg-green-500/10 text-green-500 hover:ring-red-300'
                    : 'bg-red-500/10 text-red-500 hover:ring-green-300'
                }`}
              >
                {isAdmin && <Power size={11} />}
                {clinic.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>

            {/* Clinic Logo/Icon */}
            <div className="mb-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center text-3xl">
                {clinic.logo ? <ClinicLogo logo={clinic.logo} /> : <Building2 className="text-slate-400" size={32} />}
              </div>
            </div>

            {/* Clinic Info — name opens the detail PAGE (falls back to the
                legacy modal for call-sites without onNavigate) */}
            <button
              type="button"
              onClick={() => onNavigate ? onNavigate('admin-clinic-detail', { clinicId: String(clinic.id) }) : setViewingClinic(clinic)}
              className="text-left group/name"
              title="View clinic details"
            >
              <h3 className="text-xl font-black text-pine dark:text-zinc-100 mb-2 group-hover/name:text-seafoam transition-colors">{clinic.name}</h3>
            </button>
            {clinic.slogan && (
              <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4 italic">"{clinic.slogan}"</p>
            )}

            <div className="space-y-2 mb-4">
              {clinic.email && (
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                  <Mail size={14} />
                  <span>{clinic.email}</span>
                </div>
              )}
              {clinic.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                  <Phone size={14} />
                  <span>{clinic.phone}</span>
                </div>
              )}
              {clinic.address && (
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                  <MapPin size={14} />
                  <span className="line-clamp-1">{clinic.address}</span>
                </div>
              )}
              {clinic.subdomain && (
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                  <Globe size={14} />
                  <span>{clinic.subdomain}</span>
                </div>
              )}
            </div>

            {/* Specialties */}
            {clinic.specialties && clinic.specialties.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {clinic.specialties.map(s => {
                  const spec = CLINIC_SPECIALTIES.find(sp => sp.value === s);
                  return (
                    <span key={s} className="flex items-center gap-1 px-2 py-0.5 bg-seafoam/10 text-seafoam rounded-lg text-[10px] font-black uppercase tracking-widest">
                      {spec?.icon}{s}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Attribution — who brought this clinic in */}
            {'referredBy' in clinic && (
              <div className="mb-4">
                {clinic.referredBy ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300 text-[10px] font-black uppercase tracking-widest">
                    <UserCheck size={12} />
                    {clinic.referredBy.name}
                    {clinic.referredBy.code && <span className="font-mono normal-case opacity-70">· {clinic.referredBy.code}</span>}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-500/10 text-slate-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                    <Sparkles size={12} /> Self-registered
                  </span>
                )}
              </div>
            )}

            {/* Branches of this clinic (child clinics) */}
            {(branchesByParent.get(String(clinic.id)) || []).length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-4">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Branches</span>
                {(branchesByParent.get(String(clinic.id)) || []).slice(0, 3).map(b => (
                  <span key={b.id} className="px-2 py-0.5 rounded-lg bg-seafoam/10 text-seafoam text-[10px] font-bold truncate max-w-[140px]">{b.name}</span>
                ))}
                {(branchesByParent.get(String(clinic.id)) || []).length > 3 && (
                  <span className="text-[10px] font-bold text-slate-400">+{(branchesByParent.get(String(clinic.id)) || []).length - 3} more</span>
                )}
              </div>
            )}

            {/* Actions */}
            {isAdmin && (
              <div className="flex items-center gap-2 pt-4 border-t border-slate-200 dark:border-zinc-800">
                <button
                  onClick={() => handleOpenEditModal(clinic)}
                  className="flex-1 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg transition-all text-sm font-bold flex items-center justify-center gap-2"
                >
                  <Edit size={14} />
                  Edit
                </button>
                <button
                  onClick={() => { setStatusScope('this'); setStatusTarget(clinic); }}
                  className={`flex-1 px-3 py-2 rounded-lg transition-all text-sm font-bold flex items-center justify-center gap-2 ${
                    clinic.isActive
                      ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600'
                      : 'bg-green-500/10 hover:bg-green-500/20 text-green-600'
                  }`}
                >
                  <Power size={14} />
                  {clinic.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(Number(clinic.id), clinic.name)}
                  className="flex-1 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all text-sm font-bold flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredClinics.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="mx-auto text-slate-300 dark:text-zinc-700 mb-4" size={64} />
          <p className="text-slate-600 dark:text-zinc-400">No clinics found</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-black text-pine dark:text-zinc-100">
                {editingClinic ? 'Edit Clinic' : 'Create New Clinic'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Clinic Name */}
              <div>
                <label className="block text-sm font-bold text-pine dark:text-zinc-100 mb-2">
                  Clinic Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none"
                  placeholder="Enter clinic name"
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-bold text-pine dark:text-zinc-100 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none"
                  placeholder="clinic@example.com"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-bold text-pine dark:text-zinc-100 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-bold text-pine dark:text-zinc-100 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none"
                  placeholder="123 Main St, City, State, ZIP"
                />
              </div>

              {/* Subdomain */}
              <div>
                <label className="block text-sm font-bold text-pine dark:text-zinc-100 mb-2">
                  Subdomain
                </label>
                <input
                  type="text"
                  value={formData.subdomain}
                  onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                  className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none"
                  placeholder="myclinic"
                />
                <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">
                  Will be used as: myclinic.vethubcore.com
                </p>
              </div>

              {/* Slogan */}
              <div>
                <label className="block text-sm font-bold text-pine dark:text-zinc-100 mb-2">
                  Slogan
                </label>
                <input
                  type="text"
                  value={formData.slogan}
                  onChange={(e) => setFormData({ ...formData, slogan: e.target.value })}
                  className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none"
                  placeholder="Your trusted veterinary partner"
                />
              </div>

              {/* Currency */}
              <div>
                <label className="block text-sm font-bold text-pine dark:text-zinc-100 mb-2">
                  Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none"
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="CAD">CAD - Canadian Dollar</option>
                  <option value="AUD">AUD - Australian Dollar</option>
                </select>
              </div>

              {/* Prod-test / beta flag — admin only */}
              {isAdmin && (
                <div className="flex items-center justify-between gap-3 p-3 bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-900/30 rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-pine dark:text-zinc-100">Prod-test / beta clinic</p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">Roll new features out to this clinic before full release.</p>
                  </div>
                  <button type="button" onClick={() => setFormData({ ...formData, prodTest: !formData.prodTest })}
                    className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${formData.prodTest ? 'bg-seafoam' : 'bg-slate-300 dark:bg-zinc-700'}`}>
                    <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${formData.prodTest ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
              )}

              {/* Specialties */}
              <div>
                <label className="block text-sm font-bold text-pine dark:text-zinc-100 mb-2">
                  Clinical Specialties
                </label>
                <div className="flex flex-wrap gap-2">
                  {CLINIC_SPECIALTIES.map(({ value, label, icon }) => {
                    const active = formSpecialties.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFormSpecialties(prev =>
                          active ? prev.filter(s => s !== value) : [...prev, value]
                        )}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                          active
                            ? 'bg-seafoam text-white border-seafoam shadow-md'
                            : 'bg-slate-50 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700 hover:border-seafoam'
                        }`}
                      >
                        {icon}{label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-pine dark:text-zinc-100 mb-2">
                    Primary Color
                  </label>
                  <input
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="w-full h-10 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-pine dark:text-zinc-100 mb-2">
                    Secondary Color
                  </label>
                  <input
                    type="color"
                    value={formData.secondaryColor}
                    onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                    className="w-full h-10 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl cursor-pointer"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-6 py-3 bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all"
                >
                  {editingClinic ? 'Update Clinic' : 'Create Clinic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clinic detail view (read-only) */}
      {viewingClinic && (() => {
        const c: any = viewingClinic;
        const branches = branchesByParent.get(String(c.id)) || [];
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
          ['Branches', String(branches.length)],
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
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewingClinic(null)} />
            <div className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[88vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-200 dark:border-zinc-800">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center text-2xl shrink-0">
                    {c.logo ? <ClinicLogo logo={c.logo} /> : <Building2 className="text-slate-400" size={28} />}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-black text-pine dark:text-zinc-100 truncate">{c.name}</h2>
                    {c.slogan && <p className="text-sm text-slate-500 dark:text-zinc-400 italic truncate">"{c.slogan}"</p>}
                    <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${c.isActive ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'}`}>
                      <Power size={10} /> {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <button onClick={() => setViewingClinic(null)} className="text-slate-400 hover:text-pine shrink-0"><X size={20} /></button>
              </div>

              {/* Detail tabs — Overview + drill-down tables */}
              <div className="px-6 pt-4 flex flex-wrap gap-1.5 border-b border-slate-100 dark:border-zinc-800 pb-3">
                {([['overview', 'Overview'], ['users', `Users${clinicDetails ? ` · ${clinicDetails.users.length}` : ''}`], ['branches', `Branches${clinicDetails ? ` · ${clinicDetails.branches.length}` : ''}`], ['partners', `Partners${clinicDetails ? ` · ${clinicDetails.partners.length}` : ''}`]] as const).map(([id, label]) => (
                  <button key={id} onClick={() => setDetailTab(id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${detailTab === id ? 'bg-pine text-white dark:bg-zinc-100 dark:text-pine' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-pine'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="p-6 overflow-y-auto">
                {detailTab === 'overview' && (
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
                {detailTab !== 'overview' && !clinicDetails && (
                  <div className="py-10 flex justify-center"><LoadingSpinner contentArea message="Loading…" /></div>
                )}
                {detailTab === 'users' && clinicDetails && (
                  clinicDetails.users.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">No users attached to this clinic.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="text-left text-slate-400 uppercase tracking-wider text-[9px] font-black border-b border-slate-100 dark:border-zinc-800">
                        <th className="py-2 pr-3">Name</th><th className="py-2 px-3">Email</th><th className="py-2 px-3">Role</th><th className="py-2 px-3">Status</th><th className="py-2 pl-3">Joined</th>
                      </tr></thead>
                      <tbody>
                        {clinicDetails.users.map((u: any) => (
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
                {detailTab === 'branches' && clinicDetails && (
                  clinicDetails.branches.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">This clinic has no branches.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="text-left text-slate-400 uppercase tracking-wider text-[9px] font-black border-b border-slate-100 dark:border-zinc-800">
                        <th className="py-2 pr-3">Branch</th><th className="py-2 px-3">City</th><th className="py-2 px-3">Subdomain</th><th className="py-2 px-3">Status</th><th className="py-2 pl-3">Created</th>
                      </tr></thead>
                      <tbody>
                        {clinicDetails.branches.map((b: any) => (
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
                {detailTab === 'partners' && clinicDetails && (
                  clinicDetails.partners.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">No partnerships (handshakes) yet.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="text-left text-slate-400 uppercase tracking-wider text-[9px] font-black border-b border-slate-100 dark:border-zinc-800">
                        <th className="py-2 pr-3">Partner clinic</th><th className="py-2 px-3">Direction</th><th className="py-2 px-3">Services</th><th className="py-2 px-3">Status</th><th className="py-2 pl-3">Since</th>
                      </tr></thead>
                      <tbody>
                        {clinicDetails.partners.map((h: any) => (
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

              {isAdmin && (
                <div className="flex items-center gap-2 p-4 border-t border-slate-200 dark:border-zinc-800">
                  <button
                    onClick={() => { const cl = viewingClinic; setViewingClinic(null); handleOpenEditModal(cl); }}
                    className="flex-1 px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <Edit size={14} /> Edit
                  </button>
                  <button
                    onClick={() => { const cl = viewingClinic; setViewingClinic(null); setStatusScope('this'); setStatusTarget(cl); }}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 ${c.isActive ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600' : 'bg-green-500/10 hover:bg-green-500/20 text-green-600'}`}
                  >
                    <Power size={14} /> {c.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Activate / deactivate clinic (with branch scope) */}
      {statusTarget && (() => {
        const next = !statusTarget.isActive;
        const branches = branchesByParent.get(String(statusTarget.id)) || [];
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !statusBusy && setStatusTarget(null)} />
            <div className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
              <h2 className="text-lg font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-1">
                {next ? 'Activate' : 'Deactivate'} Clinic
              </h2>
              <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
                {next
                  ? `Restore access for ${statusTarget.name}.`
                  : `${statusTarget.name} will be blocked from signing in and hidden from active lists. You can reactivate any time.`}
              </p>

              {branches.length > 0 && (
                <div className="space-y-2 mb-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Apply to</p>
                  {([
                    { v: 'this' as const, label: 'This clinic only' },
                    { v: 'with-branches' as const, label: `This clinic + ${branches.length} branch${branches.length > 1 ? 'es' : ''}` },
                  ]).map(opt => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setStatusScope(opt.v)}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                        statusScope === opt.v
                          ? 'border-seafoam bg-seafoam/10 text-pine dark:text-zinc-100'
                          : 'border-slate-200 dark:border-zinc-700 text-slate-500 hover:border-seafoam'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full border-2 ${statusScope === opt.v ? 'border-seafoam bg-seafoam' : 'border-slate-300'}`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStatusTarget(null)}
                  disabled={statusBusy}
                  className="flex-1 px-6 py-3 bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-100 rounded-xl font-black text-sm uppercase tracking-wide hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={applyStatus}
                  disabled={statusBusy}
                  className={`flex-1 px-6 py-3 text-white rounded-xl font-black text-sm uppercase tracking-wide shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                    next ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {statusBusy ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
                  {next ? 'Activate' : 'Deactivate'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default ClinicsManagementView;
