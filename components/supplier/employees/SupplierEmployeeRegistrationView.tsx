import React, { useState } from 'react';
import { X, Check, RefreshCw, ChevronDown } from 'lucide-react';
import { supplierEmployeesAPI, SupplierEmployee, SupplierRole, SUPPLIER_ROLE_LABELS } from '../../../services/modules/supplierEmployees.api';
import { useSupplierBranch } from '../../../contexts/SupplierBranchContext';
import { toast } from '../../../services/utils/toast';

interface Props {
  onClose: () => void;
  onSuccess: (employee: SupplierEmployee) => void;
}

const SupplierEmployeeRegistrationView: React.FC<Props> = ({ onClose, onSuccess }) => {
  const { branches } = useSupplierBranch();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'SALES' as SupplierRole,
    branchId: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.email.trim()) return toast.error('Email is required');
    if (!form.password || form.password.length < 6) return toast.error('Password must be at least 6 characters');

    setSaving(true);
    try {
      const res = await supplierEmployeesAPI.invite({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        role: form.role,
        branchId: form.branchId || undefined,
      });
      toast.success('Employee invited successfully');
      onSuccess(res.data.employee);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to invite employee');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-zinc-800">
          <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Invite Employee</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          {/* Name */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">Full Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. John Doe"
              className="w-full px-4 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 placeholder-slate-300 dark:placeholder-zinc-600"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="employee@supplier.com"
              className="w-full px-4 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 placeholder-slate-300 dark:placeholder-zinc-600"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">Password *</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Min. 6 characters"
              className="w-full px-4 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 placeholder-slate-300 dark:placeholder-zinc-600"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+254 700 000 000"
              className="w-full px-4 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 placeholder-slate-300 dark:placeholder-zinc-600"
            />
          </div>

          {/* Role + Branch */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">Role *</label>
              <div className="relative">
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as SupplierRole }))}
                  className="w-full appearance-none px-4 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 pr-8"
                >
                  {Object.entries(SUPPLIER_ROLE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">Branch</label>
              <div className="relative">
                <select
                  value={form.branchId}
                  onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}
                  className="w-full appearance-none px-3 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 pr-8"
                >
                  <option value="">Unassigned</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-zinc-800">
          <button onClick={onClose} disabled={saving} className="px-5 py-2.5 text-xs font-black uppercase text-slate-500 hover:text-pine transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-wider hover:opacity-90 transition-all disabled:opacity-60">
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
            Send Invite
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupplierEmployeeRegistrationView;
