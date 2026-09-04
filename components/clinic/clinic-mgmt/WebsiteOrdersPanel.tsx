import React from 'react';
import {
  Loader2, ShoppingCart, Check, X, Truck, PackageCheck, AlertTriangle, Info, Receipt,
} from 'lucide-react';
import {
  siteConnectAPI, type SiteOrder, type SiteOrderStatus, type OrderStockCheck,
} from '../../../services/modules/siteConnect.api';
import { toast, dialog } from '../../../services';

/**
 * WEBSITE → ORDERS (271).
 *
 * ⚠️ A row here is NOT a sale. Nothing was charged and no stock moved when the
 * customer pressed buy — pressing Confirm is what rings it up, deducts stock
 * and raises a receipt. The copy says so in as many words, because a screen
 * that looked like a completed order would make Confirm feel like a formality.
 */

const FIELD =
  'w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 ' +
  'text-xs font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/25';
const LABEL = 'text-[9px] font-black text-seafoam uppercase tracking-widest px-0.5';

const TONE: Record<SiteOrderStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  CONFIRMED: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  FULFILLED: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
  REJECTED: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
  CANCELLED: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400',
};
const LABEL_FOR: Record<SiteOrderStatus, string> = {
  PENDING: 'Not yet rung', CONFIRMED: 'Rung up', FULFILLED: 'Handed over',
  REJECTED: 'Rejected', CANCELLED: 'Withdrawn',
};

const PAYMENT_METHODS = ['CASH', 'M_PESA', 'CARD', 'BANK_TRANSFER'];

interface Props { enabled: boolean }

const WebsiteOrdersPanel: React.FC<Props> = ({ enabled }) => {
  const [orders, setOrders] = React.useState<SiteOrder[]>([]);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [stock, setStock] = React.useState<OrderStockCheck | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [method, setMethod] = React.useState('CASH');
  const [note, setNote] = React.useState('');

  const load = React.useCallback(() => {
    setLoading(true);
    siteConnectAPI.listOrders()
      .then((r) => { setOrders(r?.data?.orders ?? []); setCounts(r?.data?.counts ?? {}); })
      .catch(() => toast.error('Could not load website orders'))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { if (enabled) load(); else setLoading(false); }, [enabled, load]);

  React.useEffect(() => {
    const onStream = (e: any) => {
      if (String(e?.detail?.type || '').startsWith('site.order')) load();
    };
    window.addEventListener('vethub:stream', onStream);
    return () => window.removeEventListener('vethub:stream', onStream);
  }, [load]);

  const open = async (o: SiteOrder) => {
    if (openId === o.id) { setOpenId(null); setStock(null); return; }
    setOpenId(o.id); setStock(null); setNote(''); setMethod('CASH');
    try {
      const r = await siteConnectAPI.getOrder(o.id);
      setStock(r?.data?.stock ?? null);
    } catch { /* handled upstream */ }
  };

  const confirm = async (o: SiteOrder) => {
    if (!stock?.ok) return;
    const ok = await dialog.confirm({
      title: `Ring up ${o.reference}?`,
      // Spell out what actually happens. This is the money moment.
      message:
        `This sells ${o.items.length} item${o.items.length === 1 ? '' : 's'} for ` +
        `${o.currency} ${o.total.toLocaleString()} — stock comes off the shelf and a receipt is raised, ` +
        `exactly as if you had rung it at the counter. The customer pays by ${method.replace('_', '-')}.`,
      confirmLabel: 'Ring it up',
      variant: 'warning',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await siteConnectAPI.confirmOrder(o.id, { paymentMethod: method, note: note.trim() || undefined });
      toast.success(r?.data?.receiptNumber ? `Rung up — receipt ${r.data.receiptNumber}` : 'Order confirmed');
      setOpenId(null); setStock(null); load();
    } finally { setBusy(false); }
  };

  const reject = async (o: SiteOrder) => {
    const reason = await dialog.prompt({
      title: `Reject ${o.reference}?`,
      message: 'What should we tell them? This goes back to the website.',
      label: 'Reason', placeholder: 'That item is out of stock at the moment.',
      confirmLabel: 'Reject', variant: 'danger',
    });
    if (reason === null) return;
    setBusy(true);
    try {
      await siteConnectAPI.rejectOrder(o.id, { reason: reason.trim() || undefined });
      toast.success('Rejected');
      setOpenId(null); load();
    } finally { setBusy(false); }
  };

  const fulfil = async (o: SiteOrder) => {
    setBusy(true);
    try {
      await siteConnectAPI.fulfilOrder(o.id);
      toast.success('Marked as handed over');
      load();
    } finally { setBusy(false); }
  };

  if (!enabled) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 p-3">
        <Info size={14} className="text-seafoam shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
          Switch <strong>Online orders</strong> on for a website above and what your customers order
          will queue here. Nothing is ever charged on the website — you ring each one up yourself.
        </p>
      </div>
    );
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 size={16} className="animate-spin text-seafoam" /></div>;

  if (orders.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
        <ShoppingCart size={22} className="text-slate-300 dark:text-zinc-700 mx-auto mb-2" />
        <p className="text-xs font-bold text-slate-400">No orders yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className={LABEL}>
        Orders — {counts.PENDING ?? 0} waiting to be rung up
      </p>

      {orders.map((o) => (
        <div key={o.id} className="border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          <button type="button" onClick={() => open(o)}
            className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-slate-50 dark:hover:bg-zinc-800/50 flex-wrap">
            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shrink-0 ${TONE[o.status]}`}>
              {LABEL_FOR[o.status]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black text-pine dark:text-zinc-100 truncate">
                {o.customer.name} · {o.items.length} item{o.items.length === 1 ? '' : 's'} · {o.currency} {o.total.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {o.reference} · {o.fulfilment.method === 'DELIVERY' ? 'Delivery' : 'Pickup'} · {new Date(o.createdAt).toLocaleString()}
              </p>
            </div>
            {o.receiptNumber && (
              <span className="shrink-0 text-[10px] text-slate-400 flex items-center gap-1"><Receipt size={10} /> {o.receiptNumber}</span>
            )}
          </button>

          {openId === o.id && (
            <div className="border-t border-slate-100 dark:border-zinc-800 p-3 space-y-3">
              {/* Lines */}
              <div className="border border-slate-200 dark:border-zinc-800 rounded-lg divide-y divide-slate-100 dark:divide-zinc-800">
                {o.items.map((l) => {
                  const check = stock?.lines?.find((x) => x.name === l.name);
                  return (
                    <div key={l.id} className="flex items-center gap-2 p-2 text-[11px] flex-wrap">
                      <span className="min-w-0 flex-1 truncate text-pine dark:text-zinc-100 font-bold">{l.name}</span>
                      <span className="text-slate-400 tabular-nums">×{l.quantity}</span>
                      <span className="text-pine dark:text-zinc-200 tabular-nums font-bold">
                        {o.currency} {l.lineTotal.toLocaleString()}
                      </span>
                      {check && !check.enough && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                          only {check.have} left
                        </span>
                      )}
                      {check?.priceChanged && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                          now {check.currentPrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <p className="text-slate-500 dark:text-zinc-400">
                  <strong className="text-pine dark:text-zinc-200">{o.customer.name}</strong><br />
                  {o.customer.phoneE164 ?? o.customer.phone}{o.customer.email ? ` · ${o.customer.email}` : ''}<br />
                  {o.fulfilment.method === 'DELIVERY' ? `Deliver to: ${o.fulfilment.address || '—'}` : 'Collecting from the clinic'}
                  {o.fulfilment.notes ? <><br /><span className="italic">"{o.fulfilment.notes}"</span></> : null}
                </p>
                <p className="text-slate-500 dark:text-zinc-400 sm:text-right">
                  Quoted on the website: <strong className="text-pine dark:text-zinc-200">{o.currency} {o.quotedTotal.toLocaleString()}</strong>
                </p>
              </div>

              {o.status === 'PENDING' && (
                <>
                  {stock && !stock.ok && (
                    <div className="flex items-start gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 p-2.5">
                      <AlertTriangle size={13} className="text-rose-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-rose-700 dark:text-rose-300 leading-relaxed">
                        You don't have the stock for this order any more. Nothing was reserved when it
                        was placed. Restock, or reject it and tell them why.
                      </p>
                    </div>
                  )}
                  {stock?.priceChanged && stock.ok && (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2.5">
                      <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed">
                        Your prices changed since they ordered — they were quoted{' '}
                        {o.currency} {stock.quotedTotal?.toLocaleString()} and your list now says{' '}
                        {o.currency} {stock.totalNow?.toLocaleString()}. Ringing it up charges the{' '}
                        <strong>quoted</strong> price, which is what they agreed to. To charge the new
                        one, reject and ask them to re-order.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <p className={LABEL}>How are they paying?</p>
                      <select className={FIELD} value={method} onChange={(e) => setMethod(e.target.value)}>
                        {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace('_', '-')}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className={LABEL}>Note back to them (optional)</p>
                      <input className={FIELD} value={note} onChange={(e) => setNote(e.target.value)}
                        placeholder="Ready for collection after 2pm." />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => confirm(o)} disabled={busy || !stock?.ok}
                      title={stock?.ok ? undefined : 'Not enough stock to ring this up'}
                      className="px-4 py-2 rounded-lg bg-pine text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center gap-1.5">
                      {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Ring it up
                    </button>
                    <button type="button" onClick={() => reject(o)} disabled={busy}
                      className="px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-rose-500 text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-1.5">
                      <X size={12} /> Reject
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Nothing has been charged and no stock has moved yet. Ringing it up does both, exactly
                    as at the counter.
                  </p>
                </>
              )}

              {o.status === 'CONFIRMED' && (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                    <PackageCheck size={13} /> Rung up{o.receiptNumber ? ` — receipt ${o.receiptNumber}` : ''}
                  </p>
                  <button type="button" onClick={() => fulfil(o)} disabled={busy}
                    className="ml-auto px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-seafoam text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-1.5">
                    <Truck size={12} /> Handed over
                  </button>
                </div>
              )}

              {o.status === 'REJECTED' && o.rejectionReason && (
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">Rejected: {o.rejectionReason}</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default WebsiteOrdersPanel;
