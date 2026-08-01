/**
 * Inter-clinic stock transfers (migration 129).
 *
 * Lives inside Stock Manager next to Movements, because a transfer IS two
 * movements — putting it anywhere else would hide it from the person looking
 * at stock.
 *
 * The server executes the whole transfer in one transaction and refuses to
 * over-send, so this screen's job is to make the destination and the quantities
 * unambiguous, then get out of the way.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Plus, X, Loader2, Search, Building2, Trash2, PackageCheck } from 'lucide-react';
import { stockTransfersAPI, type StockTransfer } from '../../../services/modules/stockTransfers.api';
import { inventoryAPI, toast } from '../../../services';
import type { InventoryItem } from '../../../services/modules/inventory.api';
import { useClinic } from '../../../contexts/ClinicContext';

interface DraftLine {
  item: InventoryItem;
  quantity: string;
}

const fmtWhen = (d: string) =>
  new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

// clinicId arrives as a number from StockManagerView — normalised below rather
// than widening the prop, so the id stays one type inside this component.
const StockTransfersPanel: React.FC<{ clinicId?: string | number }> = ({ clinicId }) => {
  const { clinics, selectedClinicIds } = useClinic();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Draft
  const fromId = String(clinicId || selectedClinicIds[0] || '');
  const [toId, setToId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [q, setQ] = useState('');
  const [stock, setStock] = useState<InventoryItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await stockTransfersAPI.list();
      if (res.success && res.data?.transfers) setTransfers(res.data.transfers);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = async () => {
    setOpen(true); setToId(''); setNotes(''); setLines([]); setQ('');
    if (stock.length === 0) {
      const res = await inventoryAPI.getAll({ limit: 1000 });
      // getAll returns { data: items[], meta } — the old `.items ?? res.data`
      // fallback stored the whole envelope in `stock`, crashing the picker
      // (`stock.filter is not a function`) the moment the modal opened.
      const arr = (res.data as any)?.data ?? (res.data as any)?.items;
      if (res.success) setStock(Array.isArray(arr) ? arr : []);
    }
  };

  // Only stock at the SOURCE clinic can be sent, and only what's actually there.
  const sourceStock = useMemo(
    () => stock.filter((i) => String((i as any).clinicId ?? fromId) === fromId && Number(i.quantity) > 0),
    [stock, fromId],
  );

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const chosen = new Set(lines.map((l) => String(l.item.id)));
    return sourceStock
      .filter((i) => !chosen.has(String(i.id)))
      .filter((i) => !needle || `${i.name} ${i.sku ?? ''}`.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [sourceStock, q, lines]);

  const destinations = clinics.filter((c: any) => String(c.id) !== fromId);

  const overSend = lines.filter((l) => Number(l.quantity) > Number(l.item.quantity));
  const canSubmit = !!toId && lines.length > 0
    && lines.every((l) => Number(l.quantity) > 0)
    && overSend.length === 0;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const res = await stockTransfersAPI.create({
        fromClinicId: fromId,
        toClinicId: toId,
        notes: notes || undefined,
        items: lines.map((l) => ({ sourceItemId: String(l.item.id), quantity: Number(l.quantity) })),
      });
      if (res.success && res.data?.transfer) {
        setTransfers((prev) => [res.data!.transfer, ...prev]);
        toast.success(`${res.data.transfer.reference} — stock moved`);
        setOpen(false);
        // Quantities changed at both ends; refresh so the picker isn't stale.
        setStock([]);
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight flex items-center gap-2">
            <ArrowRightLeft size={15} /> Stock Transfers
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Move stock between your clinics</p>
        </div>
        <button
          onClick={openNew}
          disabled={destinations.length === 0}
          title={destinations.length === 0 ? 'You need access to more than one clinic to transfer stock' : undefined}
          className="px-4 py-2.5 rounded-xl bg-pine text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:opacity-90 disabled:opacity-40 transition-all"
        >
          <Plus size={13} /> New transfer
        </button>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-slate-400 gap-2 text-xs">
          <Loader2 size={14} className="animate-spin" /> Loading transfers…
        </div>
      ) : transfers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-12 text-center">
          <ArrowRightLeft size={22} className="mx-auto text-slate-300 dark:text-zinc-700" />
          <p className="mt-3 text-sm font-bold text-slate-600 dark:text-zinc-300">No transfers yet</p>
          <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
            {destinations.length === 0
              ? 'Transfers need access to more than one clinic.'
              : 'Move stock between branches and it appears here with a full audit trail.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {transfers.map((t) => (
            <div key={t.id} className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] font-bold text-slate-500">{t.reference}</span>
                  <span className="text-xs font-black text-slate-800 dark:text-white truncate">
                    {t.fromClinicName} <ArrowRightLeft size={11} className="inline mx-1 text-seafoam" /> {t.toClinicName}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">{fmtWhen(t.createdAt)}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {t.items.map((i) => (
                  <span key={i.id} className="text-[11px] text-slate-600 dark:text-zinc-400">
                    <span className="font-bold">{i.quantity}</span> {i.unit} · {i.name}
                  </span>
                ))}
              </div>
              {t.notes && <p className="mt-1.5 text-[11px] text-slate-400">{t.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 dark:text-zinc-100">New stock transfer</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-pine"><X size={16} /></button>
            </div>

            <div>
              <label className="field-label">Send to</label>
              <select className="field-select" value={toId} onChange={(e) => setToId(e.target.value)}>
                <option value="">Select a clinic…</option>
                {destinations.map((c: any) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-slate-400 flex items-center gap-1">
                <Building2 size={10} /> Sending from {clinics.find((c: any) => String(c.id) === fromId)?.name ?? 'this clinic'}
              </p>
            </div>

            <div>
              <label className="field-label">Add items</label>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="field-input pl-8" placeholder="Search stock at this clinic…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              {q && (
                <div className="mt-1.5 border border-slate-200 dark:border-zinc-700 rounded-lg divide-y divide-slate-100 dark:divide-zinc-800 overflow-hidden">
                  {results.length === 0 ? (
                    <p className="px-3 py-2 text-[11px] text-slate-400">Nothing in stock matches.</p>
                  ) : results.map((i) => (
                    <button key={i.id} type="button"
                      onClick={() => { setLines((p) => [...p, { item: i, quantity: '1' }]); setQ(''); }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-200 truncate">{i.name}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{Number(i.quantity)} {i.unit}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {lines.length > 0 && (
              <div className="space-y-2">
                {lines.map((l, idx) => {
                  const over = Number(l.quantity) > Number(l.item.quantity);
                  return (
                    <div key={String(l.item.id)} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-slate-700 dark:text-zinc-200 truncate">{l.item.name}</p>
                        <p className="text-[10px] text-slate-400">{Number(l.item.quantity)} {l.item.unit} available</p>
                      </div>
                      <input
                        type="number" min="0" step="0.001"
                        className={`field-input w-24 text-right ${over ? 'border-rose-400 text-rose-600' : ''}`}
                        value={l.quantity}
                        onChange={(e) => setLines((p) => p.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))}
                      />
                      <button onClick={() => setLines((p) => p.filter((_, i) => i !== idx))}
                        className="p-1.5 text-slate-400 hover:text-rose-500"><Trash2 size={13} /></button>
                    </div>
                  );
                })}
                {overSend.length > 0 && (
                  <p className="text-[11px] font-semibold text-rose-600">
                    More than is in stock: {overSend.map((l) => l.item.name).join(', ')}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="field-label">Note (optional)</label>
              <input className="field-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. covering Karen's shortage" />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300">
                Cancel
              </button>
              <button onClick={submit} disabled={!canSubmit || saving}
                className="flex-1 py-2.5 rounded-xl bg-pine text-white text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-1.5">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <PackageCheck size={13} />}
                Transfer {lines.length > 0 ? `${lines.length} item${lines.length > 1 ? 's' : ''}` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockTransfersPanel;
