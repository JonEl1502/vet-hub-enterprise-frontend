import React, { useMemo, useState } from 'react';
import { Users, Plus, X, Loader2, Star, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { visitsAPI } from '../../../services';
import { TaskAttendee } from '../../../types';

/**
 * Who actually performed a visit service (backend 106).
 *
 * A real procedure has a surgeon, an assistant and a nurse; the line only ever
 * had one `assignedStaffId`. `visit_task_staff` has existed since 106 with 178
 * backfilled rows in prod, but nothing read or wrote it until now.
 *
 * The FEE here is INTERNAL clinic cost — what the practice pays its people. It
 * is deliberately never added to the client's invoice, and nothing in this
 * component sums it into a client-facing total. Charging for a second attendee
 * stays an explicit FEE line on the bill.
 */

interface Props {
  visitId: number;
  taskId: number;
  attendance: TaskAttendee[];
  staff: { id: number | string; name: string; role?: string }[];
  /** Billed / finalized visits are read-only, matching the server. */
  locked?: boolean;
  onChanged: (attendance: TaskAttendee[]) => void;
}

const AttendingStaffEditor: React.FC<Props> = ({ visitId, taskId, attendance, staff, locked, onChanged }) => {
  const [rows, setRows] = useState<TaskAttendee[]>(attendance || []);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);

  const available = useMemo(
    () => staff.filter(s => !rows.some(r => String(r.userId) === String(s.id))),
    [staff, rows],
  );

  const persist = async (next: TaskAttendee[]) => {
    setRows(next);
    setSaving(true);
    try {
      const res = await visitsAPI.setTaskAttendance(
        visitId, taskId,
        next.map(r => ({ userId: r.userId, role: r.role ?? null, fee: r.fee ?? null, isLead: !!r.isLead })),
      );
      if (res.success && res.data?.attendance) {
        setRows(res.data.attendance);
        onChanged(res.data.attendance);
      } else {
        toast.error(res.message || 'Could not save attending staff');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Could not save attending staff');
    } finally {
      setSaving(false);
    }
  };

  const add = (s: { id: number | string; name: string; role?: string }) => {
    setAdding(false);
    // First person added is the lead by default — the common case is one
    // person, and making them lead avoids a second click.
    persist([...rows, { userId: String(s.id), name: s.name, role: s.role ?? null, fee: null, isLead: rows.length === 0 }]);
  };

  const remove = (userId: string) => persist(rows.filter(r => String(r.userId) !== String(userId)));

  const setLead = (userId: string) =>
    persist(rows.map(r => ({ ...r, isLead: String(r.userId) === String(userId) })));

  const patchRow = (userId: string, patch: Partial<TaskAttendee>) =>
    setRows(rows.map(r => (String(r.userId) === String(userId) ? { ...r, ...patch } : r)));

  return (
    <div className="border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <Users size={12} className="text-slate-400" />
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex-1">
          Attending staff{rows.length > 1 ? ` · ${rows.length}` : ''}
        </p>
        {saving && <Loader2 size={11} className="animate-spin text-slate-400" />}
        {locked && <Lock size={11} className="text-slate-400" />}
      </div>

      {rows.map(r => (
        <div key={String(r.userId)} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
          <button
            type="button"
            disabled={locked}
            title={r.isLead ? 'Lead' : 'Make lead'}
            onClick={() => setLead(String(r.userId))}
            className={`shrink-0 ${r.isLead ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'} disabled:opacity-50`}
          >
            <Star size={12} fill={r.isLead ? 'currentColor' : 'none'} />
          </button>
          <span className="flex-1 min-w-0 text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{r.name || `Staff #${r.userId}`}</span>
          <input
            className="field-input !h-7 !text-[10px] w-24"
            placeholder="Role"
            disabled={locked}
            defaultValue={r.role ?? ''}
            onBlur={e => { const v = e.target.value.trim() || null; if (v !== (r.role ?? null)) persist(rows.map(x => String(x.userId) === String(r.userId) ? { ...x, role: v } : x)); }}
          />
          <input
            className="field-input !h-7 !text-[10px] w-20"
            type="number"
            placeholder="Fee"
            title="Internal staff cost — never billed to the client"
            disabled={locked}
            defaultValue={r.fee ?? ''}
            onChange={e => patchRow(String(r.userId), { fee: e.target.value === '' ? null : Number(e.target.value) })}
            onBlur={() => persist(rows)}
          />
          {!locked && (
            <button type="button" onClick={() => remove(String(r.userId))} className="text-slate-300 hover:text-red-500 shrink-0">
              <X size={12} />
            </button>
          )}
        </div>
      ))}

      {!rows.length && <p className="text-[10px] text-slate-400">No one recorded yet.</p>}

      {!locked && (
        adding ? (
          <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-lg">
            {available.map(s => (
              <button
                key={String(s.id)}
                type="button"
                onClick={() => add(s)}
                className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-pine dark:text-zinc-100 hover:bg-seafoam/5 border-b border-slate-100 dark:border-zinc-800/60 last:border-0"
              >
                {s.name}
                {s.role && <span className="ml-1.5 text-[9px] text-slate-400">{s.role}</span>}
              </button>
            ))}
            {!available.length && <p className="px-2.5 py-2 text-[10px] text-slate-400">Everyone is already on this service.</p>}
            <button type="button" onClick={() => setAdding(false)} className="w-full px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-pine border-t border-slate-100 dark:border-zinc-800">
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-seafoam hover:underline"
          >
            <Plus size={11} /> Add staff
          </button>
        )
      )}

      <p className="text-[9px] text-slate-400 leading-relaxed">
        Fees here are internal clinic cost — they are never added to the client’s bill.
      </p>
    </div>
  );
};

export default AttendingStaffEditor;
