import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Plus, Building2, Mail, Phone, MapPin, Globe,
  Edit, Trash2, X, Eye, EyeOff, DollarSign, Users, CheckCircle, XCircle
} from 'lucide-react';
import { clinicsAPI, Clinic } from '../../../services';
import { toast, dialog } from '../../../services';
import { useAuth } from '../../../contexts/AuthContext';
import { CLINIC_SPECIALTIES } from '../../../constants';

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
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-black text-pine dark:text-zinc-100 mb-2">Clinics Management</h1>
            <p className="text-slate-600 dark:text-zinc-400">Manage all clinics in the system</p>
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

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Building2 className="text-blue-500" size={24} />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-zinc-400">Total Clinics</p>
                <p className="text-2xl font-black text-pine dark:text-zinc-100">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="text-green-500" size={24} />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-zinc-400">Active Clinics</p>
                <p className="text-2xl font-black text-pine dark:text-zinc-100">{stats.active}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <XCircle className="text-red-500" size={24} />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-zinc-400">Inactive Clinics</p>
                <p className="text-2xl font-black text-pine dark:text-zinc-100">{stats.inactive}</p>
              </div>
            </div>
          </div>
        </div>

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
            {/* Status Badge */}
            <div className="absolute top-4 right-4">
              {clinic.isActive ? (
                <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-xs font-bold">Active</span>
              ) : (
                <span className="px-3 py-1 bg-red-500/10 text-red-500 rounded-full text-xs font-bold">Inactive</span>
              )}
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
                  className="flex-1 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg transition-all text-sm font-bold flex items-center justify-center gap-2"
                >
                  <Edit size={14} />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(Number(clinic.id), clinic.name)}
                  className="flex-1 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all text-sm font-bold flex items-center justify-center gap-2"
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
                  Will be used as: myclinic.vethub.com
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
    </div>
  );
};

export default ClinicsManagementView;
