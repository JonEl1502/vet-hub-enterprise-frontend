/**
 * Receivables — money owed TO the clinic, and money owed BY it.
 *
 * Both figures are derived server-side, so this panel never has to reconcile
 * anything: what it renders is the current position by construction.
 *
 * Ageing runs from the VISIT date rather than the invoice date — the visit is
 * when the work was done and the debt became real, and invoicing can lag it.
 * A report aged from invoicing flatters itself.
 */
import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Loader2, Phone, AlertTriangle } from 'lucide-react';
import { receivablesAPI, type ArAgeing, type SupplierApRow } from '../../../services/modules/receivables.api';

/**
 * Open a debtor straight on their UNPAID invoices — `client-profile` with
 * `unpaidOnly`, the same target the Clients list uses for "view finance".
 * (`client-detail` is not a real view id; clicking it would have done nothing.)
 */
const openDebtor = (clientId: string) =>
  window.dispatchEvent(new CustomEvent('vethub:navigate', {
    // App.tsx reads `detail.params` — params sent flat on `detail` are dropped,
    // which would open the profile with no client.
    detail: {
      view: 'client-profile',
      params: { clientId, initialTab: 'appointments', unpaidOnly: true },
    },
  }));

interface Props { currency?: string }

const ReceivablesPanel: React.FC<Props> = ({ currency = 'KES' }) => {
  const [ageing, setAgeing] = useState<ArAgeing | null>(null);
  const [ap, setAp] = useState<{ total: number; suppliers: SupplierApRow[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      receivablesAPI.arAgeing().then((r) => { if (r.success && r.data) setAgeing(r.data); }).catch(() => {}),
      receivablesAPI.supplierAp().then((r) => { if (r.success && r.data) setAp(r.data); }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const money = (n: number) =>
    `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  if (loading) {
    return (
      <div className="h-32 flex items-center justify-center text-slate-400 gap-2 text-xs">
        <Loader2 size={14} className="animate-spin" /> Loading receivables…
      </div>
    );
  }

  const owedToUs = ageing?.total ?? 0;
  const weOwe = ap?.total ?? 0;
  // The number that actually matters day to day: what the clinic would be left
  // holding if everything settled today.
  const net = owedToUs - weOwe;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <TrendingUp size={12} className="text-emerald-500" /> Owed to you
          </p>
          <p className="mt-1 text-xl font-black text-pine dark:text-zinc-100">{money(owedToUs)}</p>
          <p className="text-[11px] text-slate-400">{ageing?.clients.length ?? 0} client(s)</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <TrendingDown size={12} className="text-rose-500" /> You owe suppliers
          </p>
          <p className="mt-1 text-xl font-black text-pine dark:text-zinc-100">{money(weOwe)}</p>
          <p className="text-[11px] text-slate-400">{ap?.suppliers.length ?? 0} supplier(s)</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Net position</p>
          <p className={`mt-1 text-xl font-black ${net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {net < 0 ? `− ${money(Math.abs(net))}` : money(net)}
          </p>
          <p className="text-[11px] text-slate-400">if everything settled today</p>
        </div>
      </div>

      {/* Ageing buckets */}
      {ageing && ageing.total > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
            Aged from the visit date
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ageing.buckets.map((b) => {
              const share = ageing.total > 0 ? (b.amount / ageing.total) * 100 : 0;
              // Older money is less likely to arrive, so the scale warms as it ages.
              const tone = b.key === 'current' ? 'bg-emerald-500'
                : b.key === 'd31_60' ? 'bg-amber-400'
                : b.key === 'd61_90' ? 'bg-orange-500' : 'bg-rose-500';
              return (
                <div key={b.key}>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">{b.label}</p>
                  <p className="text-sm font-black text-pine dark:text-zinc-100">{money(b.amount)}</p>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                    <div className={`h-full ${tone}`} style={{ width: `${Math.max(share, b.amount > 0 ? 3 : 0)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Who owes — worst first, which is the order anyone chasing money works in */}
      {ageing && ageing.clients.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="bg-slate-50 dark:bg-zinc-800/60 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Client</th>
                  <th className="text-right px-3 py-2 font-semibold">Oldest</th>
                  <th className="text-right px-3 py-2 font-semibold">Owed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {ageing.clients.slice(0, 12).map((c) => (
                  <tr
                    key={c.clientId}
                    onClick={() => openDebtor(c.clientId)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/60"
                  >
                    <td className="px-3 py-2">
                      <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{c.name}</p>
                      {c.phone && (
                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Phone size={9} /> {c.phone}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`text-[11px] font-black ${
                        c.oldestDays > 90 ? 'text-rose-600' : c.oldestDays > 60 ? 'text-orange-500'
                          : c.oldestDays > 30 ? 'text-amber-600' : 'text-slate-400'
                      }`}>
                        {c.oldestDays}d
                        {c.oldestDays > 90 && <AlertTriangle size={10} className="inline ml-1 -mt-0.5" />}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-mono font-bold text-pine dark:text-zinc-100">
                      {money(c.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ageing.clients.length > 12 && (
            <p className="px-3 py-2 text-[10px] text-slate-400 border-t border-slate-100 dark:border-zinc-800">
              Showing the 12 worst of {ageing.clients.length}.
            </p>
          )}
        </div>
      )}

      {ageing && ageing.total === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 py-8 text-center text-xs text-slate-400">
          Nothing outstanding — every visit is paid up.
        </div>
      )}

      {/* Supplier side */}
      {ap && ap.suppliers.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Owed to suppliers</p>
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800">
            {ap.suppliers.slice(0, 8).map((s) => (
              <div key={s.supplierId} className="px-3 py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{s.name}</p>
                  <p className="text-[10px] text-slate-400">
                    {s.openOrders} order{s.openOrders === 1 ? '' : 's'} · oldest {s.oldestDays}d
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-rose-600 shrink-0">{money(s.outstanding)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceivablesPanel;
