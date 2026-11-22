import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import {
  clientPortalAPI, type FarmStockItem, type FarmAnimal, type PortalAnimalGroup,
  type PortalFeedingPlan, type FeedingWindow,
} from '../../../services/modules/clientPortal.api';
import { toast } from '../../../services';
import CpPage from '../CpPage';
import { Chip, SubmitButton } from './AnimalRecordForms';
import { unitChoices, unitSize, fmtQty, trim, baseWord } from './farmStock';

/**
 * A repeating feed the farmer sets once (user, 2026-11-22: "a feeding
 * program, whether in general or specific for a specific cow … for those who
 * have paid, they can select the cow or the goat or the flock").
 *
 * What is fed comes from the STORE and is measured in the units the farmer
 * feeds with, so every "Fed" tap takes the right amount off the balance, and
 * the form can say how long the store lasts at this rate.
 */
const PRESETS: FeedingWindow[] = [
  { label: 'Morning', at: '06:30' },
  { label: 'Midday', at: '12:00' },
  { label: 'Evening', at: '18:30' },
];

interface Props {
  farmId: string;
  groups: PortalAnimalGroup[];
  plan?: PortalFeedingPlan | null;
  onDone: () => void;
  onCancel: () => void;
}

const FeedingPlanForm: React.FC<Props> = ({ farmId, groups, plan, onDone, onCancel }) => {
  const [items, setItems] = useState<FarmStockItem[] | null>(null);
  const [animals, setAnimals] = useState<FarmAnimal[]>([]);
  const [name, setName] = useState(plan?.name ?? '');
  const [itemId, setItemId] = useState(plan?.stockItemId ?? '');
  const [qty, setQty] = useState(plan?.quantity != null ? String(plan.quantity) : '');
  const [unit, setUnit] = useState(plan?.unit ?? '');
  const [who, setWho] = useState<'ALL' | 'GROUP' | 'ANIMAL'>(plan?.farmAnimalId ? 'ANIMAL' : plan?.animalGroupId ? 'GROUP' : 'ALL');
  const [groupId, setGroupId] = useState(plan?.animalGroupId ?? '');
  const [animalId, setAnimalId] = useState(plan?.farmAnimalId ?? '');
  const [windows, setWindows] = useState<FeedingWindow[]>(plan?.windows?.length ? plan.windows.map(({ label, at }) => ({ label, at })) : [PRESETS[0], PRESETS[2]]);
  const [customLabel, setCustomLabel] = useState('');
  const [customAt, setCustomAt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    clientPortalAPI.listFarmStock(farmId).then((r) => {
      const list = r.success && r.data ? r.data.items : [];
      setItems(list);
      if (!itemId && list[0]) setItemId(list[0].id);
    }).catch(() => setItems([]));
    clientPortalAPI.listFarmAnimals(farmId, {}, { showError: false } as any)
      .then((r) => { if (r.success && r.data) setAnimals(r.data.animals); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  const item = useMemo(() => items?.find((i) => i.id === itemId) ?? null, [items, itemId]);
  useEffect(() => {
    if (!item) return;
    const allowed = unitChoices(item, 'DISPENSE').map((u) => u.code);
    if (!allowed.includes(unit)) setUnit(item.baseUnit);
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const n = Number(qty);
  const size = item ? unitSize(item, unit) : null;
  const ration = item && size && n > 0 ? n * size : null;
  const perDay = ration != null ? ration * windows.length : null;
  const lasts = item && perDay && perDay > 0 ? Math.floor(item.quantity / perDay) : null;
  const unitName = item ? unitChoices(item, 'DISPENSE').find((u) => u.code === unit)?.label ?? unit : '';

  const toggle = (w: FeedingWindow) =>
    setWindows((ws) => (ws.some((x) => x.label === w.label) ? ws.filter((x) => x.label !== w.label) : [...ws, w].sort((a, b) => a.at.localeCompare(b.at))));
  const addCustom = () => {
    if (!customLabel.trim() || !/^\d{2}:\d{2}$/.test(customAt)) { toast.error('Give the time a name and a clock time'); return; }
    if (windows.length >= 6) { toast.error('Six feeding times a day is the most'); return; }
    setWindows((ws) => [...ws, { label: customLabel.trim(), at: customAt }].sort((a, b) => a.at.localeCompare(b.at)));
    setCustomLabel(''); setCustomAt('');
  };

  const valid = !!name.trim() && !!item && n > 0 && !!size && windows.length > 0
    && (who !== 'GROUP' || !!groupId) && (who !== 'ANIMAL' || !!animalId);

  const save = async () => {
    if (!valid || !item) return;
    setSaving(true);
    try {
      const body = {
        name: name.trim(), stockItemId: item.id, quantity: n, unit, windows,
        animalGroupId: who === 'GROUP' ? groupId : null, farmAnimalId: who === 'ANIMAL' ? animalId : null,
      };
      const r = plan ? await clientPortalAPI.updateFeedingPlan(plan.id, body) : await clientPortalAPI.createFeedingPlan(farmId, body);
      if (r.success) { toast.success(plan ? 'Plan updated' : 'Feeding plan saved'); onDone(); }
    } finally { setSaving(false); }
  };

  const stop = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      const r = await clientPortalAPI.stopFeedingPlan(plan.id);
      if (r.success) { toast.success('Plan stopped — its history stays'); onDone(); }
    } finally { setSaving(false); }
  };

  return (
    <CpPage
      title={plan ? `Edit ${plan.name}` : 'New feeding plan'}
      subtitle="Set it once. Each time you tap Fed, the ration comes off your store."
      onBack={onCancel}
      actions={plan ? (
        <button type="button" onClick={stop} disabled={saving} className="cp-btn-ghost !py-1.5 !px-3 !text-xs flex items-center gap-1.5 text-rose-600">
          <Trash2 size={13} /> Stop plan
        </button>
      ) : undefined}
    >
      <div className="space-y-4">
        <div>
          <label className="cp-label">Call it</label>
          <input className="cp-input w-full" placeholder="Morning dairy meal, Layers mash…" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label className="cp-label">What is fed — from your store</label>
          {items === null ? <p className="text-xs text-slate-400">Loading your store…</p>
            : items.length === 0 ? <p className="text-xs text-amber-700">Your store is empty. Add the feed under Store first, then come back.</p>
            : (
              <div className="flex flex-wrap gap-1.5">
                {items.map((i) => <Chip key={i.id} active={i.id === itemId} onClick={() => setItemId(i.id)}>{i.name} · {fmtQty(i)}</Chip>)}
              </div>
            )}
        </div>

        {item && (
          <div>
            <label className="cp-label">How much each time</label>
            <input className="cp-input w-full text-center text-2xl font-black tabular-nums" type="number" inputMode="decimal" min="0" step="any" placeholder="0"
              value={qty} onChange={(e) => setQty(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {unitChoices(item, 'DISPENSE').map((u) => <Chip key={u.code} active={unit === u.code} onClick={() => setUnit(u.code)}>{u.label}</Chip>)}
            </div>
            {unit === 'BALE' && !item.baleKg && <p className="mt-1.5 text-[11px] text-amber-700">Set how many kg a bale weighs (Store → Units) to feed by the bale.</p>}
          </div>
        )}

        <div>
          <label className="cp-label">Who eats it</label>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={who === 'ALL'} onClick={() => setWho('ALL')}>All animals</Chip>
            {groups.length > 0 && <Chip active={who === 'GROUP'} onClick={() => setWho('GROUP')}>A herd / flock</Chip>}
            {animals.length > 0 && <Chip active={who === 'ANIMAL'} onClick={() => setWho('ANIMAL')}>One animal</Chip>}
          </div>
          {who === 'GROUP' && (
            <select className="cp-input w-full mt-2" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Choose…</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.headCount})</option>)}
            </select>
          )}
          {who === 'ANIMAL' && (
            <select className="cp-input w-full mt-2" value={animalId} onChange={(e) => setAnimalId(e.target.value)}>
              <option value="">Choose…</option>
              {animals.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </div>

        <div>
          <label className="cp-label">When, every day</label>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((w) => <Chip key={w.label} active={windows.some((x) => x.label === w.label)} onClick={() => toggle(w)}>{w.label} · {w.at}</Chip>)}
            {windows.filter((w) => !PRESETS.some((p) => p.label === w.label)).map((w) => (
              <span key={w.label} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-emerald-600 text-white">
                {w.label} · {w.at}
                <button type="button" aria-label={`Remove ${w.label}`} onClick={() => setWindows((ws) => ws.filter((x) => x.label !== w.label))}><X size={11} /></button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input className="cp-input flex-1 min-w-0" placeholder="Another time — e.g. Night" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
            <input className="cp-input w-28" type="time" value={customAt} onChange={(e) => setCustomAt(e.target.value)} />
            <button type="button" className="cp-btn-ghost !px-3" onClick={addCustom} aria-label="Add feeding time"><Plus size={15} /></button>
          </div>
        </div>

        {item && ration != null && (
          <div className="cp-card-soft px-3.5 py-3 text-[12px] leading-relaxed">
            Each feed: <b>{trim(n)} {unitName}</b>{unit !== item.baseUnit && <> = {trim(ration)} {baseWord(item.baseUnit)}</>}.
            {' '}A day: <b>{trim(perDay ?? 0)} {baseWord(item.baseUnit)}</b> ({windows.length}×).
            {' '}{lasts != null && (lasts > 0
              ? <>Your store ({fmtQty(item)}) lasts about <b>{lasts} {lasts === 1 ? 'day' : 'days'}</b> on this plan.</>
              : <span className="text-amber-700">Your store has less than a day of this — add stock.</span>)}
          </div>
        )}

        <SubmitButton saving={saving} disabled={!valid} onClick={save}>{plan ? 'Save changes' : 'Save feeding plan'}</SubmitButton>
      </div>
    </CpPage>
  );
};

export default FeedingPlanForm;
