/**
 * The FREE farm record book (262). Spec: backend/docs/SPEC_FARM_FREE_TIER.md
 *
 * This is the whole product for a farmer on the Free rung, and the design brief
 * is one sentence: **a smallholder standing in a boma with one hand free must be
 * able to record what just happened in under ten seconds.**
 *
 * Everything here follows from that:
 * · Four big buttons, not a form with a category dropdown. "Fed them" and "Sold
 *   milk" are different thoughts; making someone classify their own action
 *   first is the step where they give up.
 * · The money summary is at the TOP, not the bottom. It is the reason they came
 *   back on day two.
 * · Nothing is required except the thing they came to say. No date (defaults to
 *   today), no herd, no vendor.
 *
 * ⚠️ This renders on BOTH tiers. The paid Farmer rung keeps every feeding plan,
 * crop and vet-link screen it already had — this is additive to those, never a
 * replacement, so a paying farmer does not lose a screen by gaining one.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Wheat, Milk, Coins, Stethoscope, Plus, Trash2, TrendingUp, TrendingDown,
  Loader2, Search, Pencil, Info,
} from 'lucide-react';
import {
  clientPortalAPI, LEDGER_CATEGORIES, VENDOR_CATEGORIES,
  type PortalAnimalGroup, type PortalLedgerEntry, type PortalFarmSummary, type PortalVendor,
} from '../../../services/modules/clientPortal.api';
import { toast } from '../../../services';
import CpModal from '../CpModal';

const KES = (n: number) =>
  `KES ${Math.round(n).toLocaleString('en-KE')}`;

const fmtDay = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * The two times that actually matter on a smallholding.
 *
 * A cow is milked twice and fed twice, and those are the events a farmer is
 * recording nine times out of ten. Two taps beat spinning a time picker, and
 * the picker is still right there for everything else.
 */
const QUICK_TIMES = [
  { label: 'Morning', value: '06:30' },
  { label: 'Midday', value: '12:00' },
  { label: 'Evening', value: '18:30' },
] as const;

/** The four things a farmer actually does, in the order they do them. */
const SHEETS = [
  { key: 'FEED', label: 'Fed them', icon: Wheat, tone: 'amber',
    hint: 'What you gave them, how much it cost' },
  { key: 'MILK_SALE', label: 'Milk & produce', icon: Milk, tone: 'sky',
    hint: 'What came off the farm, and what you sold it for' },
  { key: 'LIVESTOCK_SALE', label: 'Sold', icon: Coins, tone: 'emerald',
    hint: 'An animal, or anything else' },
  { key: 'MEDICATION', label: 'Treatment', icon: Stethoscope, tone: 'rose',
    hint: 'Medicine, dewormer, spray — and where you bought it' },
] as const;

/**
 * ⚠️ Every tone needs its `dark:` pair (§0d — dark mode is not optional).
 *
 * The first cut shipped light-only and it showed: four cream and pale-blue
 * slabs glowing on the portal's dark canvas, which is what the user
 * screenshotted. The dark side is a TINT of the same hue (`/10` fill, `/25`
 * hairline) rather than a different colour, so the four stay distinguishable
 * from each other without any of them shouting.
 */
const TONES: Record<string, string> = {
  amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/25',
  sky: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-400/10 dark:text-sky-300 dark:border-sky-400/25',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/25',
  rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-400/10 dark:text-rose-300 dark:border-rose-400/25',
};

const ALL_CATEGORIES = [...LEDGER_CATEGORIES.EXPENSE, ...LEDGER_CATEGORIES.INCOME];
const labelFor = (key: string) => ALL_CATEGORIES.find((c) => c.key === key)?.label ?? key;
const unitFor = (key: string) => ALL_CATEGORIES.find((c) => c.key === key)?.unit ?? '';
const isIncome = (key: string) => LEDGER_CATEGORIES.INCOME.some((c) => c.key === key);

// ─── Agrovet type-to-search ──────────────────────────────────────────────────

/**
 * ⚠️ Free text FIRST, match second.
 *
 * A farmer who buys from a duka that VetHub has never heard of must still be
 * able to finish their record. So the typed name is always what is saved; a
 * match just adds a link on top of it. The failure mode this avoids is the
 * classic one — a required dropdown with no correct option, and a farmer who
 * abandons the entry.
 */
const VendorField: React.FC<{
  value: string;
  supplierId: string | null;
  onChange: (name: string, supplierId: string | null) => void;
}> = ({ value, supplierId, onChange }) => {
  const [results, setResults] = useState<PortalVendor[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (supplierId || value.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(() => {
      clientPortalAPI.searchFarmVendors(value.trim())
        .then((r) => { if (r.success && r.data) { setResults(r.data.vendors); setOpen(true); } })
        .catch(() => { /* the field still works as plain text */ });
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, supplierId]);

  return (
    <div className="relative">
      <label className="cp-label flex items-center gap-1">
        <Search size={11} /> Where did you buy it?
        <span className="text-slate-400 font-normal normal-case tracking-normal">— optional</span>
      </label>
      <input
        className="cp-input w-full"
        placeholder="Agrovet or shop name"
        value={value}
        onChange={(e) => onChange(e.target.value, null)}
        onFocus={() => results.length && setOpen(true)}
      />
      {supplierId && (
        <p className="mt-1 text-[10px] font-bold text-emerald-600">✓ Linked to a known agrovet</p>
      )}
      {open && results.length > 0 && !supplierId && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {results.map((v) => (
            <button
              key={v.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
              onClick={() => { onChange(v.name, v.id); setOpen(false); }}
            >
              <p className="text-xs font-bold text-slate-700">{v.name}</p>
              {(v.category || v.address) && (
                <p className="text-[10px] text-slate-400 truncate">
                  {[v.category, v.address].filter(Boolean).join(' · ')}
                </p>
              )}
            </button>
          ))}
          <p className="px-3 py-1.5 text-[10px] text-slate-400 bg-slate-50">
            Not listed? Just leave the name as you typed it.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Herd composition editor ─────────────────────────────────────────────────

const COMPOSITION_FIELDS = [
  { key: 'headCount', label: 'Total' },
  { key: 'males', label: 'Male' },
  { key: 'females', label: 'Female' },
  { key: 'adults', label: 'Adult' },
  { key: 'young', label: 'Young' },
  { key: 'pregnant', label: 'Pregnant' },
  { key: 'lactating', label: 'Milking' },
] as const;

interface Props {
  farmId: string;
  groups: PortalAnimalGroup[];
  onGroupsChanged: () => void;
  /** 'BASIC' is the free record book; 'FULL' also has plans, crops, vet link. */
  tier: 'NONE' | 'BASIC' | 'FULL';
  /** Herds this plan covers. 0 = unlimited. */
  groupLimit: number;
}

const ClientFarmRecords: React.FC<Props> = ({ farmId, groups, onGroupsChanged, tier, groupLimit }) => {
  const [summary, setSummary] = useState<PortalFarmSummary | null>(null);
  const [entries, setEntries] = useState<PortalLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // One sheet, driven by whichever of the four buttons was pressed.
  const [sheet, setSheet] = useState<string | null>(null);
  const [category, setCategory] = useState('FEED');
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [groupId, setGroupId] = useState('');
  const [vendor, setVendor] = useState('');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entryTime, setEntryTime] = useState('');

  // Herd sheets
  const [addHerd, setAddHerd] = useState(false);
  const [herdName, setHerdName] = useState('');
  const [herdSpecies, setHerdSpecies] = useState('');
  const [editHerd, setEditHerd] = useState<PortalAnimalGroup | null>(null);
  const [comp, setComp] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    return Promise.all([
      clientPortalAPI.getFarmSummary(farmId),
      clientPortalAPI.getFarmLedger(farmId, { limit: 60 }),
    ]).then(([s, l]) => {
      if (s.success && s.data) setSummary(s.data);
      if (l.success && l.data) setEntries(l.data.entries);
    }).finally(() => setLoading(false));
  }, [farmId]);

  useEffect(() => { load(); }, [load]);

  const openSheet = (key: string) => {
    setSheet(key);
    setCategory(key);
    setItem(''); setAmount(''); setQuantity(''); setUnit(unitFor(key));
    setGroupId(''); setVendor(''); setVendorId(null);
    setEntryDate(new Date().toISOString().slice(0, 10));
    // Pre-filled with NOW, because the overwhelming case is recording something
    // that just happened. Clearable, because the other case — catching up on
    // last week — must not be forced to invent a clock time it does not know.
    setEntryTime(hhmm(new Date()));
  };

  const pickCategory = (key: string) => {
    setCategory(key);
    // Only follow the category's default unit if the farmer has not typed their
    // own — retyping "L" because they switched from milk to eggs is the kind of
    // small insult that makes an app feel like paperwork.
    setUnit((u) => (u === '' || u === unitFor(category) ? unitFor(key) : u));
  };

  const submit = async () => {
    if (!item.trim()) { toast.error('Say what it was'); return; }
    setSaving(true);
    try {
      const r = await clientPortalAPI.createLedgerEntry(farmId, {
        category,
        item: item.trim(),
        amount: Number(amount || 0),
        quantity: quantity === '' ? null : Number(quantity),
        unit: unit || undefined,
        entryDate,
        entryTime: entryTime || null,
        animalGroupId: groupId || undefined,
        vendorName: vendor.trim() || undefined,
        vendorSupplierId: vendorId || undefined,
      });
      if (r.success) {
        toast.success('Recorded');
        setSheet(null);
        load();
      }
    } finally { setSaving(false); }
  };

  const remove = async (entry: PortalLedgerEntry) => {
    const r = await clientPortalAPI.deleteLedgerEntry(entry.id);
    if (r.success) { setEntries((prev) => prev.filter((e) => e.id !== entry.id)); load(); }
  };

  const createHerd = async () => {
    if (!herdName.trim() || !herdSpecies.trim()) { toast.error('Name it and say what they are'); return; }
    setSaving(true);
    try {
      const r = await clientPortalAPI.createAnimalGroup(farmId, {
        name: herdName.trim(), species: herdSpecies.trim(),
      });
      if (r.success) {
        toast.success('Herd added');
        setAddHerd(false); setHerdName(''); setHerdSpecies('');
        onGroupsChanged();
      }
    } finally { setSaving(false); }
  };

  const openComposition = (g: PortalAnimalGroup) => {
    setEditHerd(g);
    setComp(Object.fromEntries(
      COMPOSITION_FIELDS.map((f) => [f.key, String((g as any)[f.key] ?? 0)]),
    ));
  };

  const saveComposition = async () => {
    if (!editHerd) return;
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(comp).map(([k, v]) => [k, Number(v || 0)]),
      ) as any;
      const r = await clientPortalAPI.updateAnimalGroup(editHerd.id, payload);
      if (r.success) { toast.success('Herd updated'); setEditHerd(null); onGroupsChanged(); }
    } finally { setSaving(false); }
  };

  /**
   * The hint, not the rule.
   *
   * ⚠️ Never blocks the save. A farmer whose sexes do not add up to their total
   * is mid-calving, not wrong — and the server deliberately accepts it (spec
   * §3.1). This is a nudge they can ignore forever.
   */
  const compHint = useMemo(() => {
    const total = Number(comp.headCount || 0);
    const sexes = Number(comp.males || 0) + Number(comp.females || 0);
    if (!total || !sexes || sexes === total) return null;
    return sexes > total
      ? `Male + female is ${sexes}, more than the ${total} you gave as the total.`
      : `Male + female is ${sexes} of ${total}. Fine if you have not counted the rest.`;
  }, [comp]);

  const atGroupLimit = groupLimit > 0 && groups.length >= groupLimit;
  const wantsVendor = VENDOR_CATEGORIES.includes(category);
  const sheetDef = SHEETS.find((s) => s.key === sheet);
  const categoryChoices = sheet
    ? (isIncome(sheet) ? LEDGER_CATEGORIES.INCOME : LEDGER_CATEGORIES.EXPENSE)
    : [];

  return (
    <div className="space-y-5">
      {/* ── Money first. This is why they come back. ─────────────────────── */}
      <section className="cp-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
            {summary?.windowDays ? `Last ${summary.windowDays} days` : 'All time'}
          </h3>
          {loading && <Loader2 size={13} className="animate-spin text-slate-300" />}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-sm sm:text-base font-black text-emerald-600 flex items-center justify-center gap-1">
              <TrendingUp size={13} /> {KES(summary?.income ?? 0)}
            </p>
            <p className="text-[9px] uppercase tracking-widest text-slate-400 mt-0.5">In</p>
          </div>
          <div>
            <p className="text-sm sm:text-base font-black text-rose-600 flex items-center justify-center gap-1">
              <TrendingDown size={13} /> {KES(summary?.expense ?? 0)}
            </p>
            <p className="text-[9px] uppercase tracking-widest text-slate-400 mt-0.5">Out</p>
          </div>
          <div>
            <p className={`text-sm sm:text-base font-black ${(summary?.net ?? 0) >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
              {KES(summary?.net ?? 0)}
            </p>
            {/* "Left over", never "profit" — this number carries no stock on
                hand and no unsold produce, and a farmer should not make a real
                decision on it thinking otherwise. */}
            <p className="text-[9px] uppercase tracking-widest text-slate-400 mt-0.5">Left over</p>
          </div>
        </div>
        {summary && summary.produceQuantity > 0 && (
          <p className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 text-center">
            <span className="font-bold text-slate-700">{summary.produceQuantity.toLocaleString()}</span> recorded off the farm
            {summary.herd.lactating > 0 && <> · <span className="font-bold text-slate-700">{summary.herd.lactating}</span> milking</>}
          </p>
        )}
        {tier === 'BASIC' && summary?.windowDays && (
          <p className="mt-2 text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
            <Info size={10} /> Everything you record is kept. Free shows the last {summary.windowDays} days.
          </p>
        )}
      </section>

      {/* ── Desktop composition ──────────────────────────────────────────
          On a phone this stacks in the order a farmer works: record, then
          what they keep, then what they logged. On `lg` it becomes a real
          two-column app — the work area (record + history) beside a standing
          rail of the herd, because "what do I own" is reference you glance at
          while entering, not a step in the flow.

          The columns are placed explicitly rather than by DOM order so the
          phone order stays untouched: a `row-span-2` rail would otherwise have
          to be moved above `Recent` in the markup and would then render in the
          wrong place on mobile. */}
      {/* ⚠️ `grid-cols-1` is LOAD-BEARING and is why this scrolled sideways on a
          phone. Without an explicit mobile track, `grid-template-columns` is
          `none`, so items land in an IMPLICIT column sized `auto` — and an
          `auto` track's maximum is **max-content**, which (unlike `1fr`) is NOT
          clamped to the container. The Record section's max-content is both
          hint strings unwrapped side by side ("What came off the farm, and what
          you sold it for" …), about 500px, so the track grew past a 366px
          content box and every child overflowed with it.
          Tailwind's `grid-cols-1` is `repeat(1, minmax(0, 1fr))` — the
          `minmax(0, …)` is the part that fixes it. */}
      <div className="grid grid-cols-1 gap-4 lg:gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">

      {/* ── The four actions ─────────────────────────────────────────────── */}
      <section className="min-w-0 lg:col-start-1 lg:row-start-1">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Record</h3>
        {/* 2-up on a phone, 4-up from `md`. At full width each of these was a
            ~700px slab for a one-line action. */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2 lg:gap-2.5">
          {SHEETS.map(({ key, label, icon: Icon, tone, hint }) => (
            <button
              key={key}
              onClick={() => openSheet(key)}
              className={`rounded-2xl border p-3.5 text-left transition-transform active:scale-[0.98] ${TONES[tone]}`}
            >
              <Icon size={18} />
              <p className="mt-1.5 text-sm font-black">{label}</p>
              <p className="text-[10px] opacity-70 leading-tight mt-0.5">{hint}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ── The herd — the standing rail on desktop ──────────────────────── */}
      <section className="min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-20">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
            My animals
            {groupLimit > 0 && <span className="ml-1 text-slate-300">{groups.length}/{groupLimit}</span>}
          </h3>
          <button
            className="text-[10px] font-black uppercase tracking-widest cp-accent-text flex items-center gap-1 disabled:opacity-40"
            onClick={() => setAddHerd(true)}
            disabled={atGroupLimit}
            title={atGroupLimit ? `Free covers ${groupLimit} herds` : undefined}
          >
            <Plus size={12} /> Add
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="cp-card text-center px-5 py-8">
            <p className="text-sm font-bold text-slate-700">Tell us what you keep</p>
            <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
              Cows, goats, pigs, chickens — add each kind once, then record against it as
              you go.
            </p>
            <button className="cp-btn mt-3 inline-flex items-center gap-1.5" onClick={() => setAddHerd(true)}>
              <Plus size={14} /> Add animals
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 lg:gap-1.5">
            {groups.map((g) => {
              const chips = [
                ['♂', g.males], ['♀', g.females],
                ['Adult', g.adults], ['Young', g.young],
                ['Pregnant', g.pregnant], ['Milking', g.lactating],
              ].filter(([, v]) => Number(v) > 0);
              return (
                <div key={g.id} className="cp-card p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{g.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {[g.species, g.breed].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xl font-black text-slate-800 leading-none">{g.headCount}</p>
                      <button
                        className="mt-1 text-[10px] font-black uppercase tracking-widest cp-accent-text flex items-center gap-1"
                        onClick={() => openComposition(g)}
                      >
                        <Pencil size={10} /> Update
                      </button>
                    </div>
                  </div>
                  {chips.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {chips.map(([label, v]) => (
                        <span key={String(label)} className="px-2 py-0.5 rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600">
                          {label} {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {atGroupLimit && (
              <p className="text-[10px] text-slate-400 text-center pt-1">
                Free covers {groupLimit} kinds of animal. Upgrade to add more.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── What has been recorded ───────────────────────────────────────── */}
      <section className="min-w-0 lg:col-start-1 lg:row-start-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Recent</h3>
        {entries.length === 0 ? (
          <div className="cp-card text-center px-5 py-6 text-xs text-slate-400">
            Nothing recorded yet. Use the buttons above as things happen.
          </div>
        ) : (
          /**
           * ⚠️ ONE container, not one card per line.
           *
           * Each entry used to be its own full-width `cp-card` — a ~1000px pill
           * holding two short strings and a number, with a metre of nothing in
           * the middle and 84px of height apiece. Six records filled a desktop
           * screen. A money history is a LIST: the value of it is scanning down
           * the amounts, and per-row card chrome breaks that column into
           * fragments while costing three times the vertical space.
           *
           * Date leads the row and repeats only when it changes, so a day's
           * entries read as a group without needing a heading row.
           */
          <div className="cp-card overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800">
            {entries.map((e, i) => {
              const sameDayAsPrev = i > 0 && entries[i - 1].entryDate === e.entryDate;
              return (
                <div
                  key={e.id}
                  className="group flex items-baseline gap-3 px-3.5 sm:px-4 py-2 hover:bg-slate-50/70 dark:hover:bg-white/[0.03] transition-colors"
                >
                  {/* Fixed-width date gutter is what makes every row below it
                      line up; blank on a repeat so the eye groups the day. */}
                  <span className="shrink-0 w-[76px] sm:w-[92px] text-[10px] font-bold uppercase tracking-wider text-slate-400 tabular-nums">
                    {sameDayAsPrev ? '' : fmtDay(e.entryDate)}
                    {e.entryTime && (
                      <span className="ml-1 font-normal normal-case tracking-normal text-slate-300 dark:text-zinc-600">
                        {e.entryTime}
                      </span>
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-slate-800 dark:text-zinc-100 truncate leading-snug">
                      {e.item}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {[
                        labelFor(e.category),
                        e.quantity != null ? `${e.quantity}${e.unit ? ` ${e.unit.toLowerCase()}` : ''}` : null,
                        e.animalGroupName,
                        e.vendorSupplierName || e.vendorName,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>

                  <span className={`shrink-0 text-[13px] font-black tabular-nums ${
                    e.direction === 'INCOME' ? 'text-emerald-600' : 'text-slate-600 dark:text-zinc-300'
                  }`}>
                    {e.direction === 'INCOME' ? '+' : '−'}{KES(e.amount)}
                  </span>

                  {/* Reveals on hover, holds its width always — a delete that
                      appears from nowhere shifts the amount column under the
                      cursor mid-scan. */}
                  <button
                    className="shrink-0 p-1 text-transparent group-hover:text-slate-300 hover:!text-rose-500 focus:text-slate-400 transition-colors"
                    onClick={() => remove(e)}
                    title="Delete this record"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      </div>

      {/* ── The one record sheet ─────────────────────────────────────────── */}
      {sheet && sheetDef && (
        <CpModal onClose={() => setSheet(null)} title={sheetDef.label}>
          <div className="space-y-3">
            {/* The kind, as chips. A dropdown here reads as paperwork. */}
            <div className="flex flex-wrap gap-1.5">
              {categoryChoices.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => pickCategory(c.key)}
                  className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    category === c.key ? 'bg-pine text-white border-pine' : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div>
              <label className="cp-label">What was it?</label>
              <input
                className="cp-input w-full"
                placeholder={isIncome(category) ? 'Morning milk' : 'Dairy meal'}
                value={item}
                onChange={(e) => setItem(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="cp-label">How much {unit ? `(${unit.toLowerCase()})` : ''}</label>
                <input
                  className="cp-input w-full" type="number" inputMode="decimal" min="0"
                  placeholder="0" value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div>
                <label className="cp-label">{isIncome(category) ? 'Money in (KES)' : 'Money out (KES)'}</label>
                <input
                  className="cp-input w-full" type="number" inputMode="decimal" min="0"
                  placeholder="0" value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            {groups.length > 0 && (
              <div>
                <label className="cp-label">
                  Which animals?
                  <span className="text-slate-400 font-normal normal-case tracking-normal"> — optional</span>
                </label>
                <select className="cp-input w-full" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  <option value="">The whole farm</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}

            {wantsVendor && (
              <VendorField
                value={vendor}
                supplierId={vendorId}
                onChange={(name, id) => { setVendor(name); setVendorId(id); }}
              />
            )}

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="cp-label !mb-0">When</label>
                <div className="flex gap-1">
                  {QUICK_TIMES.map((q) => (
                    <button
                      key={q.value}
                      type="button"
                      onClick={() => setEntryTime(q.value)}
                      className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                        entryTime === q.value
                          ? 'bg-pine text-white border-pine'
                          : 'bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  className="cp-input w-full" type="date" value={entryDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
                <input
                  className="cp-input" type="time" value={entryTime}
                  onChange={(e) => setEntryTime(e.target.value)}
                  title="Leave empty if you are recording something from a while back"
                />
              </div>
            </div>

            <button className="cp-btn w-full" onClick={submit} disabled={saving || !item.trim()}>
              {saving ? 'Saving…' : 'Record it'}
            </button>
          </div>
        </CpModal>
      )}

      {/* ── Add a herd ───────────────────────────────────────────────────── */}
      {addHerd && (
        <CpModal onClose={() => setAddHerd(false)} title="Add animals">
          <div className="space-y-3">
            <div>
              <label className="cp-label">What are they?</label>
              <input
                className="cp-input w-full" placeholder="Cattle, goats, pigs, chickens…"
                value={herdSpecies} onChange={(e) => setHerdSpecies(e.target.value)} autoFocus
              />
            </div>
            <div>
              <label className="cp-label">Call this group</label>
              <input
                className="cp-input w-full" placeholder="Dairy cows"
                value={herdName} onChange={(e) => setHerdName(e.target.value)}
              />
            </div>
            <p className="text-xs text-slate-500">
              Add the numbers — how many male, female, pregnant, milking — on the next screen.
            </p>
            <button className="cp-btn w-full" onClick={createHerd}
              disabled={saving || !herdName.trim() || !herdSpecies.trim()}>
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
        </CpModal>
      )}

      {/* ── Composition ──────────────────────────────────────────────────── */}
      {editHerd && (
        <CpModal onClose={() => setEditHerd(null)} title={editHerd.name}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {COMPOSITION_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="cp-label">{f.label}</label>
                  <input
                    className="cp-input w-full" type="number" inputMode="numeric" min="0"
                    value={comp[f.key] ?? ''}
                    onChange={(e) => setComp((c) => ({ ...c, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            {compHint && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                {compHint} Save it anyway if that is right.
              </p>
            )}
            <button className="cp-btn w-full" onClick={saveComposition} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </CpModal>
      )}
    </div>
  );
};

export default ClientFarmRecords;
