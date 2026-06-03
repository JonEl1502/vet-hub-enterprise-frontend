import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Plus, Building2, Mail, Phone, MapPin, Globe,
  Edit, Trash2, X, Eye, EyeOff, DollarSign, Users, CheckCircle, XCircle
} from 'lucide-react';
import { clinicsAPI, Clinic, platformMetricsAPI, type PlatformMetrics } from '../../../services';
import { toast, dialog } from '../../../services';
import { useAuth } from '../../../contexts/AuthContext';
import { CLINIC_SPECIALTIES } from '../../../constants';
import { Power, Loader2, ShieldCheck, Clock, PawPrint, CircleDollarSign } from 'lucide-react';

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
    return clinics.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.subdomain && c.subdomain.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [clinics, searchQuery]);

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

  const applyStatus = async () => {
    if (!statusTarget) return;
    const next = !statusTarget.isActive;
    const branches = branchesByParent.get(String(statusTarget.id)) || [];
    const scope = branches.length > 0 ? statusScope : 'this';
    setStatusBusy(true);
    try {
      await clinicsAPI.setStatus(Number(statusTarget.id), next, { scope });
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pine dark:border-zinc-100"></div>
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

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search clinics by name, email, or subdomain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl pl-12 pr-6 py-3 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none transition-all"
          />
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
              {clinic.logo ? (
                <img src={clinic.logo} alt={clinic.name} className="w-16 h-16 rounded-2xl object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
                  <Building2 className="text-slate-400" size={32} />
                </div>
              )}
            </div>

            {/* Clinic Info */}
            <h3 className="text-xl font-black text-pine dark:text-zinc-100 mb-2">{clinic.name}</h3>
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
