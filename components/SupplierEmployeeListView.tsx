import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, RefreshCw, User, Building2, X, Eye, ToggleLeft, ToggleRight, Trash2
} from 'lucide-react';
import {
  supplierEmployeesAPI,
  SupplierEmployee,
  SUPPLIER_ROLE_LABELS,
  SUPPLIER_ROLE_COLORS,
  SupplierRole
} from '../services/modules/supplierEmployees.api';
import { useAuth } from '../contexts/AuthContext';
import { useSupplierBranch } from '../contexts/SupplierBranchContext';
import { toast } from '../services/utils/toast';
import SupplierEmployeeRegistrationView from './SupplierEmployeeRegistrationView';

interface SupplierEmployeeListViewProps {
  setView?: (view: string, params?: any) => void;
}

const SupplierEmployeeListView: React.FC<SupplierEmployeeListViewProps> = ({ setView }) => {
  const { user } = useAuth();
  const { branches, activeBranchIds } = useSupplierBranch();
  const [employees, setEmployees] = useState<SupplierEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [showRegister, setShowRegister] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SupplierEmployee | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchEmployees = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await supplierEmployeesAPI.getMyEmployees();
      setEmployees(res.data.employees || []);
    } catch { toast.error('Failed to load employees'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchEmployees(); }, []);

  const filtered = useMemo(() => {
    return employees.filter(e => {
      // Branch filter from context (active branch selection)
      if (activeBranchIds.length > 0) {
        const empBranchId = e.branchId || null;
        const allowed = activeBranchIds.some(id =>
          id === '__main__' ? empBranchId === null : id === empBranchId
        );
        if (!allowed) return false;
      }
      if (roleFilter !== 'ALL' && e.role !== roleFilter) return false;
      if (branchFilter !== 'ALL' && e.branchId !== branchFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = e.user.profile?.name?.toLowerCase() || '';
        const email = e.user.email?.toLowerCase() || '';
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
  }, [employees, activeBranchIds, roleFilter, branchFilter, search]);

  const toggleActive = async (emp: SupplierEmployee) => {
    setTogglingId(emp.id);
    try {
      await supplierEmployeesAPI.update(Number(emp.id), { isActive: !emp.isActive });
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, isActive: !e.isActive } : e));
    } catch { toast.error('Failed to update employee'); }
    finally { setTogglingId(null); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await supplierEmployeesAPI.delete(Number(deleteTarget.id));
      setEmployees(prev => prev.filter(e => e.id !== deleteTarget.id));
      toast.success('Employee removed');
      setDeleteTarget(null);
    } catch { toast.error('Failed to remove employee'); }
    finally { setDeleting(false); }
  };

  if (loading) return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Employees</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-semibold">
            {employees.length} total · {employees.filter(e => e.isActive).length} active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchEmployees(true)} disabled={refreshing} className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all">
            <RefreshCw size={15} className={`text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowRegister(true)}
            className="flex items-center gap-2 px-4 py-2 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-wider hover:opacity-90 transition-all shadow-sm"
          >
            <Plus size={14} /> Invite Employee
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50 placeholder-slate-400"
          />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50">
          <option value="ALL">All Roles</option>
          {Object.entries(SUPPLIER_ROLE_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
        </select>
        {branches.length > 0 && (
          <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-seafoam/50">
            <option value="ALL">All Branches</option>
            <option value="">Unassigned</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        {(search || roleFilter !== 'ALL' || branchFilter !== 'ALL') && (
          <button onClick={() => { setSearch(''); setRoleFilter('ALL'); setBranchFilter('ALL'); }} className="flex items-center gap-1 px-3 py-2 text-xs font-black uppercase text-slate-500 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10">
            <X size={12} /> Clear
          </button>
        )}
        <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 ml-auto">{filtered.length} results</span>
      </div>

      {/* Employee Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <User size={40} className="mx-auto mb-4 text-slate-300 dark:text-zinc-600" />
            <p className="text-sm font-bold text-slate-500 dark:text-zinc-400">No employees found</p>
            {employees.length === 0 && (
              <button onClick={() => setShowRegister(true)} className="mt-4 px-5 py-2.5 bg-pine text-white rounded-xl font-black text-xs uppercase hover:opacity-90 transition-all">
                Invite First Employee
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 border-b border-slate-100 dark:border-zinc-800">
                  <th className="text-left px-4 py-3">Employee</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3">Branch</th>
                  <th className="text-center px-4 py-3">Active</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-zinc-800/60">
                {/* Owner row — only shown when main branch is active */}
                {user && user.supplier && (activeBranchIds.length === 0 || activeBranchIds.includes('__main__')) && (
                  <tr className="bg-seafoam/5 dark:bg-seafoam/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pine to-seafoam flex items-center justify-center text-white font-black text-sm shadow-sm flex-shrink-0">
                          {(user.name || user.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-pine dark:text-zinc-100 text-xs leading-tight">{user.name || '—'}</p>
                          <p className="text-[11px] text-slate-400 dark:text-zinc-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-pine/10 text-pine dark:bg-zinc-800 dark:text-zinc-300">
                        Owner
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] text-slate-400 dark:text-zinc-600 font-semibold">Main Branch</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ToggleRight size={22} className="text-green-500 mx-auto" />
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                )}
                {filtered.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-seafoam to-pine flex items-center justify-center text-white font-black text-sm shadow-sm flex-shrink-0">
                          {(emp.user.profile?.name || emp.user.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-pine dark:text-zinc-100 text-xs leading-tight">
                            {emp.user.profile?.name || '—'}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-zinc-500">{emp.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${SUPPLIER_ROLE_COLORS[emp.role as SupplierRole]}`}>
                        {SUPPLIER_ROLE_LABELS[emp.role as SupplierRole] || emp.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {emp.branch ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                          <Building2 size={11} />
                          <span className="font-semibold">{emp.branch.name}</span>
                          {emp.branch.city && <span className="text-[10px] opacity-60">· {emp.branch.city}</span>}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 dark:text-zinc-600 font-semibold">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleActive(emp)} disabled={togglingId === emp.id} className="transition-all">
                        {togglingId === emp.id
                          ? <RefreshCw size={16} className="animate-spin text-slate-400 mx-auto" />
                          : emp.isActive
                          ? <ToggleRight size={22} className="text-green-500 mx-auto hover:opacity-80" />
                          : <ToggleLeft size={22} className="text-slate-400 dark:text-zinc-600 mx-auto hover:opacity-80" />
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setView?.('supplier-employee-profile', { employeeId: emp.id })}
                          className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-400 hover:text-blue-500 transition-all"
                          title="View profile"
                        >
                          <Eye size={14} />
                        </button>
                        <button onClick={() => setDeleteTarget(emp)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Registration Modal */}
      {showRegister && (
        <SupplierEmployeeRegistrationView
          onClose={() => setShowRegister(false)}
          onSuccess={emp => { setEmployees(prev => [emp, ...prev]); setShowRegister(false); }}
        />
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-sm p-6 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="text-center">
              <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 size={24} className="text-red-500" /></div>
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase">Remove Employee?</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                <span className="font-bold text-pine dark:text-zinc-200">{deleteTarget.user.profile?.name || deleteTarget.user.email}</span> will lose supplier access.
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 text-xs font-black uppercase text-slate-500 bg-slate-100 dark:bg-zinc-800 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-xl font-black text-xs uppercase hover:bg-red-600 transition-all disabled:opacity-60">
                {deleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />} Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierEmployeeListView;
