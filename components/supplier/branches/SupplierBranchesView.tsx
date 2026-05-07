import React, { useState } from 'react';
import {
  Plus, Edit2, Trash2, X, Check, RefreshCw, Building2, MapPin, Phone, Mail, ToggleLeft, ToggleRight, ChevronDown, DollarSign
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useSupplierBranch } from '../../../contexts/SupplierBranchContext';
import { supplierBranchesAPI, SupplierBranch, CreateBranchData, UpdateBranchData } from '../../../services/modules/supplierBranches.api';
import { toast } from '../../../services/utils/toast';

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
  { code: 'RWF', symbol: 'Fr', name: 'Rwandan Franc' },
  { code: 'ETB', symbol: 'Br', name: 'Ethiopian Birr' },
  { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi' },
];

interface BranchFormData {
  name: string;
  city: string;
  country: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
}

const emptyForm = (): BranchFormData => ({ name: '', city: '', country: '', address: '', phone: '', email: '', currency: 'USD' });

const SupplierBranchesView: React.FC = () => {
  const { user } = useAuth();
  const { branches, refresh } = useSupplierBranch();
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<SupplierBranch | null>(null);
  const [form, setForm] = useState<BranchFormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SupplierBranch | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const openAdd = () => { setEditingBranch(null); setForm(emptyForm()); setShowModal(true); };
  const openEdit = (b: SupplierBranch) => {
    setEditingBranch(b);
    setForm({ name: b.name, city: b.city || '', country: b.country || '', address: b.address || '', phone: b.phone || '', email: b.email || '', currency: b.currency || 'USD' });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditingBranch(null); setForm(emptyForm()); };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Branch name is required');
    setSaving(true);
    try {
      if (editingBranch) {
        const payload: UpdateBranchData = {
          name: form.name.trim(),
          city: form.city.trim() || undefined,
          country: form.country.trim() || undefined,
          address: form.address.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          currency: form.currency,
        };
        await supplierBranchesAPI.update(Number(editingBranch.id), payload);
        toast.success('Branch updated');
      } else {
        const payload: CreateBranchData = {
          name: form.name.trim(),
          city: form.city.trim() || undefined,
          country: form.country.trim() || undefined,
          address: form.address.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          currency: form.currency,
        };
        await supplierBranchesAPI.create(payload);
        toast.success('Branch created');
      }
      await refresh();
      closeModal();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await supplierBranchesAPI.delete(Number(deleteTarget.id));
      await refresh();
      toast.success('Branch deleted');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete branch');
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (branch: SupplierBranch) => {
    setTogglingId(branch.id);
    try {
      await supplierBranchesAPI.update(Number(branch.id), { isActive: !branch.isActive });
      await refresh();
    } catch { toast.error('Failed to update branch'); }
    finally { setTogglingId(null); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Branches</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-semibold">
            {branches.length + (user?.supplier ? 1 : 0)} branch{(branches.length + (user?.supplier ? 1 : 0)) !== 1 ? 'es' : ''} · {branches.filter(b => b.isActive).length + (user?.supplier ? 1 : 0)} active
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-wider hover:opacity-90 transition-all shadow-sm"
        >
          <Plus size={14} /> Add Branch
        </button>
      </div>

      {/* Main Branch card (from supplier profile) */}
      {user?.supplier && (
        <div className="bg-white dark:bg-zinc-900 border-2 border-seafoam/40 dark:border-seafoam/20 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-seafoam/10 flex items-center justify-center">
                <Building2 size={18} className="text-seafoam" />
              </div>
              <div>
                <h3 className="font-black text-pine dark:text-zinc-100 text-sm uppercase tracking-tight">{user.supplier.name}</h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-seafoam/10 text-seafoam">Main Branch</span>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">Active</span>
          </div>
          <div className="space-y-1.5">
            {user.supplier.address && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                <MapPin size={11} />
                <span className="font-semibold">{user.supplier.address}</span>
              </div>
            )}
            {user.supplier.contactPhone && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                <Phone size={11} />
                <span className="font-semibold">{user.supplier.contactPhone}</span>
              </div>
            )}
            {user.supplier.contactEmail && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                <Mail size={11} />
                <span className="font-semibold">{user.supplier.contactEmail}</span>
              </div>
            )}
            {user.supplier.currency && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-seafoam/10 text-seafoam">
                  {user.supplier.currency}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Branch Cards */}
      {branches.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-16 shadow-sm text-center">
          <Building2 size={40} className="mx-auto mb-4 text-slate-300 dark:text-zinc-600" />
          <p className="text-sm font-bold text-slate-500 dark:text-zinc-400 mb-4">No branches yet</p>
          <button onClick={openAdd} className="px-5 py-2.5 bg-pine text-white rounded-xl font-black text-xs uppercase hover:opacity-90 transition-all">
            Add First Branch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map(branch => (
            <div key={branch.id} className={`bg-white dark:bg-zinc-900 border-2 rounded-2xl p-5 shadow-sm transition-all hover:shadow-md ${branch.isActive ? 'border-slate-200 dark:border-zinc-800' : 'border-slate-100 dark:border-zinc-800/50 opacity-70'}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-seafoam/10 flex items-center justify-center">
                  <Building2 size={18} className="text-seafoam" />
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => openEdit(branch)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-400 hover:text-blue-500 transition-all">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => setDeleteTarget(branch)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <h3 className="font-black text-pine dark:text-zinc-100 text-sm uppercase tracking-tight">{branch.name}</h3>
              <div className="mt-3 space-y-1.5">
                {(branch.city || branch.country) && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                    <MapPin size={11} />
                    <span className="font-semibold">{[branch.city, branch.country].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {branch.address && (
                  <p className="text-xs text-slate-400 dark:text-zinc-500 pl-4">{branch.address}</p>
                )}
                {branch.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                    <Phone size={11} />
                    <span className="font-semibold">{branch.phone}</span>
                  </div>
                )}
                {branch.email && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                    <Mail size={11} />
                    <span className="font-semibold">{branch.email}</span>
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${branch.isActive ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'}`}>
                    {branch.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-seafoam/10 text-seafoam">
                    {branch.currency || 'USD'}
                  </span>
                </div>
                <button onClick={() => toggleActive(branch)} disabled={togglingId === branch.id} className="transition-all">
                  {togglingId === branch.id
                    ? <RefreshCw size={18} className="animate-spin text-slate-400" />
                    : branch.isActive
                    ? <ToggleRight size={22} className="text-green-500 hover:opacity-80" />
                    : <ToggleLeft size={22} className="text-slate-400 dark:text-zinc-600 hover:opacity-80" />
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-zinc-800">
              <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">
                {editingBranch ? 'Edit Branch' : 'Add Branch'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all">
                <X size={16} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { field: 'name', label: 'Branch Name *', placeholder: 'e.g. Nairobi CBD Branch' },
                { field: 'city', label: 'City', placeholder: 'e.g. Nairobi' },
                { field: 'country', label: 'Country', placeholder: 'e.g. Kenya' },
                { field: 'address', label: 'Address', placeholder: 'Street address...' },
                { field: 'phone', label: 'Phone', placeholder: '+254 700 000 000' },
                { field: 'email', label: 'Email', placeholder: 'branch@supplier.com' },
              ].map(({ field, label, placeholder }) => (
                <div key={field}>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">{label}</label>
                  <input
                    type={field === 'email' ? 'email' : 'text'}
                    value={(form as any)[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-4 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 placeholder-slate-300 dark:placeholder-zinc-600"
                  />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">Currency</label>
                <div className="relative">
                  <select
                    value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full appearance-none px-4 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 pr-8"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-zinc-800">
              <button onClick={closeModal} disabled={saving} className="px-5 py-2.5 text-xs font-black uppercase text-slate-500 hover:text-pine transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-wider hover:opacity-90 transition-all disabled:opacity-60">
                {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                {editingBranch ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-sm p-6 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="text-center">
              <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 size={24} className="text-red-500" /></div>
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase">Delete Branch?</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2"><span className="font-bold text-pine dark:text-zinc-200">{deleteTarget.name}</span> will be permanently removed.</p>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 text-xs font-black uppercase text-slate-500 bg-slate-100 dark:bg-zinc-800 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-xl font-black text-xs uppercase hover:bg-red-600 transition-all disabled:opacity-60">
                {deleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierBranchesView;
