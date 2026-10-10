/**
 * Breeding & milking for ONE animal.
 *
 * Marking her pregnant asks WHEN — the date she was served (or the due date, if
 * that is what you know) — because that one date gives the rest: when she is
 * due, when to stop milking her (dry-off, ~60 days before calving for dairy
 * cattle and goats) and when milking starts again (calving). The server does the
 * arithmetic (`farmRepro.ts`); this shows it and lets the farmer correct it.
 *
 * "Not sure" is a real answer: she is marked pregnant, no dates are invented,
 * and the card says what to add to see them.
 */
import React, { useState } from 'react';
import { Baby, Milk, CalendarClock, Droplet, PartyPopper } from 'lucide-react';
import { clientPortalAPI, type FarmAnimal } from '../../../services/modules/clientPortal.api';
import { toast } from '../../../services';
import CpModal from '../CpModal';
import { Chip, SubmitButton, localToday } from './AnimalRecordForms';
import type { SpeciesConfig } from './farmSpecies';

const DAY = 86_400_000;
const parse = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`);
const iso = (d: Date) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const plus = (isoDate: string, n: number) => iso(new Date(parse(isoDate).getTime() + n * DAY));
export const fmtDay = (s: string) => parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** "today", "in 5 days", "in 3 weeks", "2 months ago" — how a farmer says it. */
export const rel = (n: number | null): string => {
  if (n == null) return '';
  if (n === 0) return 'today';
  const a = Math.abs(n);
  const unit = a === 1 ? '1 day' : a < 14 ? `${a} days` : a < 84 ? `${Math.round(a / 7)} weeks` : `${Math.round(a / 30)} months`;
  return n > 0 ? (a === 1 ? 'tomorrow' : `in ${unit}`) : (a === 1 ? 'yesterday' : `${unit} ago`);
};

/** What the farmer calls it when she gives birth. */
const birthVerb = (species: string) =>
  /goat/i.test(species) ? 'kidded' : /sheep|ewe/i.test(species) ? 'lambed' : /pig|sow/i.test(species) ? 'farrowed' : /camel/i.test(species) ? 'calved' : /donkey|horse/i.test(species) ? 'foaled' : 'calved';

type Sheet = null | 'PREGNANT' | 'CALVED' | 'MILKING' | 'DRYOFF';

const AnimalBreeding: React.FC<{
  animal: FarmAnimal;
  cfg: SpeciesConfig;
  /** Called with the fresh animal after any save. */
  onChanged: (a: FarmAnimal | null) => void;
}> = ({ animal, cfg, onChanged }) => {
  const [sheet, setSheet] = useState<Sheet>(null);
  const [saving, setSaving] = useState(false);
  const r = animal.repro;

  // pregnancy sheet
  const [mode, setMode] = useState<'SERVED' | 'DUE' | 'UNSURE'>('SERVED');
  const [served, setServed] = useState(localToday());
  const [due, setDue] = useState('');
  const [method, setMethod] = useState<'NATURAL' | 'AI' | 'UNKNOWN'>('UNKNOWN');
  const [when, setWhen] = useState(localToday());

  if (!cfg.pregnancy && !cfg.lactation) return null;
  const female = animal.sex !== 'MALE';
  if (!female) return null;

  const gest = r?.gestationDays ?? null;
  const dryDays = r?.dryOffDays ?? null;
  const previewDue = mode === 'SERVED' && gest ? plus(served, gest) : mode === 'DUE' && due ? due : null;
  const previewDry = previewDue && dryDays && cfg.lactation ? plus(previewDue, -dryDays) : null;

  const save = async (patch: Record<string, unknown>, done: string) => {
    setSaving(true);
    try {
      const res = await clientPortalAPI.updateFarmAnimal(animal.id, patch as any);
      if (res.success && res.data) { toast.success(done); setSheet(null); onChanged(res.data.animal); }
    } finally { setSaving(false); }
  };

  const openPregnant = () => {
    // Pre-fill from what is already known so "Edit dates" is an edit, not a retype.
    setMode(animal.isPregnant && !r?.pregnantSince && r?.dueOn ? 'DUE' : 'SERVED');
    setServed(r?.pregnantSince ?? localToday());
    setDue(animal.expectedDueOn ? String(animal.expectedDueOn).slice(0, 10) : '');
    setMethod(r?.breedingMethod ?? 'UNKNOWN');
    setSheet('PREGNANT');
  };

  const savePregnant = () => {
    if (mode === 'SERVED') return save({ isPregnant: true, pregnantSince: served, expectedDueOn: null, breedingMethod: method }, 'Saved — due date worked out');
    if (mode === 'DUE') return save({ isPregnant: true, pregnantSince: null, expectedDueOn: due, breedingMethod: null }, 'Due date saved');
    return save({ isPregnant: true }, `Marked ${cfg.pregnantLabel.toLowerCase()}`);
  };

  const calved = async () => {
    setSaving(true);
    try {
      const res = await clientPortalAPI.recordAnimalCalving(animal.id, { date: when });
      if (res.success) {
        toast.success('Recorded — milking starts from today');
        setSheet(null);
        const fresh = await clientPortalAPI.getFarmAnimal(animal.id);
        onChanged(fresh.success && fresh.data ? fresh.data.animal : null);
      }
    } finally { setSaving(false); }
  };

  const progress = (() => {
    if (!animal.isPregnant || !gest) return null;
    const days = r?.daysPregnant ?? (r?.daysToDue != null ? gest - r.daysToDue : null);
    return days == null ? null : Math.max(0, Math.min(1, days / gest));
  })();
  const dryUrgent = animal.isLactating && r?.dryOffInDays != null && r.dryOffInDays <= 14;

  return (
    <div className="cp-card p-3.5 space-y-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
        <CalendarClock size={11} /> Breeding {cfg.lactation ? '& milking' : ''}
      </p>

      {/* ── Pregnancy ─────────────────────────────────────────── */}
      {cfg.pregnancy && (
        animal.isPregnant ? (
          <div className="rounded-2xl p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5"><Baby size={15} /> {cfg.pregnantLabel}</p>
              <button className="text-[10px] font-black uppercase tracking-widest cp-accent-text" onClick={openPregnant}>Edit dates</button>
            </div>
            {progress != null && (
              <div className="mt-2.5">
                <div className="h-2 rounded-full bg-amber-200/60 dark:bg-amber-500/20 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-amber-800/80 dark:text-amber-300/80">
                  {r?.daysPregnant != null ? `Day ${r.daysPregnant} of about ${gest}` : `About ${Math.round(progress * 100)}% of the way`}
                  {r?.breedingMethod && r.breedingMethod !== 'UNKNOWN' ? ` · ${r.breedingMethod === 'AI' ? 'AI' : 'Natural service'}` : ''}
                </p>
              </div>
            )}
            {r?.dueOn ? (
              <div className="mt-3 divide-y divide-amber-200/70 dark:divide-amber-500/20">
                <DateRow label={r.dueIsEstimate ? 'Due (estimate)' : 'Due'} date={r.dueOn} days={r.daysToDue} />
                {r.dryOffOn && cfg.lactation && (
                  <DateRow label="Stop milking" date={r.dryOffOn} days={animal.isLactating ? r.dryOffInDays : null}
                    note={animal.isLactating ? (r.dryOffInDays != null && r.dryOffInDays < 0 ? 'Past due — dry her off now' : null) : (r.driedOffOn ? 'Dried off' : null)}
                    urgent={dryUrgent} />
                )}
                {r.nextMilkingOn && cfg.lactation && <DateRow label="Milking starts again" date={r.nextMilkingOn} days={r.daysToDue} />}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                Add when she was served and we will work out the due date{cfg.lactation && dryDays ? ', when to stop milking and when milking starts again' : ''}.
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button className="cp-btn flex-1 !py-2.5 flex items-center justify-center gap-1.5" onClick={() => { setWhen(localToday()); setSheet('CALVED'); }}>
                <PartyPopper size={14} /> She {birthVerb(animal.species)}
              </button>
              <button className="cp-btn-ghost !py-2.5 !px-3 !text-[11px]" disabled={saving}
                onClick={() => save({ isPregnant: false }, 'Marked not pregnant')}>Not pregnant</button>
            </div>
          </div>
        ) : (
          <button className="w-full rounded-2xl p-3 border border-dashed border-slate-300 dark:border-zinc-700 text-left flex items-center gap-3 active:scale-[0.99]" onClick={openPregnant}>
            <span className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/15 text-amber-600 flex items-center justify-center"><Baby size={18} /></span>
            <span className="flex-1">
              <span className="block text-sm font-black text-slate-800 dark:text-zinc-100">Mark {cfg.pregnantLabel.toLowerCase()}</span>
              <span className="block text-[11px] text-slate-500">We will work out the due date{cfg.lactation && dryDays ? ' and when to stop milking' : ''}</span>
            </span>
          </button>
        )
      )}

      {/* ── Milking ───────────────────────────────────────────── */}
      {cfg.lactation && (
        animal.isLactating ? (
          <div className="rounded-2xl p-3 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/25 flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-500/20 text-sky-600 flex items-center justify-center"><Milk size={18} /></span>
            <span className="flex-1">
              <span className="block text-sm font-black text-sky-800 dark:text-sky-300">{cfg.lactatingLabel}{r?.daysInMilk != null ? ` · day ${r.daysInMilk}` : ''}</span>
              <span className="block text-[11px] text-sky-800/80 dark:text-sky-300/80">
                {r?.dryOffOn ? `Stop ${fmtDay(r.dryOffOn)}${r.dryOffInDays != null ? ` (${rel(r.dryOffInDays)})` : ''}` : r?.lactatingSince ? `Since ${fmtDay(r.lactatingSince)}` : 'Add when milking started'}
              </span>
            </span>
            <button className="cp-btn-ghost !py-2 !px-3 !text-[11px] shrink-0" onClick={() => { setWhen(localToday()); setSheet('DRYOFF'); }}>Dry off</button>
          </div>
        ) : (
          <button className="w-full rounded-2xl p-3 border border-dashed border-slate-300 dark:border-zinc-700 text-left flex items-center gap-3 active:scale-[0.99]" onClick={() => { setWhen(localToday()); setSheet('MILKING'); }}>
            <span className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-500/15 text-sky-600 flex items-center justify-center"><Droplet size={18} /></span>
            <span className="flex-1">
              <span className="block text-sm font-black text-slate-800 dark:text-zinc-100">{r?.driedOffOn ? `Dry since ${fmtDay(r.driedOffOn)}` : 'Not milking'}</span>
              <span className="block text-[11px] text-slate-500">{r?.nextMilkingOn ? `Milking starts again ${fmtDay(r.nextMilkingOn)}` : 'Tap to start milking'}</span>
            </span>
          </button>
        )
      )}

      {/* ── Sheets ────────────────────────────────────────────── */}
      {sheet === 'PREGNANT' && (
        <CpModal title={`${cfg.pregnantLabel} — since when?`} onClose={() => setSheet(null)}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <Chip active={mode === 'SERVED'} onClick={() => setMode('SERVED')}>Date she was served</Chip>
              <Chip active={mode === 'DUE'} onClick={() => setMode('DUE')}>I know the due date</Chip>
              <Chip active={mode === 'UNSURE'} onClick={() => setMode('UNSURE')}>Not sure</Chip>
            </div>
            {mode === 'SERVED' && (
              <>
                <input className="cp-input w-full" type="date" value={served} max={localToday()} onChange={(e) => e.target.value && setServed(e.target.value)} />
                <div className="flex flex-wrap gap-1.5">
                  <Chip active={method === 'NATURAL'} onClick={() => setMethod('NATURAL')}>Natural</Chip>
                  <Chip active={method === 'AI'} onClick={() => setMethod('AI')}>AI</Chip>
                  <Chip active={method === 'UNKNOWN'} onClick={() => setMethod('UNKNOWN')}>Not sure how</Chip>
                </div>
              </>
            )}
            {mode === 'DUE' && <input className="cp-input w-full" type="date" value={due} min={localToday()} onChange={(e) => setDue(e.target.value)} />}
            {mode === 'UNSURE' && <p className="text-xs text-slate-500 leading-relaxed">She will be marked {cfg.pregnantLabel.toLowerCase()} with no dates. Add the date later — or ask your vet to confirm — and the due date appears.</p>}
            {previewDue && (
              <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/60 p-3 text-xs space-y-1">
                <p><span className="text-slate-500">Due:</span> <b>{fmtDay(previewDue)}</b> <span className="text-slate-400">({rel(Math.round((parse(previewDue).getTime() - parse(localToday()).getTime()) / DAY))})</span></p>
                {previewDry && <p><span className="text-slate-500">Stop milking:</span> <b>{fmtDay(previewDry)}</b></p>}
                {previewDry && <p><span className="text-slate-500">Milking starts again:</span> <b>{fmtDay(previewDue)}</b></p>}
              </div>
            )}
            <SubmitButton saving={saving} disabled={mode === 'DUE' && !due} onClick={savePregnant}>Save</SubmitButton>
          </div>
        </CpModal>
      )}

      {sheet === 'CALVED' && (
        <CpModal title={`${animal.name} ${birthVerb(animal.species)}`} onClose={() => setSheet(null)}>
          <div className="space-y-3">
            <label className="cp-label">On what day?</label>
            <input className="cp-input w-full" type="date" value={when} max={localToday()} onChange={(e) => e.target.value && setWhen(e.target.value)} />
            <p className="text-[11px] text-slate-500 leading-relaxed">Her pregnancy ends and milking starts from this day.</p>
            <SubmitButton saving={saving} onClick={calved}>Save</SubmitButton>
          </div>
        </CpModal>
      )}

      {sheet === 'MILKING' && (
        <CpModal title={`Start milking ${animal.name}`} onClose={() => setSheet(null)}>
          <div className="space-y-3">
            <label className="cp-label">Milking since</label>
            <input className="cp-input w-full" type="date" value={when} max={localToday()} onChange={(e) => e.target.value && setWhen(e.target.value)} />
            <SubmitButton saving={saving} onClick={() => save({ isLactating: true, lactatingSince: when }, 'Milking started')}>Save</SubmitButton>
          </div>
        </CpModal>
      )}

      {sheet === 'DRYOFF' && (
        <CpModal title={`Dry off ${animal.name}`} onClose={() => setSheet(null)}>
          <div className="space-y-3">
            <label className="cp-label">Last day milked</label>
            <input className="cp-input w-full" type="date" value={when} max={localToday()} onChange={(e) => e.target.value && setWhen(e.target.value)} />
            <SubmitButton saving={saving} onClick={() => save({ driedOffOn: when }, 'Marked dry')}>Save</SubmitButton>
          </div>
        </CpModal>
      )}
    </div>
  );
};

const DateRow: React.FC<{ label: string; date: string; days: number | null; note?: string | null; urgent?: boolean }> = ({ label, date, days, note, urgent }) => (
  <div className="py-2 flex items-center justify-between gap-2">
    <span className="text-xs text-amber-900/80 dark:text-amber-200/80">{label}</span>
    <span className="text-right">
      <span className={`block text-sm font-black tabular-nums ${urgent ? 'text-rose-600' : 'text-amber-900 dark:text-amber-100'}`}>{fmtDay(date)}</span>
      <span className={`block text-[10px] ${urgent ? 'text-rose-600 font-bold' : 'text-amber-800/70 dark:text-amber-300/70'}`}>{note ?? rel(days)}</span>
    </span>
  </div>
);

export default AnimalBreeding;
