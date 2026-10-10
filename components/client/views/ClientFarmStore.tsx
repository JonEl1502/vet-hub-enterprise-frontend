/**
 * Store — what the farm has in hand: feed, hay, salt, minerals, drugs, supplies.
 * Bought stock goes in (and, with a price, is also filed as a farm expense);
 * feeding takes it out. Counted in one base unit per item, entered in whatever
 * the farmer bought it in — kg, a 20/50/100 kg bag, a bale, litres.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2, AlertTriangle, ArrowDownToLine, ClipboardCheck, Wheat } from 'lucide-react';
import {
  clientPortalAPI, type PortalFarm, type FarmStockItem, type FarmStockMovement, type StockCategory,
} from '../../../services/modules/clientPortal.api';
import { toast } from '../../../services';
import CpModal from '../CpModal';
import CpPage from '../CpPage';
import { Chip, onEnter, localToday } from './AnimalRecordForms';
import { STOCK_CATEGORIES, catOf, unitChoices, fmtQty, packHint } from './farmStock';

/** The store as a short list for the farm home: what is low first, then the rest. */
export const FarmStoreCard: React.FC<{ farmId: string }> = ({ farmId }) => {
  const [items, setItems] = useState<FarmStockItem[] | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    clientPortalAPI.listFarmStock(farmId).then((r) => setItems(r.success && r.data ? r.data.items : [])).catch(() => setItems([]));
  }, [farmId]);
  if (items === null) return null;
  const sorted = [...items].sort((a, b) => Number(b.low || b.empty) - Number(a.low || a.empty));
  const low = items.filter((i) => i.low || (i.empty && i.minThreshold > 0)).length;
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Store</h3>
        <div className="flex items-center gap-3">
          {items.length > 0 && (
            <button className="text-[10px] font-black uppercase tracking-widest cp-accent-text" onClick={() => navigate('/client/farm/store')}>Open store</button>
          )}
          <button className="text-[10px] font-black uppercase tracking-widest cp-accent-text" onClick={() => navigate('/client/farm/store')} data-testid="store-add-link">
            + Add item
          </button>
        </div>
      </div>
      {items.length === 0 ? (
        <button className="cp-card p-4 w-full text-left" onClick={() => navigate('/client/farm/store')}>
          <p className="text-sm font-black text-slate-800 dark:text-zinc-100">Keep track of feed, salt and supplies</p>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Add what you have and it goes down as you feed — you will see what is running low.</p>
        </button>
      ) : (
        <div className="cp-card overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800">
          {low > 0 && (
            <p className="px-3.5 py-2 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 flex items-center gap-1.5">
              <AlertTriangle size={12} /> {low} running low
            </p>
          )}
          {sorted.slice(0, 4).map((i) => {
            const Icon = catOf(i.category).icon;
            return (
              <button key={i.id} className="w-full px-3.5 py-2.5 flex items-center gap-3 text-left" onClick={() => navigate('/client/farm/store')}>
                <span className="cp-icon-chip"><Icon size={16} /></span>
                <span className="flex-1 min-w-0 text-sm font-bold text-slate-800 dark:text-zinc-100 truncate">{i.name}</span>
                <span className={`text-sm font-black tabular-nums ${i.low || i.empty ? 'text-amber-600' : 'text-slate-700 dark:text-zinc-200'}`}>{fmtQty(i)}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

type Dialog = { kind: 'ADD' } | { kind: 'STOCK'; item: FarmStockItem } | { kind: 'COUNT'; item: FarmStockItem } | { kind: 'HISTORY'; item: FarmStockItem } | null;

const ClientFarmStore: React.FC = () => {
  const [farms, setFarms] = useState<PortalFarm[]>([]);
  const [farmId, setFarmId] = useState('');
  const [items, setItems] = useState<FarmStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const navigate = useNavigate();

  // add item
  const [name, setName] = useState('');
  const [cat, setCat] = useState<StockCategory>('FEED');
  const [min, setMin] = useState('');
  // add stock / count
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('KG');
  const [price, setPrice] = useState('');
  const [vendor, setVendor] = useState('');
  const [baleKg, setBaleKg] = useState('');
  const [history, setHistory] = useState<FarmStockMovement[] | null>(null);

  useEffect(() => {
    clientPortalAPI.getMyFarms({ showError: false }).then((r) => {
      if (r.success && r.data?.farms) { setFarms(r.data.farms); if (r.data.farms[0]) setFarmId(r.data.farms[0].id); }
    }).finally(() => setLoading(false));
  }, []);

  const load = useCallback(() => {
    if (!farmId) return;
    clientPortalAPI.listFarmStock(farmId).then((r) => { if (r.success && r.data) setItems(r.data.items); });
  }, [farmId]);
  useEffect(() => { load(); }, [load]);

  const open = (d: Dialog) => {
    setDialog(d); setQty(''); setPrice(''); setVendor(''); setBaleKg('');
    if (d && 'item' in d) setUnit(d.item.baseUnit);
    if (d?.kind === 'ADD') { setName(''); setCat('FEED'); setMin(''); }
    if (d?.kind === 'HISTORY') {
      setHistory(null);
      clientPortalAPI.farmStockMovements(d.item.id).then((r) => setHistory(r.success && r.data ? r.data.movements : []));
    }
  };

  const addItem = async () => {
    if (!name.trim()) { toast.error('Name it — "Dairy meal", "Hay", "Salt lick"'); return; }
    setSaving(true);
    try {
      const r = await clientPortalAPI.createFarmStockItem(farmId, {
        name: name.trim(), category: cat, baseUnit: catOf(cat).unit, minThreshold: min === '' ? null : Number(min),
      });
      if (r.success && r.data) { setDialog(null); load(); open({ kind: 'STOCK', item: r.data.item }); }
    } finally { setSaving(false); }
  };

  const needsBale = (item: FarmStockItem) => unit === 'BALE' && !item.baleKg;
  const submitStock = async (item: FarmStockItem) => {
    const n = Number(qty);
    if (!(n > 0)) { toast.error('How much did you get?'); return; }
    if (needsBale(item) && !(Number(baleKg) > 0)) { toast.error('How many kg in one bale?'); return; }
    setSaving(true);
    try {
      if (needsBale(item)) await clientPortalAPI.updateFarmStockItem(item.id, { baleKg: Number(baleKg) });
      const r = await clientPortalAPI.purchaseFarmStock(item.id, {
        quantity: n, unit, amount: price === '' ? null : Number(price), vendorName: vendor.trim() || undefined, date: localToday(),
      });
      if (r.success) { toast.success(`${item.name} added`); setDialog(null); load(); }
    } finally { setSaving(false); }
  };

  const submitCount = async (item: FarmStockItem) => {
    if (qty === '' || !(Number(qty) >= 0)) { toast.error('Enter what is on hand now — 0 if it has run out'); return; }
    setSaving(true);
    try {
      if (needsBale(item) && Number(qty) > 0) {
        if (!(Number(baleKg) > 0)) { toast.error('How many kg in one bale?'); setSaving(false); return; }
        await clientPortalAPI.updateFarmStockItem(item.id, { baleKg: Number(baleKg) });
      }
      const r = await clientPortalAPI.adjustFarmStock(item.id, { quantity: Number(qty), unit });
      if (r.success) { toast.success('Store updated'); setDialog(null); load(); }
    } finally { setSaving(false); }
  };

  if (loading) return <div className="cp-card px-5 py-12 text-center"><Loader2 size={16} className="animate-spin mx-auto text-slate-400" /></div>;
  if (farms.length === 0) {
    return (
      <div className="cp-card px-5 py-12 text-center">
        <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">Add your farm first</p>
        <button className="cp-btn mt-3" onClick={() => navigate('/client/farm')}>Go to My Farm</button>
      </div>
    );
  }

  const unitRow = (item: FarmStockItem) => (
    <>
      <div className="flex flex-wrap gap-1.5">
        {unitChoices(item).map((u) => <Chip key={u.code} active={unit === u.code} onClick={() => setUnit(u.code)}>{u.label}</Chip>)}
      </div>
      {needsBale(item) && (
        <div className="mt-2">
          <label className="cp-label">How many kg in one bale?</label>
          <input className="cp-input w-full" type="number" inputMode="decimal" min="0" placeholder="e.g. 20" value={baleKg} onChange={(e) => setBaleKg(e.target.value)} />
        </div>
      )}
    </>
  );

  const groupsByCat = STOCK_CATEGORIES.map((c) => ({ c, rows: items.filter((i) => i.category === c.key) })).filter((g) => g.rows.length);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-zinc-100">Store</h2>
          <p className="text-xs text-slate-500">Feed, salt, drugs and supplies on hand</p>
        </div>
        <button className="cp-btn !py-2 !px-3.5 !text-xs flex items-center gap-1.5" onClick={() => open({ kind: 'ADD' })}><Plus size={14} /> Add item</button>
      </div>

      {farms.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {farms.map((f) => (
            <button key={f.id} onClick={() => setFarmId(f.id)}
              className={`px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap ${f.id === farmId ? 'bg-pine text-white shadow' : 'bg-white text-slate-500 border border-slate-200'}`}>{f.name}</button>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="cp-card px-5 py-10 text-center">
          <Wheat size={22} className="mx-auto cp-accent-text" />
          <p className="mt-2 text-sm font-black text-slate-800 dark:text-zinc-100">Nothing in the store yet</p>
          <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">Add dairy meal, hay, salt — whatever you feed. When you record a feeding it comes off the balance.</p>
          <button className="cp-btn mt-4" onClick={() => open({ kind: 'ADD' })}>Add your first item</button>
        </div>
      ) : groupsByCat.map(({ c, rows }) => (
        <section key={c.key}>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">{c.label}</h3>
          <div className="cp-card overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800">
            {rows.map((i) => (
              <div key={i.id} className="px-3.5 py-3">
                <div className="flex items-center gap-3">
                  <span className="cp-icon-chip"><c.icon size={16} /></span>
                  <button className="flex-1 min-w-0 text-left" onClick={() => open({ kind: 'HISTORY', item: i })}>
                    <p className="text-sm font-black text-slate-800 dark:text-zinc-100 truncate">{i.name}</p>
                    <p className="text-[10px] text-slate-400">{packHint(i) ?? (i.empty ? 'None left' : 'On hand')}</p>
                  </button>
                  <div className="text-right">
                    <p className={`text-base font-black tabular-nums ${i.low || i.empty ? 'text-amber-600' : 'text-slate-800 dark:text-zinc-100'}`}>{fmtQty(i)}</p>
                    {(i.low || i.empty) && <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">{i.empty ? 'Out' : 'Low'}</p>}
                  </div>
                </div>
                <div className="mt-2.5 flex gap-2">
                  <button className="cp-btn-ghost flex-1 !py-2 !text-[11px] flex items-center justify-center gap-1.5" onClick={() => open({ kind: 'STOCK', item: i })}>
                    <ArrowDownToLine size={13} /> Add stock
                  </button>
                  <button className="cp-btn-ghost flex-1 !py-2 !text-[11px] flex items-center justify-center gap-1.5" onClick={() => open({ kind: 'COUNT', item: i })}>
                    <ClipboardCheck size={13} /> Count it
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {items.length > 0 && (
        <button className="cp-btn w-full !py-3 flex items-center justify-center gap-2" onClick={() => open({ kind: 'ADD' })} data-testid="add-item-bottom">
          <Plus size={16} /> Add item to store
        </button>
      )}

      {dialog?.kind === 'ADD' && (
        <CpModal title="Add to store" onClose={() => setDialog(null)}>
          <div className="space-y-3">
            <input className="cp-input w-full" placeholder="Name — Dairy meal, Hay, Salt lick…" value={name} autoFocus
              onChange={(e) => setName(e.target.value)} onKeyDown={onEnter(addItem)} />
            <div className="flex flex-wrap gap-1.5">
              {STOCK_CATEGORIES.map((c) => <Chip key={c.key} active={cat === c.key} onClick={() => setCat(c.key)}>{c.label}</Chip>)}
            </div>
            <div>
              <label className="cp-label">Warn me when it is below <span className="text-slate-400 font-normal normal-case tracking-normal">— optional, in {catOf(cat).unit === 'KG' ? 'kg' : catOf(cat).unit === 'L' ? 'litres' : 'pieces'}</span></label>
              <input className="cp-input w-full" type="number" inputMode="decimal" min="0" placeholder="e.g. 50" value={min} onChange={(e) => setMin(e.target.value)} />
            </div>
            <button className="cp-btn w-full" disabled={saving} onClick={addItem}>{saving ? 'Adding…' : 'Add and enter stock'}</button>
          </div>
        </CpModal>
      )}

      {dialog?.kind === 'STOCK' && (
        <CpModal title={`Add ${dialog.item.name}`} onClose={() => setDialog(null)}>
          <div className="space-y-3">
            <div>
              <label className="cp-label">How much did you get?</label>
              <input className="cp-input w-full text-center text-2xl font-black tabular-nums" type="number" inputMode="decimal" min="0" step="0.1" placeholder="0"
                value={qty} autoFocus onChange={(e) => setQty(e.target.value)} onKeyDown={onEnter(() => submitStock(dialog.item))} />
              <div className="mt-2">{unitRow(dialog.item)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="cp-label">Cost (KES) <span className="text-slate-400 font-normal normal-case tracking-normal">— optional</span></label>
                <input className="cp-input w-full" type="number" inputMode="decimal" min="0" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div>
                <label className="cp-label">Bought from</label>
                <input className="cp-input w-full" placeholder="Agrovet" value={vendor} onChange={(e) => setVendor(e.target.value)} />
              </div>
            </div>
            {price !== '' && Number(price) > 0 && <p className="text-[11px] text-slate-500">The cost is also recorded as a farm expense.</p>}
            <button className="cp-btn w-full" disabled={saving} onClick={() => submitStock(dialog.item)}>{saving ? 'Saving…' : 'Add to store'}</button>
          </div>
        </CpModal>
      )}

      {dialog?.kind === 'COUNT' && (
        <CpModal title={`Count ${dialog.item.name}`} onClose={() => setDialog(null)}>
          <div className="space-y-3">
            <p className="text-xs text-slate-500">The store says {fmtQty(dialog.item)}. Enter what is really on hand now.</p>
            <input className="cp-input w-full text-center text-2xl font-black tabular-nums" type="number" inputMode="decimal" min="0" step="0.1" placeholder="0"
              value={qty} autoFocus onChange={(e) => setQty(e.target.value)} onKeyDown={onEnter(() => submitCount(dialog.item))} />
            {unitRow(dialog.item)}
            <button className="cp-btn w-full" disabled={saving} onClick={() => submitCount(dialog.item)}>{saving ? 'Saving…' : 'Set balance'}</button>
          </div>
        </CpModal>
      )}

      {dialog?.kind === 'HISTORY' && (
        <CpModal title={dialog.item.name} onClose={() => setDialog(null)}>
          {history === null ? <div className="py-6 text-center"><Loader2 size={16} className="animate-spin mx-auto text-slate-400" /></div>
            : history.length === 0 ? <p className="text-xs text-slate-500 py-4 text-center">Nothing recorded yet.</p>
            : (
              <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                {history.map((m) => (
                  <div key={m.id} className="py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">{m.kind === 'PURCHASE' ? 'Added' : m.kind === 'USE' ? 'Fed' : 'Counted'}{m.note ? ` · ${m.note}` : ''}</p>
                      <p className="text-[10px] text-slate-400">{new Date(m.occurredAt).toLocaleDateString()}</p>
                    </div>
                    <p className={`text-sm font-black tabular-nums ${m.quantity < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                      {m.quantity > 0 ? '+' : ''}{fmtQty(dialog.item, m.quantity)}
                    </p>
                  </div>
                ))}
              </div>
            )}
        </CpModal>
      )}
    </div>
  );
};

export default ClientFarmStore;
