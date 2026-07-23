
import React, { useState, useMemo, useEffect } from 'react';
import { User, UserRole, Clinic } from '../../../types';
import { Search, Plus, MoreVertical, Edit, Shield, Mail, Phone, Trash2, ShieldCheck, UserPlus, Filter, BadgeCheck, ClipboardList, Eye } from 'lucide-react';
import ManagingSwitcher from '../../shared/common/ManagingSwitcher';
import { roleBadgeClasses, roleShort, roleLabel, ASSIGNABLE_ROLE_GROUPS } from '../../../constants/roles';
import { usePagination } from '../../../hooks/usePagination';
import Pagination from '../../shared/common/Pagination';
import StatusToggle from '../../shared/common/StatusToggle';

interface Props {
  staff: User[];
  clinics: Clinic[];
  onAddStaff: () => void;
  onEditStaff: (user: User) => void;
  onViewStaff: (user: User) => void;
  onDeleteStaff: (id: number) => void;
  /** Activate/deactivate a staff account. When omitted, the toggle is hidden. */
  onToggleStatus?: (user: User, next: boolean) => void | Promise<void>;
  /** The signed-in user's id — its own card hides the toggle (no self-deactivate). */
  currentUserId?: number;
}

const StaffListView: React.FC<Props> = ({ staff, clinics, onAddStaff, onEditStaff, onViewStaff, onDeleteStaff, onToggleStatus, currentUserId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRole = roleFilter === 'ALL' || s.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [staff, searchQuery, roleFilter]);

  // Pagination
  const {
    paginatedItems: paginatedStaff,
    paginationMeta,
    handlePageChange,
    handleLimitChange,
    resetPage,
  } = usePagination(filteredStaff, 12);

  // Reset to first page when filters change
  useEffect(() => {
    resetPage();
  }, [searchQuery, roleFilter, resetPage]);

  const getRoleBadge = (role: UserRole) =>
    "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border " + roleBadgeClasses(role);

  // Curated, scrollable filter set — ALL + every assignable role + external roles.
  const ROLE_FILTERS: string[] = [
    'ALL',
    UserRole.CLINIC_OWNER,
    ...ASSIGNABLE_ROLE_GROUPS.flatMap(g => g.roles),
    UserRole.FREELANCER,
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <ManagingSwitcher kind="clinic" />
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Staff Directory</h1>
          <p className="page-subheader mt-1">Authorized Medical & Administrative Personnel</p>
        </div>
        <div className="flex gap-3">
          <div className="relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-seafoam" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter cluster..."
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-pine dark:text-zinc-100 focus:ring-2 focus:ring-seafoam/20 outline-none w-64 transition-all font-bold shadow-sm"
            />
          </div>
          <button onClick={onAddStaff} className="compact-button bg-pine dark:bg-zinc-100 text-white dark:text-pine shadow-lg flex items-center gap-2 active:scale-95 transition-all">
            <UserPlus size={12} /> Register Staff
          </button>
        </div>
      </header>

      <div className="flex gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-x-auto max-w-full">
         {ROLE_FILTERS.map(r => (
           <button
             key={r}
             onClick={() => setRoleFilter(r)}
             className={`shrink-0 px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${roleFilter === r ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-md' : 'text-slate-400 hover:text-pine'}`}
           >
             {r === 'ALL' ? 'All' : roleShort(r)}
           </button>
         ))}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm">
        {paginationMeta.totalItems > 12 && paginationMeta.totalPages > 1 && (
          <div className="px-4 pt-4">
            <Pagination meta={paginationMeta} onPageChange={handlePageChange} compact />
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
          {paginatedStaff.map(s => (
          <div key={s.id} className="compact-card">
            <div className="flex gap-3">
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewStaff(s)}>
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={s.avatar}
                    alt={s.name}
                    className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-zinc-800 border-2 border-slate-100 dark:border-zinc-700 group-hover:scale-105 transition-transform shadow-inner shrink-0 aspect-square"
                  />
                  <div className="min-w-0">
                    <h3 className="text-lg font-black text-pine dark:text-zinc-100 truncate tracking-tight leading-tight uppercase">{s.name}</h3>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                       <span className={getRoleBadge(s.role)}>{roleShort(s.role)}</span>
                       {onToggleStatus && s.id !== currentUserId && (
                         <span onClick={(e) => e.stopPropagation()}>
                           <StatusToggle
                             isActive={s.isActive !== false}
                             entityName={s.name}
                             entityKind="staff member"
                             onToggle={(next) => onToggleStatus(s, next)}
                           />
                         </span>
                       )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 mb-6">
                  <div className="flex items-center gap-3 text-slate-500 dark:text-zinc-400 text-[10px] font-bold">
                    <Mail size={12} className="text-seafoam" />
                    <span className="truncate">{s.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-500 dark:text-zinc-400 text-[10px] font-bold">
                    <BadgeCheck size={12} className="text-seafoam" />
                    <span className="truncate">{s.certifications?.[0] || 'No Certification'}</span>
                  </div>
                </div>

                <div className="pt-5 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                   <div className="flex -space-x-2">
                      {s.clinicIds.map(cid => (
                        <div key={cid} className="w-8 h-8 rounded-full border-2 border-white dark:border-zinc-900 bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-[10px] shadow-sm" title={clinics.find(c => c.id === cid)?.name}>
                           {clinics.find(c => c.id === cid)?.logo || '🐾'}
                        </div>
                      ))}
                   </div>
                   <div className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-400">
                      <ClipboardList size={12} />
                      {s.activityLogs?.length || 0} Actions
                   </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <button onClick={() => onViewStaff(s)} className="p-3.5 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-seafoam hover:text-white hover:bg-seafoam rounded-xl transition-all shadow-sm" title="Detailed Profile">
                  <Eye size={18} />
                </button>
                <button onClick={() => onEditStaff(s)} className="p-3.5 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-seafoam hover:text-white hover:bg-indigo-600 rounded-xl transition-all shadow-sm" title="Edit Profile">
                  <Edit size={18} />
                </button>
                <button onClick={() => onDeleteStaff(s.id)} className="p-3.5 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 text-red-400 hover:text-white hover:bg-red-500 rounded-xl transition-all shadow-sm" title="Revoke Access">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
          ))}
        </div>

        {/* Pagination */}
        <Pagination
          meta={paginationMeta}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
          showLimitSelector={true}
        />
      </div>
    </div>
  );
};

export default StaffListView;
