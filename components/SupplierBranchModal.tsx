import React from 'react';
import { Check, Building2, MapPin, Phone, Plus, Star } from 'lucide-react';
import { useSupplierBranch } from '../contexts/SupplierBranchContext';
import { useAuth } from '../contexts/AuthContext';

interface SupplierBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onManageBranches?: () => void;
}

const MAIN_BRANCH_ID = '__main__';

const SupplierBranchModal: React.FC<SupplierBranchModalProps> = ({
  isOpen,
  onClose,
  onManageBranches,
}) => {
  const { user } = useAuth();
  const { branches, activeBranchIds, setActiveBranchIds } = useSupplierBranch();

  if (!isOpen) return null;

  const allIds = [MAIN_BRANCH_ID, ...branches.map((b) => b.id)];

  const toggleBranch = (id: string) => {
    setActiveBranchIds(
      activeBranchIds.includes(id)
        ? activeBranchIds.filter((x) => x !== id)
        : [...activeBranchIds, id]
    );
  };

  const selectAll = () => setActiveBranchIds(allIds);
  const clearAll = () => setActiveBranchIds([]);

  return (
    <div
      className="fixed inset-0 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-2xl z-[1000] flex flex-col items-center justify-center p-8 overflow-y-auto animate-in fade-in duration-300"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-w-5xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h2 className="text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase">
            Switch Branch
          </h2>
          <p className="text-seafoam text-[10px] font-black uppercase tracking-[0.4em]">
            Select branches to view metrics from
          </p>
          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              onClick={selectAll}
              className="text-xs font-black uppercase text-seafoam hover:opacity-80 transition-opacity"
            >
              All
            </button>
            <span className="text-slate-300 dark:text-zinc-700">·</span>
            <button
              onClick={clearAll}
              className="text-xs font-black uppercase text-slate-400 hover:text-pine dark:hover:text-zinc-300 transition-colors"
            >
              None
            </button>
            <span className="text-slate-300 dark:text-zinc-700">·</span>
            <span className="text-xs font-bold text-slate-400 dark:text-zinc-500">
              {activeBranchIds.length} of {allIds.length} selected
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-6">
          {/* Main Branch card */}
          {user?.supplier && (() => {
            const isActive = activeBranchIds.includes(MAIN_BRANCH_ID);
            return (
              <button
                key={MAIN_BRANCH_ID}
                onClick={() => toggleBranch(MAIN_BRANCH_ID)}
                className={`relative p-6 rounded-xl border-2 transition-all hover:scale-[1.02] active:scale-95 group text-left ${
                  isActive
                    ? 'bg-white dark:bg-zinc-900 border-seafoam shadow-xl'
                    : 'bg-white/5 dark:bg-zinc-900/40 border-slate-200 dark:border-zinc-800 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex justify-between items-start mb-5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                    isActive ? 'bg-seafoam' : 'bg-slate-100 dark:bg-zinc-800'
                  }`}>
                    <Building2 size={22} className={isActive ? 'text-white' : 'text-slate-400 dark:text-zinc-500'} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-pine/10 text-pine dark:bg-zinc-800 dark:text-zinc-300 flex items-center gap-1">
                      <Star size={9} /> Main
                    </span>
                    {isActive && (
                      <div className="w-6 h-6 bg-seafoam rounded-full flex items-center justify-center shadow-md">
                        <Check size={12} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="font-black text-pine dark:text-zinc-100 text-sm uppercase tracking-tight leading-tight">
                    {user.supplier.name}
                  </h3>
                  {user.supplier.address && (
                    <div className="flex items-center gap-1 text-slate-500 dark:text-zinc-400">
                      <MapPin size={11} />
                      <span className="text-[11px] font-semibold">{user.supplier.address}</span>
                    </div>
                  )}
                  {user.supplier.contactPhone && (
                    <div className="flex items-center gap-1 text-slate-500 dark:text-zinc-400">
                      <Phone size={11} />
                      <span className="text-[11px] font-semibold">{user.supplier.contactPhone}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                    Active
                  </span>
                </div>
              </button>
            );
          })()}

          {/* Additional branch cards */}
          {branches.map((branch) => {
            const isActive = activeBranchIds.includes(branch.id);
            return (
              <button
                key={branch.id}
                onClick={() => toggleBranch(branch.id)}
                className={`relative p-6 rounded-xl border-2 transition-all hover:scale-[1.02] active:scale-95 group text-left ${
                  isActive
                    ? 'bg-white dark:bg-zinc-900 border-seafoam shadow-xl'
                    : 'bg-white/5 dark:bg-zinc-900/40 border-slate-200 dark:border-zinc-800 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex justify-between items-start mb-5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                    isActive ? 'bg-seafoam' : 'bg-slate-100 dark:bg-zinc-800'
                  }`}>
                    <Building2 size={22} className={isActive ? 'text-white' : 'text-slate-400 dark:text-zinc-500'} />
                  </div>
                  {isActive && (
                    <div className="w-6 h-6 bg-seafoam rounded-full flex items-center justify-center shadow-md">
                      <Check size={12} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="font-black text-pine dark:text-zinc-100 text-sm uppercase tracking-tight leading-tight">
                    {branch.name}
                  </h3>
                  {(branch.city || branch.country) && (
                    <div className="flex items-center gap-1 text-slate-500 dark:text-zinc-400">
                      <MapPin size={11} />
                      <span className="text-[11px] font-semibold">{[branch.city, branch.country].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-1 text-slate-500 dark:text-zinc-400">
                      <Phone size={11} />
                      <span className="text-[11px] font-semibold">{branch.phone}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                    branch.isActive
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500'
                  }`}>
                    {branch.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </button>
            );
          })}

          {/* Empty state (no additional branches) */}
          {branches.length === 0 && onManageBranches && (
            <button
              onClick={() => { onClose(); onManageBranches(); }}
              className="p-6 rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-seafoam hover:border-seafoam transition-all"
            >
              <Plus size={22} />
              <span className="text-xs font-black uppercase tracking-wider">Add Branch</span>
            </button>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-center gap-4 pt-2">
          {onManageBranches && branches.length > 0 && (
            <button
              onClick={() => { onClose(); onManageBranches(); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-200 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
            >
              <Plus size={13} />
              Manage Branches
            </button>
          )}
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-pine dark:bg-zinc-100 text-white dark:text-pine rounded-xl font-black text-xs uppercase tracking-wider hover:opacity-90 transition-all shadow-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupplierBranchModal;
