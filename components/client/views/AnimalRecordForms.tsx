/**
 * The three things a farmer records against ONE animal: a weight, a feeding, a
 * produce yield. Each form is built for a phone held in one hand in a boma:
 *
 *  · the number keypad opens straight away (`inputMode="decimal"`), not a QWERTY;
 *  · the common answers are ONE TAP — "same as last", ±1 kg, 5 kg, "Milk" —
 *    so typing is the fallback, not the way in;
 *  · the date defaults to today and the time to "now", and both are still
 *    changeable, because the other case is catching up on yesterday;
 *  · Enter submits, and nothing is required that the farmer does not know.
 *
 * Every field here is one the API already accepts (`weighedOn`, `fedAt`,
 * `notes`, `recordedOn`, `unit`) — the old forms simply did not offer them.
 */
import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { FarmAnimal } from '../../../services/modules/clientPortal.api';
import { speciesConfig } from './farmSpecies';

/** Today as YYYY-MM-DD in the farmer's own clock (not UTC, which is yesterday before 3am in Kenya). */
export const localToday = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

// What the farmer gave last time, per animal — so "the usual" is one tap. A
// failed read/write (private mode, quota) just means no shortcut, never an error.
const memKey = (kind: string, animalId: string) => `vh:last:${kind}:${animalId}`;
const recall = (kind: string, animalId: string): string => {
  try { return localStorage.getItem(memKey(kind, animalId)) ?? ''; } catch { return ''; }
};
export const remember = (kind: string, animalId: string, value: string) => {
  try { localStorage.setItem(memKey(kind, animalId), value); } catch { /* fine */ }
};

const Chip: React.FC<{ active?: boolean; onClick: () => void; children: React.ReactNode; testId?: string }> = ({ active, onClick, children, testId }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testId}
    aria-pressed={!!active}
    className={`min-h-[40px] px-3.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all active:scale-95 ${
      active
        ? 'cp-tab-on border-transparent'
        : 'border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 bg-white dark:bg-zinc-800/50'
    }`}
  >
    {children}
  </button>
);

const WhenRow: React.FC<{ date: string; onDate: (d: string) => void; children?: React.ReactNode }> = ({ date, onDate, children }) => (
  <div>
    <div className="flex items-center justify-between gap-2 mb-1">
      <label className="cp-label !mb-0" htmlFor="rec-date">When</label>
      <div className="flex gap-1">
        <Chip active={date === localToday()} onClick={() => onDate(localToday())} testId="when-today">Today</Chip>
        <Chip active={date === daysAgo(1)} onClick={() => onDate(daysAgo(1))} testId="when-yesterday">Yesterday</Chip>
      </div>
    </div>
    <input id="rec-date" className="cp-input w-full" type="date" value={date} max={localToday()}
           onChange={(e) => e.target.value && onDate(e.target.value)} />
    {children}
  </div>
);

const onEnter = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter') { e.preventDefault(); fn(); }
};

const SubmitButton: React.FC<{ saving: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }> = ({ saving, disabled, onClick, children }) => (
  <button type="button" className="cp-btn w-full min-h-[48px]" onClick={onClick} disabled={saving || disabled} data-testid="record-submit">
    {saving ? 'Saving…' : children}
  </button>
);

// ─── Weight ──────────────────────────────────────────────────────────────────

export const WeighForm: React.FC<{
  animal: FarmAnimal;
  saving: boolean;
  onSubmit: (p: { weightValue: number; weighedOn?: string }) => void;
}> = ({ animal, saving, onSubmit }) => {
  const last = animal.weightValue ?? null;
  const [val, setVal] = useState('');
  const [date, setDate] = useState(localToday());

  const num = val === '' ? null : Number(val);
  const valid = num != null && Number.isFinite(num) && num > 0;
  const delta = valid && last != null ? num! - last : null;

  const step = (dx: number) => {
    const base = num != null && Number.isFinite(num) ? num : last ?? 0;
    setVal(String(Math.max(0, Math.round((base + dx) * 10) / 10)));
  };

  const submit = () => {
    if (!valid) return;
    // Today needs no date — the server stamps "now" — which also keeps two
    // weigh-ins on the same day in the order they were taken.
    onSubmit({ weightValue: num!, ...(date !== localToday() ? { weighedOn: date } : {}) });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="cp-label" htmlFor="rec-weight">Weight (kg)</label>
        <div className="grid grid-cols-[3rem_1fr_3rem] gap-2">
          <button type="button" className="cp-input !p-0 flex items-center justify-center active:scale-95" onClick={() => step(-1)} aria-label="One kilo less"><Minus size={18} /></button>
          <input id="rec-weight" className="cp-input w-full text-center text-2xl font-black tabular-nums" type="number" inputMode="decimal"
                 min="0" step="0.1" autoFocus placeholder="0" value={val}
                 onChange={(e) => setVal(e.target.value)} onKeyDown={onEnter(submit)} />
          <button type="button" className="cp-input !p-0 flex items-center justify-center active:scale-95" onClick={() => step(1)} aria-label="One kilo more"><Plus size={18} /></button>
        </div>
        {last != null && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {val === '' && <Chip onClick={() => setVal(String(last))} testId="weight-same">Same as last · {last}{animal.weightUnit}</Chip>}
            {delta !== null && (
              <span data-testid="weight-delta" className={`text-xs font-black ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                {delta > 0 ? '+' : ''}{delta.toFixed(1)} kg since last
                {animal.weighedOn && ` (${new Date(animal.weighedOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})`}
              </span>
            )}
          </div>
        )}
      </div>
      <WhenRow date={date} onDate={setDate} />
      <SubmitButton saving={saving} disabled={!valid} onClick={submit}>Record weight</SubmitButton>
    </div>
  );
};

// ─── Feeding ─────────────────────────────────────────────────────────────────

const FEED_TYPES: Record<string, string[]> = {
  Cattle: ['Napier', 'Hay', 'Dairy meal', 'Silage'],
  Goat: ['Hay', 'Napier', 'Concentrate'],
  Sheep: ['Hay', 'Grass', 'Concentrate'],
  Poultry: ['Layers mash', 'Growers mash', 'Chick mash'],
  Pig: ['Pig meal', 'Sow & weaner', 'Swill'],
};
const QUICK_KG = [1, 2, 5, 10];
const TIMES = [
  { label: 'Morning', value: '06:30' },
  { label: 'Midday', value: '12:00' },
  { label: 'Evening', value: '18:30' },
] as const;

export const FeedForm: React.FC<{
  animal: FarmAnimal;
  saving: boolean;
  onSubmit: (p: { quantityKg?: number; fedAt?: string; notes?: string }) => void;
}> = ({ animal, saving, onSubmit }) => {
  const lastQty = recall('feed-qty', animal.id);
  const [qty, setQty] = useState('');
  const [type, setType] = useState('');
  const [time, setTime] = useState('');
  const [date, setDate] = useState(localToday());
  const types = FEED_TYPES[animal.species] ?? ['Hay', 'Concentrate'];

  const num = qty === '' ? null : Number(qty);
  const bad = num != null && (!Number.isFinite(num) || num < 0);

  const submit = () => {
    if (bad) return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    // Only send a time when the farmer chose a day or a time of day; otherwise the
    // server's "now" is exactly right and one fewer thing to get wrong.
    const custom = date !== localToday() || time !== '';
    const fedAt = custom ? new Date(`${date}T${time || hhmm}:00`).toISOString() : undefined;
    if (num != null && num > 0) remember('feed-qty', animal.id, String(num));
    onSubmit({
      ...(num != null ? { quantityKg: num } : {}),
      ...(fedAt ? { fedAt } : {}),
      ...(type.trim() ? { notes: type.trim() } : {}),
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="cp-label" htmlFor="rec-feed-qty">How much (kg) <span className="text-slate-400 font-normal normal-case tracking-normal">— optional</span></label>
        <input id="rec-feed-qty" className="cp-input w-full text-center text-2xl font-black tabular-nums" type="number" inputMode="decimal"
               min="0" step="0.1" autoFocus placeholder="0" value={qty}
               onChange={(e) => setQty(e.target.value)} onKeyDown={onEnter(submit)} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lastQty && qty === '' && <Chip onClick={() => setQty(lastQty)} testId="feed-same">Same as last · {lastQty} kg</Chip>}
          {QUICK_KG.map((k) => <Chip key={k} active={qty === String(k)} onClick={() => setQty(String(k))}>{k} kg</Chip>)}
        </div>
      </div>

      <div>
        <label className="cp-label" htmlFor="rec-feed-type">What did you give? <span className="text-slate-400 font-normal normal-case tracking-normal">— optional</span></label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {types.map((t) => <Chip key={t} active={type === t} onClick={() => setType(type === t ? '' : t)}>{t}</Chip>)}
        </div>
        <input id="rec-feed-type" className="cp-input w-full" placeholder="Or type it" value={type} onChange={(e) => setType(e.target.value)} onKeyDown={onEnter(submit)} />
      </div>

      <WhenRow date={date} onDate={setDate}>
        <div className="mt-2 flex gap-1.5">
          {TIMES.map((t) => <Chip key={t.value} active={time === t.value} onClick={() => setTime(time === t.value ? '' : t.value)}>{t.label}</Chip>)}
        </div>
      </WhenRow>

      <SubmitButton saving={saving} disabled={bad} onClick={submit}>Record feeding</SubmitButton>
    </div>
  );
};

// ─── Produce ─────────────────────────────────────────────────────────────────

type ProduceOption = { label: string; unit: string; other?: boolean };

const UNITS = ['L', 'KG', 'TRAY', 'PCS'] as const;

/** farmSpecies speaks in words ("litres", "trays"); records are stored as short codes. */
const unitCode = (u: string) => {
  const x = u.toLowerCase();
  if (x.startsWith('lit') || x === 'l') return 'L';
  if (x.startsWith('tray')) return 'TRAY';
  if (x === 'kg' || x.startsWith('kilo')) return 'KG';
  if (x.startsWith('piece') || x === 'pcs') return 'PCS';
  return u.toUpperCase();
};

/** What THIS animal can yield, from the same config the herd breakdown uses — plus skin for ruminants and an "other". */
export const produceOptions = (species: string): ProduceOption[] => {
  const fromConfig = speciesConfig(species).produce
    .filter((p) => p.key !== 'MEAT')
    .map((p) => ({ label: p.label, unit: unitCode(p.unit) }));
  const skin = ['Cattle', 'Goat', 'Sheep'].includes(species) ? [{ label: 'Skin', unit: 'PCS' }] : [];
  return [...fromConfig, ...skin, { label: 'Other', unit: 'KG', other: true }];
};

const SESSIONS = ['Morning', 'Midday', 'Evening'] as const;

export const ProduceForm: React.FC<{
  animal: FarmAnimal;
  saving: boolean;
  onSubmit: (p: { produce: string; quantity: number; unit: string; recordedOn?: string; notes?: string }) => void;
}> = ({ animal, saving, onSubmit }) => {
  const options = produceOptions(animal.species);
  const [choice, setChoice] = useState<ProduceOption>(options[0]);
  const [other, setOther] = useState('');
  const [unit, setUnit] = useState(options[0].unit);
  const [quantity, setQuantity] = useState('');
  const [session, setSession] = useState('');
  const [date, setDate] = useState(localToday());

  const produce = choice.other ? other.trim() : choice.label;
  const num = quantity === '' ? null : Number(quantity);
  const valid = !!produce && num != null && Number.isFinite(num) && num > 0;
  const isMilk = choice.label === 'Milk';

  const pick = (o: ProduceOption) => { setChoice(o); setUnit(o.unit); if (o.label !== 'Milk') setSession(''); };

  const submit = () => {
    if (!valid) return;
    onSubmit({
      produce,
      quantity: num!,
      unit,
      ...(date !== localToday() ? { recordedOn: date } : {}),
      ...(isMilk && session ? { notes: `${session} milking` } : {}),
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="cp-label">What did {animal.name} give?</p>
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => <Chip key={o.label} active={choice.label === o.label} onClick={() => pick(o)}>{o.label}</Chip>)}
        </div>
        {choice.other && (
          <input className="cp-input w-full mt-2" placeholder="What was it?" autoFocus value={other}
                 aria-label="What was it?" onChange={(e) => setOther(e.target.value)} onKeyDown={onEnter(submit)} />
        )}
      </div>

      <div>
        <label className="cp-label" htmlFor="rec-qty">How much</label>
        <input id="rec-qty" className="cp-input w-full text-center text-2xl font-black tabular-nums" type="number" inputMode="decimal"
               min="0" step="0.1" autoFocus={!choice.other} placeholder="0" value={quantity}
               onChange={(e) => setQuantity(e.target.value)} onKeyDown={onEnter(submit)} />
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Unit">
          {UNITS.map((u) => <Chip key={u} active={unit === u} onClick={() => setUnit(u)} testId={`unit-${u}`}>{u === 'L' ? 'Litres' : u === 'KG' ? 'Kg' : u === 'TRAY' ? 'Trays' : 'Pieces'}</Chip>)}
        </div>
      </div>

      {isMilk && (
        <div>
          <p className="cp-label">Which milking? <span className="text-slate-400 font-normal normal-case tracking-normal">— optional</span></p>
          <div className="flex gap-1.5">
            {SESSIONS.map((s) => <Chip key={s} active={session === s} onClick={() => setSession(session === s ? '' : s)}>{s}</Chip>)}
          </div>
        </div>
      )}

      <WhenRow date={date} onDate={setDate} />
      <SubmitButton saving={saving} disabled={!valid} onClick={submit}>Record {produce || 'produce'}</SubmitButton>
    </div>
  );
};
