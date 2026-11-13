import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Loader2, Pill, Search } from 'lucide-react';
import { clinicShopAPI, type ClinicShopProduct } from '../../../services/modules/supplierShop.api';
import { toast, uploadsAPI } from '../../../services';
import { ShopSettingsView } from '../../supplier/shop/SupplierShopSettings';

/**
 * A clinic's pet shop page (324): the same settings screen agrovets use, plus
 * a product picker.
 *
 * ⚠️ OPT-IN, ON PURPOSE. A clinic's stock list holds anaesthetics, surgical
 * consumables and controlled drugs next to the pet food, so nothing goes on
 * the public page until someone ticks it here. Prescription-only items can be
 * listed, but the public page never lets them into a basket: it asks the
 * customer to send the prescription on WhatsApp instead.
 */

interface Props {
  setView: (view: string) => void;
}

const money = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

const ProductRow: React.FC<{ p: ClinicShopProduct; onSaved: (p: ClinicShopProduct) => void }> = ({ p, onSaved }) => {
  const [offer, setOffer] = useState(p.offerPrice != null ? String(p.offerPrice) : '');
  const [promo, setPromo] = useState(p.promo);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async (patch: Parameters<typeof clinicShopAPI.updateProduct>[1], ok?: string) => {
    setBusy(true);
    try {
      const r = await clinicShopAPI.updateProduct(p.id, patch);
      if (r.data?.product) onSaved(r.data.product);
      if (ok) toast.success(ok);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const offerOk = !offer || (Number(offer) > 0 && Number(offer) < p.price);

  return (
    <div className={`p-3 flex flex-wrap items-center gap-3 ${p.visible ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : ''}`}>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="relative w-14 h-14 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white overflow-hidden shrink-0 flex items-center justify-center group"
        title={p.imageUrl ? 'Replace photo' : 'Add a photo'}
      >
        {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-contain p-1" /> : <Camera size={18} className="text-slate-300" />}
        <span className="absolute inset-0 bg-black/40 text-white text-[9px] font-bold opacity-0 group-hover:opacity-100 flex items-center justify-center">Photo</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              setBusy(true);
              const r = await uploadsAPI.upload(file, 'misc');
              await save({ imageUrl: r.publicUrl }, 'Photo saved');
            } catch (err: any) {
              toast.error(err?.message || 'Could not upload the photo');
              setBusy(false);
            } finally {
              e.target.value = '';
            }
          }}
        />
      </button>

      <div className="min-w-[10rem] flex-1">
        <p className="text-sm font-bold text-pine dark:text-zinc-100 leading-tight">{p.name}</p>
        <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
          {p.category} · {p.price > 0 ? `KES ${money(p.price)}` : 'no price'} · {money(p.quantity)} {p.unit.toLowerCase()} in stock
        </p>
        {p.rx && (
          <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
            <Pill size={10} /> Prescription only: listed, never added to a basket
          </span>
        )}
      </div>

      {p.visible && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={offer}
            onChange={(e) => setOffer(e.target.value)}
            onBlur={() => {
              if ((p.offerPrice != null ? String(p.offerPrice) : '') === offer) return;
              if (!offerOk) { toast.error('An offer must be lower than the price.'); return; }
              save({ offerPrice: offer === '' ? null : Number(offer) }, offer ? 'Offer saved' : 'Offer removed');
            }}
            placeholder="Offer price"
            inputMode="decimal"
            className={`w-28 bg-white dark:bg-zinc-900 border rounded-lg px-2.5 py-2 text-xs font-semibold outline-none ${offerOk ? 'border-slate-200 dark:border-zinc-700' : 'border-rose-400'}`}
          />
          <input
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
            onBlur={() => promo !== p.promo && save({ promo }, 'Saved')}
            maxLength={80}
            placeholder="Promo line"
            className="w-44 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-xs font-semibold outline-none"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => save({ visible: !p.visible })}
        disabled={busy}
        role="switch"
        aria-checked={p.visible}
        aria-label={`Show ${p.name} on the shop page`}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${p.visible ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-700'} disabled:opacity-60`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${p.visible ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
};

const ProductPicker: React.FC = () => {
  const [items, setItems] = useState<ClinicShopProduct[] | null>(null);
  const [q, setQ] = useState('');
  const [onlyShown, setOnlyShown] = useState(false);

  useEffect(() => {
    clinicShopAPI.listProducts().then((r) => setItems(r.data?.products ?? [])).catch(() => setItems([]));
  }, []);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (items ?? []).filter(
      (p) => (!onlyShown || p.visible) && (!t || p.name.toLowerCase().includes(t) || p.category.toLowerCase().includes(t)),
    );
  }, [items, q, onlyShown]);
  const count = (items ?? []).filter((p) => p.visible).length;

  return (
    <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl">
      <div className="p-5 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-pine dark:text-zinc-100">Products on your shop page</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Tick what customers can see and order. Nothing shows until you tick it. {count} on show.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-300 cursor-pointer select-none">
            <input type="checkbox" checked={onlyShown} onChange={(e) => setOnlyShown(e.target.checked)} className="w-4 h-4 accent-pine" />
            Only what is on show
          </label>
        </div>
        <label className="relative block mt-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your stock: dog food, collars, dewormer…"
            className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none"
            type="search"
          />
        </label>
      </div>
      <div className="max-h-[32rem] overflow-y-auto overscroll-contain divide-y divide-slate-100 dark:divide-zinc-800 border-t border-slate-100 dark:border-zinc-800">
        {items === null ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : shown.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">{items.length ? 'Nothing matches.' : 'No stock yet. Add products in Inventory first.'}</p>
        ) : (
          shown.map((p) => (
            <ProductRow key={p.id} p={p} onSaved={(n) => setItems((all) => (all ?? []).map((x) => (x.id === n.id ? n : x)))} />
          ))
        )}
      </div>
    </section>
  );
};

const ClinicShopSettings: React.FC<Props> = ({ setView }) => (
  <ShopSettingsView
    setView={setView}
    cfg={{
      kind: 'clinic',
      load: () => clinicShopAPI.getSettings().then((r) => r.data),
      save: (patch) => clinicShopAPI.updateSettings(patch).then((r) => r.data),
      billingView: 'billing',
      proKey: 'capability:website-integration',
      proName: 'the Website add-on',
      baseKey: 'view:petshop',
      baseName: 'the Pet shop module',
      productsCard: <ProductPicker />,
    }}
  />
);

export default ClinicShopSettings;
