import React, { useState } from 'react';
import { Plus, Factory, Truck, Store, Pencil, Trash2 } from 'lucide-react';
import { supplierStockAPI, toast, type SupplierSource, type SupplierSourceType } from '../../../services';
import Modal from './Modal';

/**
 * Who this supplier buys FROM.
 *
 * The tab where the supplier stockroom stops mirroring the clinic's. A clinic's
 * upstream is always another Supplier; an agrovet's is a distributor, a
 * merchandiser who services the shelf, or the manufacturer direct — and which
 * one it is changes the lead time, the terms and who to chase.
 */

const TYPES: { id: SupplierSourceType; label: string; icon: React.FC<any>; hint: string }[] = [
  { id: 'MANUFACTURER', label: 'Manufacturer', icon: Factory, hint: 'You buy direct from the maker' },
  { id: 'SUPPLIER', label: 'Distributor', icon: Truck, hint: 'A wholesaler you order from' },
  { id: 'MERCHANDISER', label: 'Merchandiser', icon: Store, hint: 'A rep who stocks your shelf for you' },
];

const typeMeta = (t: SupplierSourceType) => TYPES.find((x) => x.id === t) ?? TYPES[1];

const SupplierSourcesPanel: React.FC<{
  sources: SupplierSource[];
  canManage: boolean;
  onChanged: () => void;
}> = ({ sources, canManage, onChanged }) => {
  const [editing, setEditing] = useState<SupplierSource | 'new' | null>(null);

  const remove = async (s: SupplierSource) => {
    try {
      const res = await supplierStockAPI.deleteSource(s.id);
      toast.success(res.data.deactivated ? `${s.name} marked inactive — its stock history is kept` : `${s.name} removed`);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Could not remove that source');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-bold text-slate-400 flex-1">
          Everyone you buy from. A source with stock still on the shelf is kept and marked
          inactive rather than deleted — a batch points at where it came from.
        </p>
        {canManage && (
          <button onClick={() => setEditing('new')} className="sup-btn shrink-0">
            <Plus size={14} /> Add source
          </button>
        )}
      </div>

      {sources.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl py-14 text-center">
          <p className="text-sm font-bold text-slate-400">No sources yet</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Add the distributors, merchandisers and manufacturers you stock from.
          </p>
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {sources.map((s) => {
            const meta = typeMeta(s.type);
            return (
              <div
                key={s.id}
                className={`bg-white dark:bg-zinc-900 border rounded-2xl p-3.5 ${
                  s.isActive ? 'border-slate-200 dark:border-zinc-800' : 'border-slate-100 dark:border-zinc-800/60 opacity-60'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-seafoam/10 text-seafoam flex items-center justify-center shrink-0">
                    <meta.icon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-pine dark:text-zinc-100 truncate">{s.name}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {meta.label}{!s.isActive && ' · inactive'}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-0.5 shrink-0">
                      <button onClick={() => setEditing(s)} className="p-1.5 text-slate-400 hover:text-seafoam" aria-label={`Edit ${s.name}`}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => remove(s)} className="p-1.5 text-slate-400 hover:text-red-500" aria-label={`Remove ${s.name}`}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-2.5 space-y-0.5 text-[10px] font-semibold text-slate-400">
                  {s.contactName && <p>{s.contactName}</p>}
                  {s.phone && <p>{s.phone}</p>}
                  {s.leadTimeDays != null && <p>Lead time {s.leadTimeDays} days</p>}
                  <p>{s.productCount} product{s.productCount === 1 ? '' : 's'}</p>
                  {s.outstandingBalance > 0 && (
                    <p className="text-amber-600 font-black">
                      Owed KES {s.outstandingBalance.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <SourceForm
          source={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); onChanged(); }}
        />
      )}
    </div>
  );
};

const SourceForm: React.FC<{
  source: SupplierSource | null;
  onClose: () => void;
  onDone: () => void;
}> = ({ source, onClose, onDone }) => {
  const [name, setName] = useState(source?.name ?? '');
  const [type, setType] = useState<SupplierSourceType>(source?.type ?? 'SUPPLIER');
  const [contactName, setContactName] = useState(source?.contactName ?? '');
  const [phone, setPhone] = useState(source?.phone ?? '');
  const [leadTimeDays, setLeadTimeDays] = useState(source?.leadTimeDays?.toString() ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return toast.error('Give the source a name');
    setBusy(true);
    try {
      const payload: any = {
        name: name.trim(), type,
        contactName: contactName.trim() || undefined,
        phone: phone.trim() || undefined,
        leadTimeDays: leadTimeDays ? Number(leadTimeDays) : undefined,
      };
      if (source) await supplierStockAPI.updateSource(source.id, payload);
      else await supplierStockAPI.createSource(payload);
      toast.success(source ? 'Saved' : `${name.trim()} added`);
      onDone();
    } catch (e: any) {
      toast.error(e?.message || 'Could not save that source');
      setBusy(false);
    }
  };

  return (
    <Modal title={source ? `Edit ${source.name}` : 'Add a source'} onClose={onClose}>
      <label className="sup-label">Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)}
             placeholder="e.g. Unga Farm Care EA" className="sup-input" />

      <label className="sup-label mt-3">What kind</label>
      <div className="space-y-2">
        {TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setType(t.id)}
            className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
              type === t.id ? 'border-seafoam bg-seafoam/5' : 'border-slate-200 dark:border-zinc-800'
            }`}
          >
            <t.icon size={15} className="text-seafoam shrink-0" />
            <span className="min-w-0">
              <span className="block text-[11px] font-black text-pine dark:text-zinc-100">{t.label}</span>
              <span className="block text-[9px] text-slate-400 font-semibold">{t.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <div>
          <label className="sup-label">Contact</label>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="sup-input" />
        </div>
        <div>
          <label className="sup-label">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="sup-input" />
        </div>
      </div>

      <label className="sup-label mt-3">Lead time (days)</label>
      <input value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)}
             inputMode="numeric" placeholder="How long an order takes to arrive" className="sup-input" />

      <div className="flex gap-2 mt-5">
        <button onClick={onClose} className="sup-btn-ghost flex-1">Cancel</button>
        <button onClick={submit} disabled={busy} className="sup-btn flex-1">
          {busy ? 'Saving…' : source ? 'Save' : 'Add source'}
        </button>
      </div>
    </Modal>
  );
};

export default SupplierSourcesPanel;
