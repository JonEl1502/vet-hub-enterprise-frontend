import React, { useState, useEffect } from 'react';
import { ArrowLeft, Building2, Mail, Phone, RefreshCw, ChevronDown, Check, User } from 'lucide-react';
import { supplierEmployeesAPI, SupplierEmployee, SupplierRole, SUPPLIER_ROLE_LABELS, SUPPLIER_ROLE_COLORS } from '../services/modules/supplierEmployees.api';
import { useSupplierBranch } from '../contexts/SupplierBranchContext';
import { toast } from '../services/utils/toast';

interface SupplierEmployeeProfileViewProps {
  employeeId: string;
  onBack: () => void;
}

const SupplierEmployeeProfileView: React.FC<SupplierEmployeeProfileViewProps> = ({ employeeId, onBack }) => {
  const { branches } = useSupplierBranch();
  const [employee, setEmployee] = useState<SupplierEmployee | null>(null);
  const [loading, setLoading] = useState(true);
  const [editRole, setEditRole] = useState<SupplierRole>('SALES');
  const [editBranchId, setEditBranchId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await supplierEmployeesAPI.getById(Number(employeeId));
        const emp = res.data.employee;
        setEmployee(emp);
        setEditRole(emp.role);
        setEditBranchId(emp.branchId || '');
      } catch {
        toast.error('Failed to load employee');
      } finally {
        setLoading(false);
      }
    })();
  }, [employeeId]);

  const handleSave = async () => {
    if (!employee) return;
    setSaving(true);
    try {
      const res = await supplierEmployeesAPI.update(Number(employee.id), {
        role: editRole,
        branchId: editBranchId || null,
      });
      setEmployee(res.data.employee);
      toast.success('Employee updated');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="space-y-4">
      <div className="h-10 w-24 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl animate-pulse" />
      <div className="h-40 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl animate-pulse" />
    </div>
  );

  if (!employee) return (
    <div className="text-center py-16">
      <User size={40} className="mx-auto mb-4 text-slate-300" />
      <p className="text-sm font-bold text-slate-500">Employee not found</p>
      <button onClick={onBack} className="mt-4 px-5 py-2 bg-pine text-white rounded-xl text-xs font-black uppercase hover:opacity-90">Go Back</button>
    </div>
  );

  const name = employee.user.profile?.name || employee.user.email;
  const hasChanges = editRole !== employee.role || editBranchId !== (employee.branchId || '');

  return (
    <div className="space-y-4">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-xs font-black uppercase text-slate-500 dark:text-zinc-400 hover:text-pine dark:hover:text-zinc-200 transition-colors">
        <ArrowLeft size={14} /> Back to Employees
      </button>

      {/* Profile Header */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-seafoam to-pine flex items-center justify-center text-white font-black text-2xl shadow-md flex-shrink-0">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">{name}</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{employee.user.email}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${SUPPLIER_ROLE_COLORS[employee.role as SupplierRole]}`}>
                {SUPPLIER_ROLE_LABELS[employee.role as SupplierRole]}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${employee.isActive ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'}`}>
                {employee.isActive ? 'Active' : 'Inactive'}
              </span>
              {employee.branch && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                  <Building2 size={9} /> {employee.branch.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Contact info */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
            <Mail size={13} className="text-seafoam flex-shrink-0" />
            <span className="font-semibold">{employee.user.email}</span>
          </div>
          {employee.user.profile?.phone && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
              <Phone size={13} className="text-seafoam flex-shrink-0" />
              <span className="font-semibold">{employee.user.profile.phone}</span>
            </div>
          )}
        </div>
      </div>

      {/* Edit Role & Branch */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-4">Role & Branch Assignment</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">Role</label>
            <div className="relative">
              <select
                value={editRole}
                onChange={e => setEditRole(e.target.value as SupplierRole)}
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
                value={editBranchId}
                onChange={e => setEditBranchId(e.target.value)}
                className="w-full appearance-none px-4 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 pr-8"
              >
                <option value="">Unassigned</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
        {hasChanges && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-wider hover:opacity-90 transition-all disabled:opacity-60"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
              Save Changes
            </button>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight mb-3">Details</h2>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Joined</span>
            <span className="text-pine dark:text-zinc-200 font-semibold">{new Date(employee.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Employee ID</span>
            <span className="text-pine dark:text-zinc-200 font-mono font-semibold">#{employee.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierEmployeeProfileView;
