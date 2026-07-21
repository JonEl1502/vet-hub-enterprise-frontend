import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, Search, Plus, Loader2, Trash2, Tag, TagsIcon, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useData } from '../../../contexts/DataContext';
import { consumablesAPI, AppointmentConsumable, vaccinePackagesAPI, VaccinePackage } from '../../../services';

interface Props {
  appointmentId: string | number;
  // Called after any change so the parent can refresh the appointment total.
  onChanged?: () => void;
  title?: string;
  // When set, scopes this picker to one service: logged items are tagged with
  // it (via notes) and the list shows only that service's items.
  serviceTag?: string;
  compact?: boolean;
}

const FRACTIONAL_UNITS = new Set(['ml', 'mg', 'g', 'l', 'cc', 'mcg', 'iu']);
const stepFor = (unit?: string) => (unit && FRACTIONAL_UNITS.has(unit.toLowerCase()) ? 0.1 : 1);

/**
 * Reusable consumable logger for any appointment-anchored workflow (inpatient,
 * boarding, grooming). Search inventory → pick → quantity → billable switch →
 * log: deducts stock and (if billable) adds an itemized charge. Logged lines
 * can be toggled billable or removed in place — the inline "edit bill".
 */
const ConsumablePicker: React.FC<Props> = ({ appointmentId, onChanged, title = 'Consumables & items used', serviceTag }) => {
  const { inventory } = useData();
  const [allItems, setAllItems] = useState<AppointmentConsumable[]>([]);
  const items = useMemo(() => serviceTag ? allItems.filter(c => (c.notes || '') === serviceTag) : allItems, [allItems, serviceTag]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyLineId, setBusyLineId] = useState<string | null>(null);

  // Add form
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qty, setQty] = useState<number>(1);
  const [billable, setBillable] = useState(true);
  const [unitPrice, setUnitPrice] = useState<number>(0);

  const [packages, setPackages] = useState<VaccinePackage[]>([]);
  const [applyingPkg, setApplyingPkg] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await consumablesAPI.list(appointmentId);
      if (res.success && res.data) setAllItems(res.data);
    } catch (e) { console.error('Failed to load consumables', e); }
    finally { setLoading(false); }
  }, [appointmentId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { vaccinePackagesAPI.list().then(r => { if (r.success && r.data?.packages) setPackages(r.data.packages); }).catch(() => {}); }, []);

  const applyPackage = async (pkgId: string) => {
    if (!pkgId) return;
    setApplyingPkg(true);
    try {
      const res = await vaccinePackagesAPI.apply(pkgId, appointmentId);
      if (res.success) { toast.success(`Package applied · KES ${(res.data?.total ?? 0).toLocaleString()}`); await load(); onChanged?.(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to apply package'); }
    finally { setApplyingPkg(false); }
  };

  const selected = useMemo(() => inventory.find((i: any) => String(i.id) === selectedId) ?? null, [inventory, selectedId]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [] as any[];
    return inventory.filter((i: any) => `${i.name} ${i.sku} ${i.category}`.toLowerCase().includes(q)).slice(0, 8);
  }, [inventory, search]);

  const pick = (i: any) => {
    setSelectedId(String(i.id));
    setSearch(i.name);
    setQty(stepFor(i.unit));
    setBillable(i.billable !== false);
    setUnitPrice(Number(i.price) || 0);
  };

  const reset = () => { setSelectedId(null); setSearch(''); setQty(1); setBillable(true); setUnitPrice(0); };

  const overStock = selected ? qty > Number(selected.quantity) : false;
  const lineTotal = billable ? unitPrice * qty : 0;

  const add = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await consumablesAPI.log(appointmentId, {
        inventoryItemId: selected.id,
        quantity: qty,
        billable,
        unitPrice: billable ? unitPrice : undefined,
        notes: serviceTag || undefined,
      });
      if (res.success) {
        toast.success(`${selected.name} logged${billable ? ` · KES ${(unitPrice * qty).toLocaleString()}` : ' (non-billable)'}`);
        reset();
        await load();
        onChanged?.();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to log consumable'); }
    finally { setBusy(false); }
  };

  const toggleBillable = async (c: AppointmentConsumable) => {
    setBusyLineId(c.id);
    try {
      const res = await consumablesAPI.update(c.id, { billable: !c.billable });
      if (res.success) { await load(); onChanged?.(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to update'); }
    finally { setBusyLineId(null); }
  };

  const remove = async (c: AppointmentConsumable) => {
    setBusyLineId(c.id);
    try {
      const res = await consumablesAPI.remove(c.id);
      if (res.success) { toast.success('Removed · stock restored'); await load(); onChanged?.(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to remove'); }
    finally { setBusyLineId(null); }
  };

  const billableTotal = items.filter(i => i.billable).reduce((s, i) => s + i.lineTotal, 0);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <Package size={15} className="text-seafoam" />
        <span className="text-[11px] font-black uppercase tracking-widest text-pine dark:text-zinc-200">{title}</span>
        {billableTotal > 0 && <span className="ml-auto text-[11px] font-black text-pine dark:text-zinc-100">KES {billableTotal.toLocaleString()}</span>}
      </div>

      {/* Add form */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); if (selectedId) setSelectedId(null); }}
            placeholder="Search inventory (medicine, glove, syringe…)"
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
          />
          {!selected && matches.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg overflow-hidden">
              {matches.map((i: any) => (
                <button type="button" key={i.id} onClick={() => pick(i)} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-zinc-800">
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-pine dark:text-zinc-100 truncate">{i.name}</span>
                    <span className="block text-[10px] text-slate-400">{i.form ?? 'UNIT'} · {Number(i.quantity)} {i.unit} in stock{i.billable === false ? ' · non-billable' : ''}</span>
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 shrink-0">KES {Number(i.price).toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div className="flex flex-wrap items-end gap-2 p-2.5 bg-slate-50 dark:bg-zinc-950/40 rounded-xl">
            <div>
              <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Qty ({selected.unit})</label>
              <input type="number" min={0} step={stepFor(selected.unit)} value={qty} onChange={e => setQty(Number(e.target.value))}
                className="w-20 px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" />
            </div>
            <button type="button" onClick={() => setBillable(b => !b)} title="Toggle billable"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider border ${billable ? 'bg-seafoam/10 text-seafoam border-seafoam/40' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
              {billable ? <Tag size={12} /> : <TagsIcon size={12} />} {billable ? 'Billable' : 'Non-billable'}
            </button>
            {billable && (
              <div>
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Unit price</label>
                <input type="number" min={0} value={unitPrice} onChange={e => setUnitPrice(Number(e.target.value))}
                  className="w-24 px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" />
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              {billable && <span className="text-sm font-black text-pine dark:text-zinc-100">KES {lineTotal.toLocaleString()}</span>}
              <button type="button" onClick={add} disabled={busy || qty <= 0 || overStock}
                className="flex items-center gap-1.5 px-3 py-2 bg-pine text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-pine/90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add
              </button>
            </div>
            {overStock && <p className="w-full flex items-center gap-1 text-[10px] font-bold text-rose-500"><AlertCircle size={11} /> Only {Number(selected.quantity)} {selected.unit} in stock</p>}
          </div>
        )}
      </div>

      {/* Apply a vaccine/bundle package (deducts each component + one bill line) */}
      {packages.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            disabled={applyingPkg}
            value=""
            onChange={e => applyPackage(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam disabled:opacity-50">
            <option value="">{applyingPkg ? 'Applying…' : 'Apply a package…'}</option>
            {packages.map(p => <option key={p.id} value={p.id}>{p.name} · KES {p.pricing.sellAfterDiscount.toLocaleString()}</option>)}
          </select>
          {applyingPkg && <Loader2 size={16} className="animate-spin text-seafoam" />}
        </div>
      )}

      {/* Logged lines */}
      {loading ? (
        <div className="flex items-center justify-center py-6"><Loader2 size={18} className="animate-spin text-seafoam" /></div>
      ) : items.length === 0 ? (
        <p className="text-[11px] text-slate-400 text-center py-3">No items logged yet.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map(c => (
            <div key={c.id} className="flex items-center gap-2 px-2.5 py-2 bg-slate-50 dark:bg-zinc-950/40 rounded-lg">
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-pine dark:text-zinc-100 truncate">{c.inventoryItem.name} <span className="text-slate-400 font-medium">×{c.quantity} {c.inventoryItem.unit}</span></span>
                <span className="block text-[9px] text-slate-400">
                  {c.batchNumber ? <span className="font-bold text-amber-600 dark:text-amber-500">Batch {c.batchNumber} · </span> : ''}
                  {c.inventoryItem.form ?? 'UNIT'}
                  {c.inventoryItem.supplierName ? ` · ${c.inventoryItem.supplierName}` : ''}
                  {c.inventoryItem.manufacturer ? ` · ${c.inventoryItem.manufacturer}` : ''}
                </span>
              </span>
              <button type="button" onClick={() => toggleBillable(c)} disabled={busyLineId === c.id}
                className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${c.billable ? 'bg-seafoam/10 text-seafoam' : 'bg-slate-200 dark:bg-zinc-800 text-slate-400'}`}>
                {c.billable ? `KES ${c.lineTotal.toLocaleString()}` : 'Non-bill'}
              </button>
              <button type="button" onClick={() => remove(c)} disabled={busyLineId === c.id} className="p-1.5 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50">
                {busyLineId === c.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConsumablePicker;
