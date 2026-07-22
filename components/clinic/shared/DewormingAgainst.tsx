import React, { useEffect, useState } from 'react';
import { Bug, Loader2, Check } from 'lucide-react';
import { dewormingAPI, DewormingRecord } from '../../../services';

/**
 * Compact "dewormed against" capture for a deworming service on a normal
 * visit — no full workflow. A deworming_record already auto-exists for the
 * task (category trigger); this reads it and lets the vet mark the coverage:
 * General (broad-spectrum) or specific worms. Saves to record.wormType.
 */

const GENERAL = 'Broad-spectrum';
const SPECIFIC = ['Roundworm', 'Tapeworm', 'Hookworm', 'Whipworm', 'Heartworm'];

const DewormingAgainst: React.FC<{ appointmentId: string | number; taskId: string | number; locked?: boolean }> = ({ appointmentId, taskId, locked }) => {
  const [record, setRecord] = useState<DewormingRecord | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    dewormingAPI.list({ appointmentId }).then(r => {
      if (!live) return;
      const rec = (r.data?.records || []).find(x => String(x.taskId) === String(taskId)) || null;
      setRecord(rec);
      setSelected(rec?.wormType ? rec.wormType.split(',').map(s => s.trim()).filter(Boolean) : []);
    }).catch(() => {}).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [appointmentId, taskId]);

  const save = async (next: string[]) => {
    setSelected(next);
    if (!record) return;
    setSaving(true);
    try { await dewormingAPI.update(record.id, { wormType: next.join(', ') }); }
    catch { /* non-fatal */ }
    finally { setSaving(false); }
  };

  const toggle = (worm: string) => {
    if (locked) return;
    if (worm === GENERAL) { save(selected.includes(GENERAL) ? [] : [GENERAL]); return; }
    // Picking a specific worm clears the General flag.
    const base = selected.filter(w => w !== GENERAL);
    save(base.includes(worm) ? base.filter(w => w !== worm) : [...base, worm]);
  };

  if (loading) return null;
  if (!record) return null; // no deworming record for this task

  const chip = (worm: string) => {
    const on = selected.includes(worm);
    return (
      <button key={worm} type="button" disabled={locked} onClick={() => toggle(worm)}
        className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all disabled:opacity-60 ${on ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/40' : 'bg-white dark:bg-zinc-900 text-slate-400 border-slate-200 dark:border-zinc-700 hover:border-emerald-400'}`}>
        {on && <Check size={9} className="inline mr-0.5" />}{worm === GENERAL ? 'General' : worm}
      </button>
    );
  };

  return (
    <div className="mt-2 px-2.5 py-2 bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-200/50 dark:border-emerald-900/30 rounded-lg space-y-1.5">
      <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
        <Bug size={11} /> Dewormed against {saving && <Loader2 size={10} className="animate-spin" />}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {chip(GENERAL)}
        <span className="w-px self-stretch bg-emerald-200 dark:bg-emerald-900/40 mx-0.5" />
        {SPECIFIC.map(chip)}
      </div>
    </div>
  );
};

export default DewormingAgainst;
