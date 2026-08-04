import React from 'react';
import { ClipboardList, Plus, X, Loader2, Search, Trash2 } from 'lucide-react';
import { inpatientAPI, inventoryAPI, toast } from '../../../services';
import type { TreatmentPlanSection } from '../../../services/modules/inpatient.api';

/**
 * The inpatient TREATMENT PLAN (132) — sections the clinic names itself
 * ("Medication plan", "Feeding plan", anything else), each holding planned
 * items drawn from inventory: drugs, food, any consumable.
 *
 * Replaces two free-text columns that could not be checked off, costed, or used
 * to say what is due today (user, 2026-08-04).
 *
 * ⚠️ A PLAN IS NOT A CHARGE. Nothing here bills or deducts stock —
 * administration is recorded through the MAR / consumables path, which is what
 * reaches the bill. The banner says so, because a screen that lists drugs and
 * quantities looks billable and staff must not assume it charged.
 */

interface Props {
  hospitalizationId: string | number;
  /** Discharged charts are read-only — the plan is part of the record. */
  readOnly?: boolean;
}

const SLOTS = ['AM', 'MIDDAY', 'PM', 'NIGHT'];

const TreatmentPlanPanel: React.FC<Props> = ({ hospitalizationId, readOnly }) => {
  const [sections, setSections] = React.useState<TreatmentPlanSection[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [newSection, setNewSection] = React.useState('');
  const [addingTo, setAddingTo] = React.useState<string | null>(null);
  const [q, setQ] = React.useState('');
  const [results, setResults] = React.useState<any[]>([]);
  const [draft, setDraft] = React.useState<any>({});

  const load = React.useCallback(async () => {
    try {
      const r = await inpatientAPI.getPlan(hospitalizationId);
      if (r.success && r.data) setSections(r.data.sections || []);
    } finally { setLoading(false); }
  }, [hospitalizationId]);
  React.useEffect(() => { load(); }, [load]);

  // Inventory search for the item picker. Debounced — this fires per keystroke
  // and the catalogue can be large.
  React.useEffect(() => {
    if (!addingTo || q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const r: any = await inventoryAPI.getAll({ search: q.trim(), limit: 8 } as any);
        const items = r?.data?.data ?? r?.data?.items ?? r?.data ?? [];
        setResults(Array.isArray(items) ? items.slice(0, 8) : []);
      } catch { setResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, addingTo]);

  const addSection = async () => {
    const name = newSection.trim();
    if (!name) return;
    setBusy('section');
    try {
      const r = await inpatientAPI.addPlanSection(hospitalizationId, { name });
      if (r.success && r.data?.section) { setSections(p => [...p, r.data!.section]); setNewSection(''); }
    } catch { toast.error('Could not add the section'); }
    finally { setBusy(null); }
  };

  const removeSection = async (id: string) => {
    setBusy(id);
    const prev = sections;
    setSections(p => p.filter(s => s.id !== id));
    try { await inpatientAPI.removePlanSection(hospitalizationId, id); }
    catch { setSections(prev); toast.error('Could not remove the section'); }
    finally { setBusy(null); }
  };

  const addItem = async (sectionId: string, inv?: any) => {
    const name = (inv?.name ?? draft.name ?? '').trim();
    if (!name) { toast.error('Pick an item or type a name'); return; }
    setBusy(sectionId);
    try {
      const r = await inpatientAPI.addPlanItem(hospitalizationId, sectionId, {
        inventoryItemId: inv?.id ?? null,
        name,
        quantity: draft.quantity || null,
        unit: inv?.unit ?? draft.unit ?? null,
        frequency: draft.frequency || null,
        route: draft.route || null,
        timesOfDay: draft.timesOfDay || [],
      });
      if (r.success && r.data?.item) {
        setSections(p => p.map(s => (s.id === sectionId ? { ...s, items: [...s.items, r.data!.item] } : s)));
        setDraft({}); setQ(''); setResults([]); setAddingTo(null);
      }
    } catch { toast.error('Could not add to the plan'); }
    finally { setBusy(null); }
  };

  const removeItem = async (sectionId: string, itemId: string) => {
    const prev = sections;
    setSections(p => p.map(s => (s.id === sectionId ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s)));
    try { await inpatientAPI.removePlanItem(hospitalizationId, itemId); }
    catch { setSections(prev); toast.error('Could not remove the item'); }
  };

  const toggleSlot = (slot: string) =>
    setDraft((d: any) => {
      const cur: string[] = d.timesOfDay || [];
      return { ...d, timesOfDay: cur.includes(slot) ? cur.filter(x => x !== slot) : [...cur, slot] };
    });

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-3">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest">Loading treatment plan…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 flex items-center gap-1.5">
          <ClipboardList size={12} /> Treatment plan
        </span>
        {/* Said plainly: this screen lists drugs and quantities, so it LOOKS
            billable. Nothing here charges or moves stock. */}
        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Plan only · not billed</span>
      </div>

      {sections.length === 0 && (
        <p className="text-[10px] text-slate-400 font-medium">
          No plan yet. Add a section — e.g. <em>Medication plan</em> or <em>Feeding plan</em> — then put items in it.
        </p>
      )}

      {sections.map(sec => (
        <div key={sec.id} className="rounded-xl border border-slate-100 dark:border-zinc-800 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-zinc-800/60">
            <span className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 truncate">{sec.name}</span>
            <div className="flex items-center gap-2 shrink-0">
              {busy === sec.id && <Loader2 size={11} className="animate-spin text-slate-400" />}
              {!readOnly && (
                <button type="button" onClick={() => removeSection(sec.id)} title="Remove section"
                  className="text-slate-300 dark:text-zinc-600 hover:text-rose-500"><Trash2 size={12} /></button>
              )}
            </div>
          </div>

          <div className="p-3 space-y-1.5">
            {sec.notes && <p className="text-[10px] text-slate-500 dark:text-zinc-400 italic">{sec.notes}</p>}
            {sec.items.length === 0 && !sec.notes && <p className="text-[10px] text-slate-400 italic">Nothing planned yet.</p>}

            {sec.items.map(it => (
              <div key={it.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-950/40">
                <span className="text-[11px] font-bold text-pine dark:text-zinc-100 truncate flex-1">{it.name}</span>
                {it.quantity != null && (
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">{it.quantity}{it.unit ? ` ${it.unit}` : ''}</span>
                )}
                {it.frequency && <span className="text-[9px] font-black uppercase tracking-widest text-seafoam shrink-0">{it.frequency}</span>}
                {it.timesOfDay?.length > 0 && (
                  <span className="flex gap-1 shrink-0">
                    {it.timesOfDay.map(t => (
                      <span key={t} className="px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 text-[8px] font-black uppercase">{t}</span>
                    ))}
                  </span>
                )}
                {!readOnly && (
                  <button type="button" onClick={() => removeItem(sec.id, it.id)}
                    className="shrink-0 text-slate-300 dark:text-zinc-600 hover:text-rose-500"><X size={12} /></button>
                )}
              </div>
            ))}

            {!readOnly && addingTo !== sec.id && (
              <button type="button" onClick={() => { setAddingTo(sec.id); setDraft({}); setQ(''); }}
                className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-seafoam hover:text-pine dark:hover:text-zinc-100">
                <Plus size={12} /> Add item
              </button>
            )}

            {!readOnly && addingTo === sec.id && (
              <div className="space-y-2 pt-1">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input autoFocus value={q} onChange={e => { setQ(e.target.value); setDraft((d: any) => ({ ...d, name: e.target.value })); }}
                    placeholder="Search inventory, or type a free-text item…"
                    className="field-input py-1.5 pl-8 text-xs w-full" />
                </div>
                {results.length > 0 && (
                  <div className="max-h-36 overflow-y-auto custom-scrollbar rounded-lg border border-slate-100 dark:border-zinc-800 divide-y divide-slate-50 dark:divide-zinc-800/60">
                    {results.map((inv: any) => (
                      <button key={String(inv.id)} type="button" onClick={() => addItem(sec.id, inv)}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{inv.name}</span>
                        <span className="text-[9px] text-slate-400 shrink-0">{Number(inv.quantity ?? 0)} {inv.unit || ''}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <input value={draft.quantity ?? ''} onChange={e => setDraft((d: any) => ({ ...d, quantity: e.target.value }))}
                    placeholder="Qty" type="number" min={0} step="0.001" className="field-input py-1 text-[11px] w-20" />
                  <input value={draft.frequency ?? ''} onChange={e => setDraft((d: any) => ({ ...d, frequency: e.target.value }))}
                    placeholder="Frequency (BID, q8h…)" className="field-input py-1 text-[11px] flex-1 min-w-[130px]" />
                  <input value={draft.route ?? ''} onChange={e => setDraft((d: any) => ({ ...d, route: e.target.value }))}
                    placeholder="Route" className="field-input py-1 text-[11px] w-24" />
                </div>
                <div className="flex flex-wrap gap-1">
                  {SLOTS.map(sl => (
                    <button key={sl} type="button" onClick={() => toggleSlot(sl)}
                      className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${(draft.timesOfDay || []).includes(sl)
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'}`}>{sl}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => addItem(sec.id)} disabled={busy === sec.id}
                    className="px-3 py-1.5 rounded-lg bg-pine text-white text-[9px] font-black uppercase tracking-widest hover:bg-pine/90 disabled:opacity-50">
                    Add to plan
                  </button>
                  <button type="button" onClick={() => { setAddingTo(null); setDraft({}); setQ(''); setResults([]); }}
                    className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-pine dark:hover:text-zinc-100">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {!readOnly && (
        <div className="flex gap-2">
          <input value={newSection} onChange={e => setNewSection(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addSection(); }}
            placeholder="New section — e.g. Medication plan"
            className="field-input py-1.5 text-xs flex-1" />
          <button type="button" onClick={addSection} disabled={busy === 'section' || !newSection.trim()}
            className="px-3 py-1.5 rounded-lg bg-seafoam text-white text-[9px] font-black uppercase tracking-widest hover:bg-seafoam/90 disabled:opacity-50 shrink-0">
            {busy === 'section' ? <Loader2 size={12} className="animate-spin" /> : 'Add section'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TreatmentPlanPanel;
