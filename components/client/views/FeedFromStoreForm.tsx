/**
 * Record a feeding FROM the farm store: pick what was fed, who ate it (all the
 * animals, a herd, or one animal), how much and in what — kg, a 20/50/100 kg bag,
 * a bale, litres — and when. One write: the feeding log and the stock balance
 * move together on the server, so "how much is left" is never a second chore.
 *
 * ⚠️ Per-animal feeding is the Farmer plan. On the free rung the same form works
 * for the whole farm or a herd, which is all a free record book ever tracked.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, AlertTriangle, Loader2 } from 'lucide-react';
import {
  clientPortalAPI, type FarmStockItem, type PortalAnimalGroup, type FarmAnimal, type StockCategory,
} from '../../../services/modules/clientPortal.api';
import { toast } from '../../../services';
import { Chip, WhenRow, SubmitButton, onEnter, localToday } from './AnimalRecordForms';
import { STOCK_CATEGORIES, catOf, unitChoices, fmtQty } from './farmStock';

const TIMES = [
  { label: 'Morning', value: '06:30' },
  { label: 'Midday', value: '12:00' },
  { label: 'Evening', value: '18:30' },
] as const;

const lastUnit = (itemId: string) => { try { return localStorage.getItem(`vh:feedunit:${itemId}`) ?? ''; } catch { return ''; } };

interface Props {
  farmId: string;
  groups: PortalAnimalGroup[];
  /** Named animals — empty on the free rung. */
  animals: FarmAnimal[];
  isFull: boolean;
  /** Opened from one animal's page: fixed target, no "who" choice. */
  animal?: FarmAnimal;
  presetItemId?: string;
  onDone: () => void;
}

const FeedFromStoreForm: React.FC<Props> = ({ farmId, groups, animals, isFull, animal, presetItemId, onDone }) => {
  const [items, setItems] = useState<FarmStockItem[] | null>(null);
  const [itemId, setItemId] = useState(presetItemId ?? '');
  const [who, setWho] = useState<'ALL' | 'GROUP' | 'ANIMAL'>('ALL');
  const [groupId, setGroupId] = useState('');
  const [animalId, setAnimalId] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('KG');
  const [baleKg, setBaleKg] = useState('');
  const [date, setDate] = useState(localToday());
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState<StockCategory>('FEED');

  useEffect(() => {
    clientPortalAPI.listFarmStock(farmId).then((r) => {
      const list = r.success && r.data ? r.data.items : [];
      setItems(list);
      if (list.length === 0) setAdding(true);
      else if (!itemId) setItemId(list[0].id);
    }).catch(() => setItems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  const item = useMemo(() => items?.find((i) => i.id === itemId) ?? null, [items, itemId]);
  useEffect(() => {
    if (!item) return;
    const remembered = lastUnit(item.id);
    const allowed = unitChoices(item).map((u) => u.code);
    setUnit(remembered && allowed.includes(remembered) ? remembered : item.baseUnit);
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const needsBale = unit === 'BALE' && item && !item.baleKg;
  const n = qty === '' ? null : Number(qty);
  const valid = !!item && n != null && Number.isFinite(n) && n > 0
    && (who !== 'GROUP' || !!groupId) && (who !== 'ANIMAL' || !!animalId)
    && (!needsBale || Number(baleKg) > 0);

  const addItem = async () => {
    const name = newName.trim();
    if (!name) { toast.error('Name it — "Dairy meal", "Hay", "Salt lick"'); return; }
    setSaving(true);
    try {
      const r = await clientPortalAPI.createFarmStockItem(farmId, { name, category: newCat, baseUnit: catOf(newCat).unit });
      if (r.success && r.data) {
        setItems((cur) => [...(cur ?? []), r.data!.item]);
        setItemId(r.data.item.id);
        setAdding(false); setNewName('');
      }
    } finally { setSaving(false); }
  };

  const submit = async () => {
    if (!valid || !item || n == null) return;
    setSaving(true);
    try {
      if (needsBale) await clientPortalAPI.updateFarmStockItem(item.id, { baleKg: Number(baleKg) });
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const custom = date !== localToday() || time !== '';
      const fedAt = custom ? new Date(`${date}T${time || hhmm}:00`).toISOString() : undefined;
      const r = await clientPortalAPI.useFarmStock(farmId, {
        itemId: item.id, quantity: n, unit,
        ...(animal ? { farmAnimalId: animal.id } : who === 'ANIMAL' ? { farmAnimalId: animalId } : who === 'GROUP' ? { animalGroupId: groupId } : {}),
        ...(fedAt ? { fedAt } : {}),
      });
      if (r.success && r.data) {
        try { localStorage.setItem(`vh:feedunit:${item.id}`, unit); } catch { /* fine */ }
        if (r.data.ranShort) toast.warning(`Recorded — but your store showed ${fmtQty(item)}. Add what you bought so the balance stays right.`);
        else toast.success(`Fed ${n} ${unitChoices(item).find((u) => u.code === unit)?.label ?? ''} of ${item.name}`.replace(/\s+/g, ' '));
        onDone();
      }
    } finally { setSaving(false); }
  };

  if (items === null) return <div className="py-8 text-center"><Loader2 size={16} className="animate-spin mx-auto text-slate-400" /></div>;

  return (
    <div className="space-y-3.5">
      {/* What */}
      <div>
        <label className="cp-label">What did you feed?</label>
        <div className="flex flex-wrap gap-1.5">
          {items.map((i) => (
            <Chip key={i.id} active={i.id === itemId && !adding} onClick={() => { setItemId(i.id); setAdding(false); }}>
              {i.name} · {fmtQty(i)}
            </Chip>
          ))}
          <Chip active={adding} onClick={() => setAdding(true)}><Plus size={12} className="inline -mt-0.5" /> New item</Chip>
        </div>
        {adding && (
          <div className="mt-2 cp-card-soft p-3 space-y-2">
            <input className="cp-input w-full" placeholder="Name — Dairy meal, Hay, Salt lick…" value={newName}
              onChange={(e) => setNewName(e.target.value)} onKeyDown={onEnter(addItem)} autoFocus />
            <div className="flex flex-wrap gap-1.5">
              {STOCK_CATEGORIES.map((c) => <Chip key={c.key} active={newCat === c.key} onClick={() => setNewCat(c.key)}>{c.label}</Chip>)}
            </div>
            <button type="button" className="cp-btn w-full" disabled={saving} onClick={addItem}>Add to store</button>
          </div>
        )}
      </div>

      {/* Who */}
      {!animal && (
        <div>
          <label className="cp-label">Who ate it?</label>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={who === 'ALL'} onClick={() => setWho('ALL')}>All animals</Chip>
            {groups.length > 0 && <Chip active={who === 'GROUP'} onClick={() => setWho('GROUP')}>A herd / flock</Chip>}
            {isFull && animals.length > 0 && <Chip active={who === 'ANIMAL'} onClick={() => setWho('ANIMAL')}>One animal</Chip>}
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
      )}
      {animal && <p className="text-[11px] text-slate-500">For <b>{animal.name}</b></p>}

      {/* How much */}
      {item && (
        <div>
          <label className="cp-label" htmlFor="feed-store-qty">How much?</label>
          <input id="feed-store-qty" className="cp-input w-full text-center text-2xl font-black tabular-nums" type="number" inputMode="decimal"
            min="0" step="0.1" placeholder="0" value={qty} onChange={(e) => setQty(e.target.value)} onKeyDown={onEnter(submit)} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unitChoices(item).map((u) => <Chip key={u.code} active={unit === u.code} onClick={() => setUnit(u.code)}>{u.label}</Chip>)}
          </div>
          {needsBale && (
            <div className="mt-2">
              <label className="cp-label">How many kg in one bale?</label>
              <input className="cp-input w-full" type="number" inputMode="decimal" min="0" placeholder="e.g. 20" value={baleKg} onChange={(e) => setBaleKg(e.target.value)} />
            </div>
          )}
          {item.empty && (
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <AlertTriangle size={12} /> Your store shows none left — record what you bought under Store.
            </p>
          )}
        </div>
      )}

      <WhenRow date={date} onDate={setDate}>
        <div className="mt-2 flex gap-1.5">
          {TIMES.map((t) => <Chip key={t.value} active={time === t.value} onClick={() => setTime(time === t.value ? '' : t.value)}>{t.label}</Chip>)}
        </div>
      </WhenRow>

      <SubmitButton saving={saving} disabled={!valid} onClick={submit}>Record feeding</SubmitButton>
    </div>
  );
};

export default FeedFromStoreForm;
