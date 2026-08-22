import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Star, Save } from 'lucide-react';
import { stayRatesAPI, StayRate, StayService, SizeBand } from '../../../services';
import { toast } from '../../../services';
import { dialog } from '../../../services/utils/dialog';

/**
 * Rates that vary by species and size (213).
 *
 * A clinic used to hold one number per service and charge a Great Dane what it
 * charged a kitten. Rows here are resolved MOST SPECIFIC FIRST — species+band,
 * species, band, the row starred as default, then the flat rate above. A clinic
 * that adds no rows keeps exactly today's behaviour, which is why this is an
 * addition rather than a replacement.
 *
 * Bands carry their own weight window so a patient WITH a weight is priced
 * automatically. That will be rare at first: thousands of migrated patients
 * have no weight recorded, and those fall back to the band picked at admission.
 */
const BANDS: { value: SizeBand; label: string; min: number; max: number | null }[] = [
  { value: 'SMALL',  label: 'Small',  min: 0,  max: 10 },
  { value: 'MEDIUM', label: 'Medium', min: 10, max: 25 },
  { value: 'LARGE',  label: 'Large',  min: 25, max: null },
];

// Dog and Cat are the everyday cases; the rest sit behind the same dropdown so
// the common path is two clicks and the long tail is still reachable.
const COMMON = ['Dog', 'Cat'];
const OTHERS = ['Bird', 'Rabbit', 'Sheep', 'Goat', 'Reptile', 'Tortoise', 'Horse', 'Guinea Pig', 'Hamster', 'Fish', 'Other'];

const StayRatesEditor: React.FC<{ currency?: string }> = ({ currency = 'KES' }) => {
  const [service, setService] = useState<StayService>('BOARDING');
  const [rows, setRows] = useState<StayRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<{ species: string; sizeBand: string; rate: string }>({ species: '', sizeBand: '', rate: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await stayRatesAPI.list(service);
      setRows((res?.data ?? res) || []);
    } catch { /* the list should not shout at the user */ }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [service]);

  const add = async () => {
    const rate = Number(draft.rate);
    if (!Number.isFinite(rate) || rate <= 0) { toast.error('Enter a rate'); return; }
    if (!draft.species && !draft.sizeBand) {
      toast.error('Pick a species or a size — a row matching everything is what the default is for');
      return;
    }
    const band = BANDS.find(b => b.value === draft.sizeBand);
    setSaving(true);
    try {
      await stayRatesAPI.save({
        service,
        species: draft.species || null,
        sizeBand: (draft.sizeBand || null) as SizeBand | null,
        minKg: band?.min ?? null,
        maxKg: band?.max ?? null,
        rate,
      });
      setDraft({ species: '', sizeBand: '', rate: '' });
      toast.success('Rate saved');
      load();
    } finally { setSaving(false); }
  };

  const setDefault = async (r: StayRate) => {
    await stayRatesAPI.save({ ...r, service, isDefault: true });
    toast.success('Default rate set');
    load();
  };

  const remove = async (r: StayRate) => {
    const ok = await dialog.confirm({
      title: 'Remove this rate?',
      message: `${label(r)} — admissions matching it will fall back to the next most specific rate.`,
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (!ok) return;
    await stayRatesAPI.remove(r.id);
    load();
  };

  const label = (r: StayRate) =>
    `${r.species || 'Any species'} · ${r.sizeBand ? r.sizeBand.charAt(0) + r.sizeBand.slice(1).toLowerCase() : 'Any size'}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {(['BOARDING', 'INPATIENT'] as StayService[]).map(sv => (
          <button key={sv} onClick={() => setService(sv)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
              service === sv ? 'bg-seafoam text-white' : 'bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-200'}`}>
            {sv === 'BOARDING' ? 'Boarding' : 'In-patient'}
          </button>
        ))}
      </div>

      <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium leading-relaxed">
        Most specific wins: <strong>species + size</strong> → <strong>species</strong> → <strong>size</strong> →
        the row you star as default → the flat rate above. A patient with a recorded weight is matched to a
        band automatically; one without uses the size picked at admission.
      </p>

      {loading ? (
        <p className="flex items-center gap-2 text-[11px] text-slate-400 py-4"><Loader2 size={13} className="animate-spin" /> Loading rates…</p>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-900">
              <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-3 py-2 text-left">Species</th>
                <th className="px-3 py-2 text-left">Size</th>
                <th className="px-3 py-2 text-left">Weight</th>
                <th className="px-3 py-2 text-right">Rate / night</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-4 text-[11px] text-slate-400">
                  No rates yet — every admission uses the flat rate above. Add one below to charge a Great Dane differently from a kitten.
                </td></tr>
              )}
              {rows.map(r => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-zinc-800">
                  <td className="px-3 py-2 font-bold text-pine dark:text-zinc-100">{r.species || <span className="text-slate-400 font-medium">Any</span>}</td>
                  <td className="px-3 py-2">{r.sizeBand ? r.sizeBand.charAt(0) + r.sizeBand.slice(1).toLowerCase() : <span className="text-slate-400">Any</span>}</td>
                  <td className="px-3 py-2 text-slate-500">{r.minKg != null ? `${r.minKg}${r.maxKg != null ? `–${r.maxKg}` : '+'} kg` : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono font-black text-pine dark:text-zinc-100">{currency} {r.rate.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setDefault(r)} title={r.isDefault ? 'This is the fallback rate' : 'Use as the fallback when nothing else matches'}
                        className={`p-1.5 rounded-lg ${r.isDefault ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'}`}>
                        <Star size={13} fill={r.isDefault ? 'currentColor' : 'none'} />
                      </button>
                      <button onClick={() => remove(r)} title="Remove" className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Species</label>
          <select value={draft.species} onChange={e => setDraft(d => ({ ...d, species: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs">
            <option value="">Any species</option>
            {COMMON.map(s => <option key={s} value={s}>{s}</option>)}
            <optgroup label="Other species">
              {OTHERS.map(s => <option key={s} value={s}>{s}</option>)}
            </optgroup>
          </select>
        </div>
        <div>
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Size</label>
          <select value={draft.sizeBand} onChange={e => setDraft(d => ({ ...d, sizeBand: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs">
            <option value="">Any size</option>
            {BANDS.map(b => <option key={b.value} value={b.value}>{b.label} ({b.min}{b.max != null ? `–${b.max}` : '+'} kg)</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Rate / night</label>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black text-slate-400">{currency}</span>
            <input type="number" min={0} value={draft.rate} onChange={e => setDraft(d => ({ ...d, rate: e.target.value }))}
              className="w-28 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs" />
          </div>
        </div>
        <button onClick={add} disabled={saving}
          className="px-3 py-2 rounded-xl bg-seafoam text-white text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add rate
        </button>
      </div>
    </div>
  );
};

export default StayRatesEditor;
