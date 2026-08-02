import React from 'react';
import toast from 'react-hot-toast';
import { X, Plus, Package, Search, Loader2 } from 'lucide-react';
import servicesAPI, { Service, ServiceProduct } from '../../../services/modules/services.api';
import { useData } from '../../../contexts/DataContext';
import QtyUnitControl, { sellUnitOf } from './QtyUnitControl';

/**
 * Create a service — shared by the Billable Items → Services catalog and
 * Clinic Settings → Categories & Services, so both surfaces offer the same
 * thing.
 *
 * Medicine/consumables can be attached AT CREATION: the same auto-bill &
 * stock-deduct attachment the catalog row offers, without having to create the
 * service, find it in the list, then attach. Attachments are saved as a
 * per-clinic override right after the service row exists.
 */

interface Props {
  categories: { id: string; name: string }[];
  /** Pre-select a category (e.g. creating from within a category group). */
  defaultCategoryId?: string;
  currency?: string;
  onClose: () => void;
  onCreated?: (service: Service) => void;
}

const AddServiceModal: React.FC<Props> = ({ categories, defaultCategoryId, currency = 'KES', onClose, onCreated }) => {
  const { inventory } = useData();
  const [name, setName] = React.useState('');
  const [categoryId, setCategoryId] = React.useState(defaultCategoryId ?? '');
  const [description, setDescription] = React.useState('');
  const [defaultPrice, setDefaultPrice] = React.useState('');
  const [products, setProducts] = React.useState<ServiceProduct[]>([]);
  const [q, setQ] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const matches = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [] as any[];
    return (inventory || [])
      .filter((it: any) => `${it.name} ${it.category ?? ''}`.toLowerCase().includes(needle))
      .filter((it: any) => !products.some(p => p.inventoryItemId === String(it.id)))
      .slice(0, 6);
  }, [inventory, q, products]);

  const addProduct = (it: any) => {
    // unit label = SELL unit — what qty and price are denominated in (§0f #8).
    setProducts(p => [...p, { inventoryItemId: String(it.id), name: it.name, qty: 1, unit: sellUnitOf(it) }]);
    setQ('');
  };
  const setQty = (invId: string, qty: number) =>
    setProducts(p => p.map(x => (x.inventoryItemId === invId ? { ...x, qty: qty > 0 ? qty : 1 } : x)));
  const removeProduct = (invId: string) => setProducts(p => p.filter(x => x.inventoryItemId !== invId));

  // What the visit will actually bill: the service price plus its attached
  // products at their sell price.
  const productsSubtotal = React.useMemo(() => {
    const byId = new Map((inventory || []).map((it: any) => [String(it.id), it]));
    return products.reduce((s, p) => s + Number((byId.get(p.inventoryItemId) as any)?.price ?? 0) * (Number(p.qty) || 0), 0);
  }, [products, inventory]);
  const billsAt = (Number(defaultPrice) || 0) + productsSubtotal;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !categoryId) return;
    setSaving(true);
    try {
      const service = await servicesAPI.create({
        name: name.trim(),
        description: description.trim() || undefined,
        categoryId,
        defaultPrice: defaultPrice.trim() === '' ? undefined : Number(defaultPrice),
      });
      // Attachments live on the per-clinic override, so they're saved once the
      // service row exists. A failure here must not read as "service not
      // created" — it was.
      if (products.length > 0) {
        try {
          await servicesAPI.upsertOverride(service.id, { enabled: true, products });
        } catch {
          toast.error('Service created, but attaching the products failed — attach them from the catalog row.');
        }
      }
      toast.success(`"${service.name}" created`);
      onCreated?.(service);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create service');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[800] p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-6 sm:p-8 animate-in zoom-in-95">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase">Add Service</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="field-label">Service name</label>
            <input className="field-input" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. General Health Check" required autoFocus />
          </div>

          <div>
            <label className="field-label">Category</label>
            <select className="field-select" value={categoryId} onChange={e => setCategoryId(e.target.value)} required>
              <option value="">Select a category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="field-label">Description (optional)</label>
            <textarea className="field-textarea" rows={2} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of this service" />
          </div>

          <div>
            <label className="field-label">Default price (optional)</label>
            <input className="field-input font-mono" type="number" min="0" step="0.01"
              value={defaultPrice} onChange={e => setDefaultPrice(e.target.value)} placeholder="0" />
          </div>

          {/* Attach medicine / consumables — same contract as the catalog row:
              auto-billed and stock-deducted when the service lands on a visit. */}
          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-2">
            <div>
              <p className="field-label !mb-0">Attach medicine / consumables</p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                Auto-billed and deducted from stock whenever this service is added to a visit.
              </p>
            </div>

            {products.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {products.map(p => (
                  <span key={p.inventoryItemId}
                    className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-full bg-seafoam/10 border border-seafoam/30 text-seafoam text-[10px] font-bold">
                    <Package size={10} className="shrink-0" />
                    <span className="truncate max-w-[160px]">{p.name}</span>
                    {(() => { const it = (inventory || []).find((x: any) => String(x.id) === p.inventoryItemId); return it ? (
                      <QtyUnitControl compact item={it} value={Number(p.qty) || 1} onChange={(sellQty) => setQty(p.inventoryItemId, sellQty)} />
                    ) : (
                      <>
                        <input type="number" min={0} step="any" value={p.qty}
                          onChange={e => setQty(p.inventoryItemId, Number(e.target.value))}
                          className="w-11 bg-white dark:bg-zinc-900 border border-seafoam/30 rounded px-1 py-0.5 text-center text-pine dark:text-zinc-100 outline-none" />
                        {p.unit || ''}
                      </>
                    ); })()}
                    <button type="button" onClick={() => removeProduct(p.inventoryItemId)} className="hover:text-red-500 p-0.5"><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search inventory (2+ chars)…"
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 rounded-lg pl-8 pr-2 py-2 text-sm text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20" />
            </div>
            {matches.map((it: any) => (
              <button key={it.id} type="button" onClick={() => addProduct(it)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-zinc-800 hover:border-seafoam text-left transition-colors">
                <Package size={11} className="text-seafoam shrink-0" />
                <span className="flex-1 text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{it.name}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">{Number(it.quantity)} {it.unit} in stock</span>
              </button>
            ))}
            {q.trim().length >= 2 && matches.length === 0 && (
              <p className="text-[11px] text-slate-400 px-1">No inventory match. Add it under Products first.</p>
            )}

            {products.length > 0 && (
              <p className="text-[10px] font-bold text-pine dark:text-zinc-100">
                Bills at <span className="font-black">{currency} {billsAt.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                <span className="text-slate-400 font-medium"> · service {currency} {(Number(defaultPrice) || 0).toLocaleString()} + products {currency} {productsSubtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose}
              className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all">
              Cancel
            </button>
            <button type="submit" disabled={saving || !name.trim() || !categoryId}
              className="flex-1 bg-seafoam hover:bg-seafoam/90 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
              {saving ? <><Loader2 size={12} className="animate-spin" /> Creating…</> : <><Plus size={12} /> Create</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddServiceModal;
