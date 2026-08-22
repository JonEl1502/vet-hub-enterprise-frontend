import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, Search, Plus, Loader2, Trash2, Tag, TagsIcon, AlertCircle, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { dialog } from '../../../services/utils/dialog';
import { useData } from '../../../contexts/DataContext';
import { consumablesAPI, AppointmentConsumable, vaccinePackagesAPI, VaccinePackage, billsAPI } from '../../../services';
import { sellUnitOf, stockPerSellUnit, isSplitUnit } from './QtyUnitControl';

interface Props {
  appointmentId: string | number;
  // Called after any change so the parent can refresh the appointment total.
  onChanged?: () => void;
  title?: string;
  // When set, scopes this picker to one service: logged items are tagged with
  // it (via notes) and the list shows only that service's items.
  serviceTag?: string;
  /**
   * The SERVICE task these products belong to (200) — the STABLE key.
   * `serviceTag` matched on the service NAME, so renaming a service orphaned
   * every product logged under the old one out of its box. Pass this and the
   * scoping is by id; `serviceTag` is still sent so the line keeps a readable
   * note, and still used to match HISTORICAL rows that have no id yet.
   */
  serviceTaskId?: string | number | null;
  compact?: boolean;
  // Back-fill: log rows with THIS timestamp (ISO) instead of now — used by the
  // per-day reconciliation editors. Stock still moves at log time.
  recordedAt?: string | null;
  /**
   * Restrict the LIST to one calendar day (local, `YYYY-MM-DD`).
   *
   * ⚠️ Without this the picker lists every consumable on the whole VISIT while
   * its heading says "used this day", and the total is the visit's total — so a
   * 4-day boarding stay showed day 1's food on day 4 and a KES figure that
   * belonged to neither (user, 2026-08-06: "dont show me all consumables added
   * to the visit here, show only in day n log it was added on").
   *
   * Safe to key on `createdAt`: `recordedAt` overwrites it on create
   * (`appointmentMedication.service` — `...(data.recordedAt ? { createdAt } : {})`),
   * so a back-filled row carries the day it was logged FOR, not the day it was
   * typed.
   */
  dayKey?: string | null;
  /**
   * Drop the surrounding card. The picker is almost always rendered INSIDE
   * another card (a day editor, a log-entry form), and its own border made
   * every one of those a card-in-a-card (user, 2026-08-05: "make ui less cards
   * in cards or flatten").
   */
  flat?: boolean;
  /**
   * Render the SEARCH ONLY, no list of what is already logged.
   *
   * For hosts that list those lines themselves. The boarding day block prints
   * the day's items above the editor with their own delete, so the picker's
   * copy showed every one of them a second time: opening "+ Add entry" to log
   * the evening feed re-displayed the morning's tin directly underneath it,
   * reading as if it were about to be added again (user, 2026-08-19: "i should
   * not see the last added food/consumable again").
   */
  hideLoggedList?: boolean;
}

const FRACTIONAL_UNITS = new Set(['ml', 'mg', 'g', 'l', 'cc', 'mcg', 'iu']);
const stepFor = (unit?: string) => (unit && FRACTIONAL_UNITS.has(unit.toLowerCase()) ? 0.1 : 1);

/**
 * Reusable consumable logger for any appointment-anchored workflow (inpatient,
 * boarding, grooming). Search inventory → pick → quantity → billable switch →
 * log: deducts stock and (if billable) adds an itemized charge. Logged lines
 * can be toggled billable or removed in place — the inline "edit bill".
 */
const ConsumablePicker: React.FC<Props> = ({ appointmentId, onChanged, title = 'Consumables & items used', serviceTag, serviceTaskId, recordedAt, flat, dayKey, hideLoggedList }) => {
  const { inventory } = useData();
  const [allItems, setAllItems] = useState<AppointmentConsumable[]>([]);
  // Prefer the id; fall back to the old note match so rows logged before 200
  // (and any the backfill could not resolve unambiguously) keep showing up.
  const items = useMemo(() => {
    // Local-day key, not `toISOString().slice(0,10)` — that is UTC, so an
    // evening entry in GMT+3 would file itself under the next day.
    const localDay = (d: string | Date) => {
      const x = new Date(d);
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    };
    let list = allItems;
    if (dayKey) list = list.filter(c => localDay(c.createdAt) === dayKey);
    if (!serviceTag && serviceTaskId == null) return list;
    return list.filter(c =>
      (serviceTaskId != null && (c as any).serviceTaskId != null && String((c as any).serviceTaskId) === String(serviceTaskId))
      || ((c as any).serviceTaskId == null && !!serviceTag && (c.notes || '') === serviceTag));
  }, [allItems, serviceTag, serviceTaskId, dayKey]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyLineId, setBusyLineId] = useState<string | null>(null);

  // Add form
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qty, setQty] = useState<number>(1);
  const [billable, setBillable] = useState(true);
  const [unitPrice, setUnitPrice] = useState<number>(0);

  /**
   * Per-item service charges (`metadata.fees` — injection, administration,
   * service, prescription), written by the product form.
   *
   * ⚠️ They were NOT charged from here. A product carrying a KES 550 injection
   * fee, given on the inpatient chart, billed only the dose (user, 2026-08-22:
   * "no injection fee"). The visit wizard's TreatmentStep already charges them
   * as their own bill lines; this is the same mechanism, so a fee behaves the
   * same wherever the item is dispensed from.
   */
  const FEE_LABELS: Record<string, string> = {
    injection: 'Injection fee', admin: 'Administration fee',
    service: 'Service charge', prescription: 'Prescription fee',
  };
  const [feesOn, setFeesOn] = useState<Record<string, boolean>>({});

  /** Inline edit of an already-logged line (user, 2026-08-22: "allow edit").
      Correcting a mistyped dose meant delete-and-retype, which bounced stock
      out and back and left two movements in the ledger for one correction. */
  const [editId, setEditId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(0);
  const [editPrice, setEditPrice] = useState<number>(0);

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

  const itemFees: { key: string; label: string; amount: number }[] = useMemo(() => {
    const fees = (selected as any)?.metadata?.fees || {};
    return Object.entries(fees)
      .filter(([, v]) => v != null && Number(v) > 0)
      .map(([k, v]) => ({ key: k, label: FEE_LABELS[k] || k, amount: Number(v) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  // Every configured fee starts ON — the clinic set it up precisely so it gets
  // charged. Untick to waive this one time.
  useEffect(() => {
    setFeesOn(Object.fromEntries(itemFees.map(f => [f.key, true])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  const feeTotal = itemFees.filter(f => feesOn[f.key]).reduce((t, f) => t + f.amount, 0);

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

  const reset = () => { setSelectedId(null); setSearch(''); setQty(1); setBillable(true); setUnitPrice(0); setFeesOn({}); };

  /**
   * ⚠️ `qty` is in SELL units (mL) but `quantity` is STOCK (Bottle), so the old
   * `qty > quantity` compared two different things: 300 mL against 5 Bottles
   * read as "in stock" when the shelf held 250 mL. Convert first.
   */
  const qtyInStock = selected ? qty * stockPerSellUnit(selected as any) : 0;
  const overStock = selected ? qtyInStock > Number(selected.quantity) : false;
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
        serviceTaskId: serviceTaskId ?? undefined,
        recordedAt: recordedAt || undefined,
      });
      if (res.success) {
        // Each ticked fee becomes its OWN bill line, so it can be edited or
        // removed independently of the product it came with.
        const picked = billable ? itemFees.filter(f => feesOn[f.key]) : [];
        for (const f of picked) {
          try {
            await billsAPI.addLine(appointmentId as any, {
              name: `${f.label} — ${selected.name}`,
              kind: 'SERVICE',
              quantity: 1,
              unitPrice: f.amount,
              category: 'Fees',
            } as any);
          } catch { toast.error(`Could not add the ${f.label.toLowerCase()}`); }
        }
        const feesAdded = picked.reduce((t, f) => t + f.amount, 0);
        toast.success(
          `${selected.name} logged${billable ? ` · KES ${(unitPrice * qty).toLocaleString()}` : ' (non-billable)'}`
          + (feesAdded > 0 ? ` + KES ${feesAdded.toLocaleString()} fees` : ''),
        );
        reset();
        await load();
        onChanged?.();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to log consumable'); }
    finally { setBusy(false); }
  };

  const startEdit = (c: AppointmentConsumable) => {
    setEditId(String(c.id));
    setEditQty(Number(c.quantity) || 0);
    setEditPrice(Number(c.unitPrice) || 0);
  };

  const saveEdit = async (c: AppointmentConsumable) => {
    setBusyLineId(c.id);
    try {
      // `quantity` moves stock on the server (up = take more, down = return),
      // so a correction is one adjustment rather than a delete + re-add.
      const res = await consumablesAPI.update(c.id, {
        quantity: editQty,
        ...(c.billable ? { unitPrice: editPrice } : {}),
      });
      if (res.success) {
        toast.success('Line updated — stock adjusted');
        setEditId(null);
        await load();
        onChanged?.();
      }
    } catch (e: any) { toast.error(e?.message || 'Could not update the line'); }
    finally { setBusyLineId(null); }
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
    // Confirm first (user, 2026-08-22: "across app when user deletes some
    // things confirm first"). Removing a line RETURNS STOCK and rewrites the
    // bill — a mis-click on a 12px icon should not do either silently.
    const ok = await dialog.confirmDelete({
      entityName: `${c.inventoryItem.name} × ${c.quantity} ${sellUnitOf(c.inventoryItem as any)}`,
      message: c.billable
        ? `Remove this line? KES ${Number(c.lineTotal ?? 0).toLocaleString()} comes off the bill and the stock is returned.`
        : 'Remove this line? The stock is returned.',
    });
    if (!ok) return;
    setBusyLineId(c.id);
    try {
      const res = await consumablesAPI.remove(c.id);
      if (res.success) { toast.success('Removed · stock restored'); await load(); onChanged?.(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to remove'); }
    finally { setBusyLineId(null); }
  };

  const billableTotal = items.filter(i => i.billable).reduce((s, i) => s + i.lineTotal, 0);

  return (
    <div className={flat
      ? 'space-y-3'
      : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3'}>
      <div className="flex items-center gap-2">
        <Package size={15} className="text-seafoam" />
        <span className="text-[11px] font-black uppercase tracking-widest text-pine dark:text-zinc-200">{title}</span>
        {billableTotal > 0 && <span className="ml-auto text-[11px] font-black text-pine dark:text-zinc-100">KES {billableTotal.toLocaleString()}</span>}
      </div>

      {/* ── ADD ZONE ────────────────────────────────────────────────
          Deliberately styled UNLIKE the list below (user, 2026-08-22: "ui to
          add a record to be different from display of the entries, its
          confusing to have one ui"). The search box and the logged rows sat
          in the same flat card, so "Lactated Ringer's 400 ml" read as a
          field you were filling in rather than a line already recorded and
          already billed. Dashed border + tint + its own heading = a place
          where you TYPE something new. Solid rows below = what IS. */}
      <div className="space-y-2 rounded-xl border border-dashed border-seafoam/40 bg-seafoam/[0.03] p-2.5">
        <p className="text-[9px] font-black uppercase tracking-widest text-seafoam/70">Add an item</p>
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
            {/*
              ⚠️ The quantity is canonically in SELL units — the server does
              `quantity × stockPerSellUnit` to move stock, and `price` is per
              sell unit. This field was labelled with the STOCK unit, so a
              100 mL vial sold per mL showed "Qty (Vials)" while 1 actually
              meant 1 mL. A vet reading it believed they were giving a whole
              vial (user, 2026-08-05: "I need to see amounts that am injecting
              or administering").
            */}
            <div>
              <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Amount ({sellUnitOf(selected as any)})
              </label>
              <input type="number" min={0} step={stepFor(sellUnitOf(selected as any))} value={qty} onChange={e => setQty(Number(e.target.value))}
                className="w-24 px-2 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" />
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
            {/* Both units, always — the small one that is billed and the big
                one that leaves the shelf (user, 2026-08-22: "show deduction to
                show small unit n bigger one"). */}
            {qty > 0 && (
              <p className="w-full text-[10px] font-bold text-slate-400">
                Giving <strong className="text-pine dark:text-zinc-100">{qty.toLocaleString()} {sellUnitOf(selected as any)}</strong>
                {isSplitUnit(selected as any) && (
                  <> · draws <strong className="text-pine dark:text-zinc-100">
                    {qtyInStock.toLocaleString(undefined, { maximumFractionDigits: 3 })} {selected.unit}
                  </strong> from stock · 1 {selected.unit} = {(1 / stockPerSellUnit(selected as any)).toLocaleString(undefined, { maximumFractionDigits: 3 })} {sellUnitOf(selected as any)}</>
                )}
                <span className="text-slate-400"> · {Number(selected.quantity).toLocaleString()} {selected.unit} left</span>
              </p>
            )}

            {/* Service charges configured on the product. Ticked = charged. */}
            {itemFees.length > 0 && billable && (
              <div className="w-full flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-zinc-800">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Charges</span>
                {itemFees.map(f => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFeesOn(o => ({ ...o, [f.key]: !o[f.key] }))}
                    title={feesOn[f.key] ? 'Charged with this item — click to waive' : 'Waived — click to charge'}
                    className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border transition-colors ${
                      feesOn[f.key]
                        ? 'bg-seafoam/10 text-seafoam border-seafoam/40'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700 line-through'
                    }`}
                  >
                    {f.label} {f.amount.toLocaleString()}
                  </button>
                ))}
                {feeTotal > 0 && (
                  <span className="ml-auto text-[10px] font-black text-pine dark:text-zinc-100">
                    Total KES {(lineTotal + feeTotal).toLocaleString()}
                  </span>
                )}
              </div>
            )}
            {overStock && <p className="w-full flex items-center gap-1 text-[10px] font-bold text-rose-500"><AlertCircle size={11} /> Only {Number(selected.quantity)} {selected.unit} in stock ({(Number(selected.quantity) / stockPerSellUnit(selected as any)).toLocaleString(undefined, { maximumFractionDigits: 2 })} {sellUnitOf(selected as any)})</p>}
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

      {/* Logged lines — suppressed when the host prints them itself. */}
      {hideLoggedList ? null : loading ? (
        <div className="flex items-center justify-center py-6"><Loader2 size={18} className="animate-spin text-seafoam" /></div>
      ) : items.length === 0 ? (
        <p className="text-[11px] text-slate-400 text-center py-3">No items logged yet.</p>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Recorded ({items.length})
            </span>
            <span className="flex-1 h-px bg-slate-200 dark:bg-zinc-800" />
            {billableTotal > 0 && (
              <span className="text-[9px] font-black text-pine dark:text-zinc-100">KES {billableTotal.toLocaleString()}</span>
            )}
          </div>
          {items.map(c => (
            <React.Fragment key={c.id}>
            <div className="flex items-center gap-2 px-2.5 py-2 bg-slate-50 dark:bg-zinc-950/40 rounded-lg">
              <span className="min-w-0 flex-1">
                {/* The amount ADMINISTERED, in the unit it was given in. */}
                <span className="block text-xs font-bold text-pine dark:text-zinc-100 truncate">
                  {c.inventoryItem.name}{' '}
                  <span className="text-seafoam font-black">{c.quantity} {sellUnitOf(c.inventoryItem as any)}</span>
                  {isSplitUnit(c.inventoryItem as any) && (
                    <span className="text-slate-400 font-bold">
                      {' '}({(Number(c.quantity) * stockPerSellUnit(c.inventoryItem as any)).toLocaleString(undefined, { maximumFractionDigits: 3 })} {c.inventoryItem.unit})
                    </span>
                  )}
                </span>
                {/* HOW the figure was reached (user, 2026-08-22: "show
                    clinic's sale price x units n any fee accompanied with
                    it"). A bare "KES 4,000" is unauditable — 400 mL at 10 is
                    right, 400 mL at 100 is a decimal-point disaster, and both
                    render the same without the multiplication written out. */}
                {c.billable && (
                  <span className="block text-[9px] font-bold text-slate-500 dark:text-zinc-400">
                    KES {Number(c.unitPrice ?? 0).toLocaleString()} × {Number(c.quantity).toLocaleString()} {sellUnitOf(c.inventoryItem as any)}
                    {' = '}
                    <strong className="text-pine dark:text-zinc-100">KES {Number(c.lineTotal ?? 0).toLocaleString()}</strong>
                  </span>
                )}
                {/* Charges the PRODUCT carries. Worded as "carries", not
                    "charged": whether each was actually applied was decided by
                    the tick boxes at add-time and lives on its own bill line,
                    not on this row — claiming otherwise would be a guess. */}
                {(() => {
                  // The API forwards these as `fees` (metadata itself is not
                  // exposed); the metadata path is kept as a fallback for any
                  // caller that still hands us a raw inventory row.
                  const fees = Object.entries(
                    ((c.inventoryItem as any)?.fees) || ((c.inventoryItem as any)?.metadata?.fees) || {},
                  )
                    .filter(([, v]) => v != null && Number(v) > 0);
                  if (!fees.length || !c.billable) return null;
                  return (
                    <span className="block text-[9px] font-bold text-violet-600 dark:text-violet-400">
                      Carries {fees.map(([k, v]) => `${FEE_LABELS[k] || k} KES ${Number(v).toLocaleString()}`).join(' · ')}
                      <span className="text-slate-400 font-bold"> — billed as its own line</span>
                    </span>
                  );
                })()}
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
              <button type="button" onClick={() => (editId === String(c.id) ? setEditId(null) : startEdit(c))} disabled={busyLineId === c.id}
                title="Edit amount or price" className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-seafoam disabled:opacity-50">
                <Pencil size={12} />
              </button>
              <button type="button" onClick={() => remove(c)} disabled={busyLineId === c.id} className="p-1.5 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50">
                {busyLineId === c.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </button>
            </div>
            {editId === String(c.id) && (
              <div className="flex flex-wrap items-end gap-2 px-2.5 py-2 -mt-1 bg-white dark:bg-zinc-900 border border-seafoam/30 rounded-lg">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-0.5">
                    Amount ({sellUnitOf(c.inventoryItem as any)})
                  </label>
                  <input type="number" min={0} step={stepFor(sellUnitOf(c.inventoryItem as any))} value={editQty}
                    onChange={e => setEditQty(Number(e.target.value))}
                    className="w-24 px-2 py-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-md text-sm font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" />
                </div>
                {c.billable && (
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-0.5">Unit price</label>
                    <input type="number" min={0} value={editPrice} onChange={e => setEditPrice(Number(e.target.value))}
                      className="w-24 px-2 py-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-md text-sm font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam" />
                  </div>
                )}
                <p className="text-[9px] font-bold text-slate-400">
                  {isSplitUnit(c.inventoryItem as any) && <>draws {(editQty * stockPerSellUnit(c.inventoryItem as any)).toLocaleString(undefined, { maximumFractionDigits: 3 })} {c.inventoryItem.unit} · </>}
                  stock is adjusted by the difference
                </p>
                <div className="ml-auto flex items-center gap-1.5">
                  <button type="button" onClick={() => setEditId(null)}
                    className="px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800">Cancel</button>
                  <button type="button" onClick={() => saveEdit(c)} disabled={busyLineId === c.id || editQty <= 0}
                    className="px-2.5 py-1 rounded-md bg-pine text-white text-[9px] font-black uppercase tracking-wider hover:bg-pine/90 disabled:opacity-50">
                    {busyLineId === c.id ? <Loader2 size={11} className="animate-spin" /> : 'Save'}
                  </button>
                </div>
              </div>
            )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConsumablePicker;
