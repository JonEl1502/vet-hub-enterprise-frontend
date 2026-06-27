import React, { useEffect, useMemo, useState } from 'react';
import { X, AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { clientsAPI, DuplicateGroup, dialog } from '../../../services';
import LoadingSpinner from '../../shared/common/LoadingSpinner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAfterDelete?: () => void;
}

const DuplicateClientsModal: React.FC<Props> = ({ isOpen, onClose, onAfterDelete }) => {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [cascadePets, setCascadePets] = useState(true); // default ON — dupes typically share pets

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await clientsAPI.duplicates();
      if (res.success) {
        setGroups(res.data.groups);
        // Default selection: every record EXCEPT the oldest in each group
        // (oldest is most likely the original; later imports are the dupes).
        const next: Record<string, boolean> = {};
        for (const g of res.data.groups) {
          for (let i = 1; i < g.clients.length; i++) {
            next[g.clients[i].id] = true;
          }
        }
        setSelected(next);
      } else {
        setError('Failed to load duplicates');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load duplicates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) load();
    else {
      setGroups([]);
      setSelected({});
      setProgress(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);

  const toggle = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    const petsNote = cascadePets ? ' and ALL their pets' : '';
    const ok = await dialog.confirm({
      title: `Delete ${selectedIds.length} duplicate${selectedIds.length === 1 ? '' : 's'}?`,
      message: `${selectedIds.length} client${selectedIds.length === 1 ? '' : 's'}${petsNote} will be soft-deleted. Support can reverse this if needed.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    setDeleting(true);
    setProgress({ done: 0, total: selectedIds.length });
    let done = 0;
    let failed = 0;
    let petsDeletedTotal = 0;
    for (const id of selectedIds) {
      try {
        const res = await clientsAPI.delete(Number(id), { cascadePets });
        if (res?.data?.petsDeleted) petsDeletedTotal += res.data.petsDeleted;
      } catch {
        failed++;
      }
      done++;
      setProgress({ done, total: selectedIds.length });
    }
    setDeleting(false);
    setProgress(null);
    if (failed > 0) setError(`${failed} client${failed === 1 ? '' : 's'} could not be deleted`);
    if (cascadePets && petsDeletedTotal > 0) {
      setError((prev) => prev || `Cleaned up ${petsDeletedTotal} pet${petsDeletedTotal === 1 ? '' : 's'} along with the clients.`);
    }
    onAfterDelete?.();
    await load();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            <h2 className="text-base font-black text-pine dark:text-zinc-100 uppercase tracking-wider">
              Duplicate Clients
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-16"><LoadingSpinner message="Scanning clients…" /></div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-semibold">{error}</div>
          ) : groups.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-2xl mb-2">✨</p>
              <p className="text-sm font-bold text-slate-500">No duplicates found in this clinic.</p>
              <p className="text-xs text-slate-400 mt-2">Detection groups by phone number and email.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-bold text-slate-500">
                Found {groups.length} duplicate group{groups.length === 1 ? '' : 's'}. Selected entries will be soft-deleted.
                The oldest record in each group is unchecked by default.
              </p>
              {groups.map((g) => (
                <div key={g.key} className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-zinc-800 px-4 py-2.5 border-b border-slate-200 dark:border-zinc-700">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300">
                      Same {g.reason}: <span className="font-mono normal-case">{g.keyValue}</span>
                    </p>
                    <p className="text-xs font-bold text-slate-400">{g.clients.length} records</p>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {g.clients.map((c, idx) => {
                      const isOldest = idx === 0;
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800 ${selected[c.id] ? 'bg-rose-50/50 dark:bg-rose-900/10' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={!!selected[c.id]}
                            onChange={() => toggle(c.id)}
                            className="w-4 h-4 accent-rose-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">
                              {[c.title, c.firstName, c.secondName, c.surname].filter(Boolean).join(' ')}
                              {isOldest && (
                                <span className="ml-2 text-[9px] font-bold text-emerald-600 uppercase tracking-widest">oldest</span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {c.phone}
                              {c.email ? ` · ${c.email}` : ''}
                              {c.totalSpent ? ` · KES ${Number(c.totalSpent).toLocaleString()}` : ''}
                            </p>
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                            joined {new Date(c.createdAt).toLocaleDateString()}
                          </p>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 px-6 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800">
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-500">
              {progress
                ? `Deleting ${progress.done} / ${progress.total}…`
                : `${selectedIds.length} selected`}
            </p>
            <label className="inline-flex items-center gap-1.5 mt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={cascadePets}
                onChange={(e) => setCascadePets(e.target.checked)}
                className="w-3.5 h-3.5 accent-rose-500"
              />
              <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-300">
                Also delete their pets
              </span>
            </label>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onClose}
              disabled={deleting}
              className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting || selectedIds.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest bg-rose-500 hover:bg-rose-600 text-white shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Delete {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DuplicateClientsModal;
