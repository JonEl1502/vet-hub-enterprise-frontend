import React, { useEffect, useMemo, useState } from 'react';
import { Bug, Plus, Loader2, Check, Search, Package, CalendarClock, Printer, Trash2 } from 'lucide-react';
import { StepProps } from '../types';
import { Section, L } from '../fields';
import { useData } from '../../../../../contexts/DataContext';
import { dewormingAPI, DewormingRecord, toast } from '../../../../../services';
import { printElementAsPdf } from '../../../shared/printPdf';

const WORM_TYPES = ['Broad-spectrum', 'Roundworm', 'Tapeworm', 'Hookworm', 'Whipworm', 'Heartworm'];
const ROUTES = ['PO (oral)', 'Topical (spot-on)', 'SC', 'IM'];

// Typical follow-up cadence — the vet picks; these seed the next-due date.
const NEXT_DUE_PRESETS: { label: string; days: number }[] = [
  { label: '+2 weeks', days: 14 },
  { label: '+1 month', days: 30 },
  { label: '+3 months', days: 91 },
  { label: '+6 months', days: 182 },
];

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return ymd(d); };
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/**
 * Deworming protocol step — record the dewormer given (optionally from stock,
 * which deducts on administer), set the follow-up next-due (auto-schedules a
 * DEWORMING reminder), view the patient's deworming timeline, and print a
 * deworming certificate.
 */
const DewormingStep: React.FC<StepProps> = ({ visit, pet, emit, refreshVisit }) => {
  const { inventory, ensureInventory } = useData() as any;
  useEffect(() => { ensureInventory?.(); }, [ensureInventory]);

  const [visitRecords, setVisitRecords] = useState<DewormingRecord[]>([]);
  const [timeline, setTimeline] = useState<DewormingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const petWeight = (pet as any).weightValue ?? (pet as any).weight ?? '';
  const [draft, setDraft] = useState({
    productName: '', itemId: '' as string, activeIngredient: '', wormType: 'Broad-spectrum',
    weightKg: petWeight ? String(petWeight).replace(/[^0-9.]/g, '') : '', doseGiven: '', route: 'PO (oral)',
    nextDueAt: addDays(91),
  });
  const [productSearch, setProductSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [v, t] = await Promise.all([
        dewormingAPI.list({ appointmentId: visit.id }),
        dewormingAPI.list({ petId: visit.petId }),
      ]);
      if (v.success && v.data?.records) setVisitRecords(v.data.records);
      if (t.success && t.data?.records) setTimeline(t.data.records);
    } catch (e) { console.error('deworming load failed', e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [visit.id, visit.petId]);

  const matches = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return (inventory || []).filter((i: any) => `${i.name} ${i.category ?? ''}`.toLowerCase().includes(q)).slice(0, 6);
  }, [inventory, productSearch]);

  const pickProduct = (i: any) => {
    setDraft(d => ({ ...d, productName: i.name, itemId: String(i.id) }));
    setProductSearch(i.name);
    setSearchFocus(false);
  };

  const add = async () => {
    const name = (draft.productName || productSearch).trim();
    if (!name) { toast.error('Enter or pick a dewormer'); return; }
    setAdding(true);
    try {
      const res = await dewormingAPI.create({
        petId: visit.petId, appointmentId: visit.id, productName: name,
        activeIngredient: draft.activeIngredient || undefined, wormType: draft.wormType,
        inventoryItemId: draft.itemId || undefined, doseGiven: draft.doseGiven || undefined,
        weightKg: draft.weightKg ? Number(draft.weightKg) : undefined, route: draft.route,
        nextDueAt: draft.nextDueAt || undefined,
      });
      if (res.success) {
        toast.success('Deworming recorded');
        emit(`Deworming planned — ${name}`, 'action', true);
        setDraft(d => ({ ...d, productName: '', itemId: '', activeIngredient: '', doseGiven: '' }));
        setProductSearch('');
        await load();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to record'); }
    finally { setAdding(false); }
  };

  const administer = async (r: DewormingRecord) => {
    setBusyId(r.id);
    try {
      const res = await dewormingAPI.administer(r.id, {
        inventoryItemId: r.inventoryItemId || undefined,
        nextDueAt: r.nextDueAt || draft.nextDueAt,
        weightKg: r.weightKg ?? (draft.weightKg ? Number(draft.weightKg) : undefined),
      });
      if (res.success) {
        toast.success(`Administered · ${r.nextDueAt || draft.nextDueAt ? 'follow-up reminder scheduled' : 'no follow-up set'}`);
        emit(`Deworming given — ${r.productName}${(r.nextDueAt || draft.nextDueAt) ? `, next due ${fmtDate(r.nextDueAt || draft.nextDueAt)}` : ''}`, 'billing', true);
        await load();
        refreshVisit?.();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to administer'); }
    finally { setBusyId(null); }
  };

  const remove = async (r: DewormingRecord) => {
    setBusyId(r.id);
    try { const res = await dewormingAPI.remove(r.id); if (res.success) { toast.success('Removed'); await load(); } }
    catch (e: any) { toast.error(e?.message || 'Failed to remove'); }
    finally { setBusyId(null); }
  };

  const administered = timeline.filter(r => r.status === 'ADMINISTERED');
  const upcoming = timeline.filter(r => r.status !== 'ADMINISTERED' && r.nextDueAt);

  return (
    <div className="space-y-4">
      <Section icon={Bug} title="Deworming Protocol">
        {/* Add-deworming form */}
        <div className="bg-slate-50 dark:bg-zinc-950 border border-dashed border-slate-300 dark:border-zinc-700 rounded-xl p-3 space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
            <L label="Dewormer" className="col-span-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="field-input !pl-8" placeholder="Search inventory or type a product…" value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setDraft(d => ({ ...d, productName: e.target.value, itemId: '' })); }}
                  onFocus={() => setSearchFocus(true)} onBlur={() => setTimeout(() => setSearchFocus(false), 150)} />
                {searchFocus && matches.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden">
                    {matches.map((i: any) => (
                      <button key={i.id} type="button" onMouseDown={() => pickProduct(i)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-seafoam/5">
                        <Package size={11} className="text-seafoam shrink-0" />
                        <span className="flex-1 text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{i.name}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{i.quantity} {i.unit}</span>
                      </button>
                    ))}
                  </div>
                )}
                {draft.itemId && <p className="text-[9px] font-black text-seafoam mt-0.5 px-1">✓ deducts stock on administer</p>}
              </div>
            </L>
            <L label="Worm coverage"><select className="field-select" value={draft.wormType} onChange={e => setDraft(d => ({ ...d, wormType: e.target.value }))}>{WORM_TYPES.map(w => <option key={w}>{w}</option>)}</select></L>
            <L label="Route"><select className="field-select" value={draft.route} onChange={e => setDraft(d => ({ ...d, route: e.target.value }))}>{ROUTES.map(r => <option key={r}>{r}</option>)}</select></L>
            <L label={`Weight (kg)`}><input type="number" min={0} step={0.1} className="field-input" value={draft.weightKg} onChange={e => setDraft(d => ({ ...d, weightKg: e.target.value }))} /></L>
            <L label="Dose given"><input className="field-input" placeholder="1 tab / 2 ml" value={draft.doseGiven} onChange={e => setDraft(d => ({ ...d, doseGiven: e.target.value }))} /></L>
            <L label="Next due"><input type="date" className="field-input" value={draft.nextDueAt} onChange={e => setDraft(d => ({ ...d, nextDueAt: e.target.value }))} /></L>
            <button type="button" disabled={adding} onClick={add} className="h-9 self-end px-3 bg-seafoam text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-pine disabled:opacity-50 flex items-center justify-center gap-1.5">
              {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={13} />} Add
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Follow-up:</span>
            {NEXT_DUE_PRESETS.map(p => (
              <button key={p.label} type="button" onClick={() => setDraft(d => ({ ...d, nextDueAt: addDays(p.days) }))}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${draft.nextDueAt === addDays(p.days) ? 'bg-seafoam/10 text-seafoam border-seafoam/40' : 'bg-white dark:bg-zinc-900 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>{p.label}</button>
            ))}
          </div>
        </div>

        {/* This visit's dewormings */}
        {loading ? <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-seafoam" /></div>
          : visitRecords.length === 0 ? <p className="text-[11px] text-slate-400 text-center py-3">No dewormings on this visit yet.</p>
          : (
            <div className="space-y-1.5">
              {visitRecords.map(r => (
                <div key={r.id} className="flex items-center gap-2 px-2.5 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg">
                  <Bug size={13} className="text-emerald-500 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-pine dark:text-zinc-100 truncate">{r.productName}</span>
                    <span className="block text-[9px] text-slate-400">{r.wormType || '—'}{r.doseGiven ? ` · ${r.doseGiven}` : ''}{r.nextDueAt ? ` · next ${fmtDate(r.nextDueAt)}` : ''}{r.batchNumber ? ` · batch ${r.batchNumber}` : ''}</span>
                  </span>
                  {r.status === 'ADMINISTERED'
                    ? <span className="shrink-0 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-600"><Check size={11} /> Given</span>
                    : <button type="button" disabled={busyId === r.id} onClick={() => administer(r)} className="shrink-0 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white disabled:opacity-50">{busyId === r.id ? <Loader2 size={11} className="animate-spin" /> : 'Administer'}</button>}
                  <button type="button" disabled={busyId === r.id} onClick={() => remove(r)} className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-500"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}
      </Section>

      {/* Timeline */}
      <Section icon={CalendarClock} title="Deworming Timeline">
        {administered.length === 0 && upcoming.length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-3">No deworming history for {pet.name} yet.</p>
        ) : (
          <div className="space-y-0.5">
            {upcoming.map(r => (
              <div key={`u-${r.id}`} className="relative pl-6 pb-3">
                <span className="absolute left-[7px] top-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-4 ring-amber-400/15" />
                <p className="text-[11px] font-black text-amber-600 uppercase tracking-wide">Due {fmtDate(r.nextDueAt)}</p>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400">{r.productName} · {r.wormType || 'deworming'}</p>
              </div>
            ))}
            {administered.map((r, i) => (
              <div key={`a-${r.id}`} className="relative pl-6 pb-3">
                {i < administered.length - 1 && <span className="absolute left-[11px] top-4 bottom-0 w-px bg-slate-200 dark:bg-zinc-700" />}
                <span className="absolute left-[7px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/15" />
                <p className="text-[11px] font-black text-pine dark:text-zinc-100">{fmtDate(r.dewormedAt)}</p>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400">{r.productName}{r.wormType ? ` · ${r.wormType}` : ''}{r.weightKg ? ` · ${r.weightKg}kg` : ''}{r.administeredByName ? ` · ${r.administeredByName}` : ''}</p>
              </div>
            ))}
          </div>
        )}
        {administered.length > 0 && (
          <button type="button" onClick={() => printElementAsPdf('deworming-cert', `Deworming Certificate — ${pet.name}`, false)}
            className="mt-2 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pine text-white text-[10px] font-black uppercase tracking-widest hover:bg-pine/90">
            <Printer size={12} /> Deworming certificate (PDF)
          </button>
        )}
      </Section>

      {/* Hidden printable certificate */}
      <div className="hidden">
        <div id="deworming-cert" style={{ padding: '32px', fontFamily: 'Georgia, serif', color: '#1a1a1a', maxWidth: '720px' }}>
          <div style={{ textAlign: 'center', borderBottom: '3px solid #144E35', paddingBottom: '16px', marginBottom: '20px' }}>
            <h1 style={{ margin: 0, fontSize: '26px', letterSpacing: '2px', color: '#144E35' }}>DEWORMING CERTIFICATE</h1>
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#666' }}>Issued by the attending veterinary clinic</p>
          </div>
          <table style={{ width: '100%', fontSize: '13px', marginBottom: '18px' }}>
            <tbody>
              <tr><td style={{ padding: '4px 0', fontWeight: 700, width: '140px' }}>Patient</td><td>{pet.name} · {pet.species}{pet.breed ? ` (${pet.breed})` : ''}</td></tr>
              <tr><td style={{ padding: '4px 0', fontWeight: 700 }}>Issued</td><td>{fmtDate(new Date().toISOString())}</td></tr>
            </tbody>
          </table>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #144E35', textAlign: 'left' }}>
                <th style={{ padding: '6px 4px' }}>Date</th><th style={{ padding: '6px 4px' }}>Product</th><th style={{ padding: '6px 4px' }}>Coverage</th><th style={{ padding: '6px 4px' }}>Batch</th><th style={{ padding: '6px 4px' }}>Next due</th>
              </tr>
            </thead>
            <tbody>
              {administered.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '6px 4px' }}>{fmtDate(r.dewormedAt)}</td>
                  <td style={{ padding: '6px 4px' }}>{r.productName}</td>
                  <td style={{ padding: '6px 4px' }}>{r.wormType || '—'}</td>
                  <td style={{ padding: '6px 4px' }}>{r.batchNumber || '—'}</td>
                  <td style={{ padding: '6px 4px' }}>{fmtDate(r.nextDueAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: '28px', fontSize: '11px', color: '#666' }}>This certifies the above deworming treatments were administered to the named patient. Keep for travel, boarding and licensing records.</p>
        </div>
      </div>
    </div>
  );
};

export default DewormingStep;
