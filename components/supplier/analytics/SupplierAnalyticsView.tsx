import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, Loader2, PhoneCall, PackageX, AlertTriangle,
  Timer, Layers, Building2, Lock, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useSupplierBranch } from '../../../contexts/SupplierBranchContext';
import { supplierBiAPI, SupplierBiReport } from '../../../services/modules/supplierBi.api';

/**
 * 298 — business intelligence for the supplier side.
 *
 * User, 2026-09-14: *"the supplier dash is short, do a Business intelligence
 * for supplier side."*
 *
 * ⚠️ THIS IS NOT MORE TILES. The dashboard already had eight of those. What it
 * could not answer is whether a number is good, which products earn as opposed
 * to merely move, which customers have gone quiet, and how much money is asleep
 * on a shelf. Every block below is either a figure WITH its prior-period twin,
 * or a ranking that implies something to do this afternoon.
 *
 * ⚠️ Margin is COUNTER-ONLY and says so wherever it appears. A purchase order
 * carries no cost snapshot, so folding wholesale into the margin would report a
 * flattering 100% on half the business.
 */

const RANGES = [
  { id: '7', label: '7 days' },
  { id: '30', label: '30 days' },
  { id: '90', label: '90 days' },
  { id: '365', label: '12 months' },
] as const;

const DAY = 24 * 60 * 60 * 1000;

const Delta: React.FC<{ value: number | null; invert?: boolean }> = ({ value, invert }) => {
  if (value == null) {
    return <span className="text-[10px] font-bold text-slate-400">no prior period</span>;
  }
  const flat = Math.abs(value) < 0.5;
  const good = invert ? value < 0 : value > 0;
  const Icon = flat ? Minus : good ? TrendingUp : TrendingDown;
  const tone = flat
    ? 'text-slate-400'
    : good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black ${tone}`}>
      <Icon size={11} />
      {flat ? 'flat' : `${value > 0 ? '+' : ''}${value.toFixed(0)}%`}
      <span className="text-slate-400 font-bold">vs prior</span>
    </span>
  );
};

const Panel: React.FC<{
  title: string; subtitle?: string; icon?: React.ElementType;
  children: React.ReactNode; className?: string;
}> = ({ title, subtitle, icon: Icon, children, className = '' }) => (
  <div className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm ${className}`}>
    <div className="flex items-start gap-2 mb-3">
      {Icon && <Icon size={14} className="mt-0.5 shrink-0 text-slate-400" />}
      <div className="min-w-0">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">{title}</h3>
        {subtitle && <p className="text-[10px] font-bold text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
);

const SupplierAnalyticsView: React.FC<{ setView?: (v: string) => void }> = ({ setView }) => {
  const { user } = useAuth();
  const { activeBranchIds } = useSupplierBranch();
  const [days, setDays] = useState<string>('30');
  const [data, setData] = useState<SupplierBiReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);

  const currency = (user?.supplier as any)?.currency || 'KES';
  const money = useCallback((n: number) => {
    // Big numbers on a KPI tile are read at a glance, not audited — thousands
    // separators and no cents is what a business owner actually scans.
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`;
    if (abs >= 10_000) return `${currency} ${Math.round(n / 1000)}k`;
    return `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }, [currency]);
  const exact = useCallback(
    (n: number) => `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    [currency],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const to = new Date();
    const from = new Date(to.getTime() - Number(days) * DAY);
    const r = await supplierBiAPI.report({
      from: from.toISOString(),
      to: to.toISOString(),
      branchIds: activeBranchIds.length ? activeBranchIds.map(String) : undefined,
    }, { silent: true });
    // ⚠️ Sell the lock, never hide it — Sales analytics is a higher supplier
    // tier, so a 403 renders the offer rather than an empty screen.
    if (r.status === 403) { setLocked(true); setLoading(false); return; }
    setLocked(false);
    if (r.success && r.data) setData(r.data);
    setLoading(false);
  }, [days, activeBranchIds]);

  useEffect(() => { load(); }, [load]);

  const chartPoints = useMemo(() => (data?.series.points ?? []).map((p) => ({
    label: new Date(p.bucket).toLocaleDateString(undefined,
      data?.series.grain === 'month' ? { month: 'short' } : { day: 'numeric', month: 'short' }),
    counter: p.counter,
    wholesale: p.wholesale,
  })), [data]);

  if (locked) {
    return (
      <div className="max-w-xl">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <Lock size={22} className="text-amber-500" />
          <h1 className="text-xl font-black text-pine dark:text-zinc-100 mt-3">Sales analytics</h1>
          <p className="text-sm text-slate-500 mt-2">
            Margin by product, which customers have gone quiet, what capital is
            asleep on the shelf, and what is about to run out — measured against
            the period before, so a number means something.
          </p>
          <button
            onClick={() => setView?.('supplier-billing')}
            className="mt-5 w-full px-4 py-2.5 rounded-xl bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[11px] font-black uppercase tracking-widest"
          >
            See the plans
          </button>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>;
  }
  if (!data) return null;

  const h = data.headline;
  const mixTotal = h.counterRevenue + h.wholesaleRevenue;

  const KPI: React.FC<{
    label: string; value: string; delta?: number | null; foot?: string;
  }> = ({ label, value, delta, foot }) => (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</div>
      <div className="text-2xl font-black text-pine dark:text-zinc-100 mt-1 tabular-nums">{value}</div>
      <div className="mt-1.5">{delta !== undefined ? <Delta value={delta} /> : <span className="text-[10px] font-bold text-slate-400">{foot}</span>}</div>
      {delta !== undefined && foot && <div className="text-[10px] font-bold text-slate-400 mt-0.5">{foot}</div>}
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ── Range ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-pine dark:text-zinc-100">Business intelligence</h1>
          <p className="text-[11px] font-bold text-slate-400 mt-0.5">
            {new Date(data.range.from).toLocaleDateString()} – {new Date(data.range.to).toLocaleDateString()}
            {' · compared with the '}{data.range.days} days before
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setDays(r.id)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                  days === r.id
                    ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm'
                    : 'text-slate-400'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={load} className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-pine">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Headline ──────────────────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <KPI label="Revenue" value={money(h.revenue)} delta={h.revenueDelta}
             foot={`${exact(h.counterRevenue)} counter · ${exact(h.wholesaleRevenue)} wholesale`} />
        <KPI label="Gross profit" value={money(h.grossProfit)} delta={h.grossProfitDelta}
             foot={`${h.marginPct.toFixed(1)}% margin · counter sales only`} />
        <KPI label="Transactions" value={h.transactions.toLocaleString()} delta={h.transactionsDelta}
             foot={`${h.units.toLocaleString()} units moved`} />
        <KPI label="Average sale" value={money(h.avgOrderValue)} delta={h.avgOrderValueDelta} />
      </div>

      {/* ── Trend ─────────────────────────────────────────────────────────── */}
      <Panel title="Where the money came from"
             subtitle="Counter and wholesale, stacked — which rail is growing is a strategy question">
        {chartPoints.length === 0 ? (
          <p className="text-xs text-slate-400 py-12 text-center">Nothing sold in this window yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartPoints} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="biCounter" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="biWholesale" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c2703c" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#c2703c" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                     tickFormatter={(v: number) => money(v)} width={70} />
              <Tooltip formatter={(v: any, n: any) => [exact(Number(v)), n === 'counter' ? 'Counter' : 'Wholesale']} />
              <Area type="monotone" dataKey="wholesale" stackId="1" stroke="#c2703c" fill="url(#biWholesale)" />
              <Area type="monotone" dataKey="counter" stackId="1" stroke="#0f766e" fill="url(#biCounter)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Panel>

      {/* ── Products ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Biggest earners" subtitle="By gross profit, not by revenue — they are different lists" icon={Layers}>
          {data.products.byMargin.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No counter sales in this window.</p>
          ) : (
            <div className="space-y-2">
              {data.products.byMargin.map((p) => (
                <div key={p.productId ?? p.sku} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-pine dark:text-zinc-100 truncate">{p.name}</div>
                    <div className="text-[10px] font-bold text-slate-400">
                      {p.units.toLocaleString()} units · {exact(p.revenue)} in
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{exact(p.margin)}</div>
                    <div className="text-[10px] font-bold text-slate-400 tabular-nums">{p.marginPct.toFixed(0)}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* ⚠️ The list nobody asks for. Busiest products, thinnest margins. */}
        <Panel title="Working hardest for least"
               subtitle="High turnover under 15% margin — the shelf space to re-price or renegotiate"
               icon={AlertTriangle}>
          {data.products.workingHardest.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Nothing is selling on a thin margin. That is the good outcome.
            </p>
          ) : (
            <div className="space-y-2">
              {data.products.workingHardest.map((p) => (
                <div key={p.productId ?? p.sku} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-pine dark:text-zinc-100 truncate">{p.name}</div>
                    <div className="text-[10px] font-bold text-slate-400">
                      {exact(p.revenue)} in · {exact(p.margin)} kept
                    </div>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 text-[10px] font-black tabular-nums">
                    {p.marginPct.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Customers ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Best customers" subtitle="Clinics by wholesale value in this window" icon={Building2}>
          {data.customers.top.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No wholesale orders in this window.</p>
          ) : (
            <div className="space-y-2">
              {data.customers.top.slice(0, 8).map((c) => {
                const share = mixTotal ? (c.revenue / mixTotal) * 100 : 0;
                return (
                  <div key={c.clinicId}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold text-pine dark:text-zinc-100 truncate">{c.name}</span>
                      <span className="text-xs font-black tabular-nums shrink-0">{exact(c.revenue)}</span>
                    </div>
                    {/* Concentration, drawn. One customer at 60% of revenue is a
                        risk the number alone does not communicate. */}
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 mt-1 overflow-hidden">
                      <div className="h-full rounded-full bg-pine dark:bg-zinc-200" style={{ width: `${Math.min(100, share)}%` }} />
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                      {c.orders} orders · {share.toFixed(0)}% of revenue
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Gone quiet"
               subtitle="Regulars who have not ordered in twice their usual gap — calls worth making"
               icon={PhoneCall}>
          {data.customers.quiet.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Every regular is still ordering on their usual rhythm.
            </p>
          ) : (
            <div className="space-y-2.5">
              {data.customers.quiet.slice(0, 8).map((c) => (
                <div key={c.clinicId} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-pine dark:text-zinc-100 truncate">{c.name}</div>
                    <div className="text-[10px] font-bold text-slate-400">
                      {exact(c.lifetime)} over {c.orders} orders · usually every {c.usualGapDays}d
                    </div>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-500 text-[10px] font-black tabular-nums">
                    {c.daysSince}d quiet
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Stock ─────────────────────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <KPI label="Stock at cost" value={money(data.stock.valuation.atCost)}
             foot={`${data.stock.valuation.skus} SKUs · ${data.stock.valuation.units.toLocaleString()} units`} />
        <KPI label="Stock at retail" value={money(data.stock.valuation.atRetail)}
             foot={`${exact(data.stock.valuation.atRetail - data.stock.valuation.atCost)} of margin on the shelf`} />
        <KPI label="Asleep" value={money(data.stock.dead.reduce((s, d) => s + d.tiedUp, 0))}
             foot={`${data.stock.dead.length} lines sold nothing this window`} />
        <KPI label="Expiring in 90d" value={money(data.stock.expiring.reduce((s, e) => s + e.value, 0))}
             foot={`${data.stock.expiring.length} batches`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Money asleep"
               subtitle="On the shelf, nothing sold this window — the capital already spent"
               icon={PackageX}>
          {data.stock.dead.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Everything on the shelf moved.</p>
          ) : (
            <div className="space-y-2">
              {data.stock.dead.map((d) => (
                <div key={d.productId} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-pine dark:text-zinc-100 truncate">{d.name}</div>
                    <div className="text-[10px] font-bold text-slate-400">{d.onHand.toLocaleString()} on hand</div>
                  </div>
                  <span className="text-xs font-black text-slate-500 tabular-nums shrink-0">{exact(d.tiedUp)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="About to run out"
               subtitle="Selling steadily, under three weeks of cover left"
               icon={Timer}>
          {data.stock.runningOut.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Nothing is close to running out.</p>
          ) : (
            <div className="space-y-2">
              {data.stock.runningOut.map((s) => (
                <div key={s.productId} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-pine dark:text-zinc-100 truncate">{s.name}</div>
                    <div className="text-[10px] font-bold text-slate-400">
                      {s.onHand.toLocaleString()} left · {s.perDay.toFixed(1)}/day
                    </div>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-black tabular-nums ${
                    s.daysOfCover <= 7 ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {s.daysOfCover}d
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Expiring soon" subtitle="Batches within 90 days, and what they are worth" icon={AlertTriangle}>
          {data.stock.expiring.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No batch expires in the next 90 days.</p>
          ) : (
            <div className="space-y-2">
              {data.stock.expiring.slice(0, 10).map((e) => (
                <div key={`${e.productId}-${e.batchNumber}`} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-pine dark:text-zinc-100 truncate">{e.name}</div>
                    <div className="text-[10px] font-bold text-slate-400">
                      Batch {e.batchNumber} · {e.quantityRemaining.toLocaleString()} left · {exact(e.value)}
                    </div>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-black tabular-nums ${
                    e.daysLeft <= 30 ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {e.daysLeft}d
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Branches & categories ─────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {data.branches.length > 1 && (
          <Panel title="Branches" subtitle="Counter takings and what was kept on them" icon={Building2}>
            <ResponsiveContainer width="100%" height={Math.max(140, data.branches.length * 42)}>
              <BarChart data={data.branches} layout="vertical" margin={{ left: 4, right: 12 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                       tickFormatter={(v: number) => money(v)} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => exact(Number(v))} />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                  {data.branches.map((b, i) => <Cell key={b.branchId} fill={i === 0 ? '#0f766e' : '#94a3b8'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        )}

        <Panel title="Category mix" subtitle="Revenue and margin by category, counter sales" icon={Layers}>
          {data.categories.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No counter sales in this window.</p>
          ) : (
            <div className="space-y-2">
              {data.categories.slice(0, 10).map((c) => {
                const share = h.counterRevenue ? (c.revenue / h.counterRevenue) * 100 : 0;
                return (
                  <div key={c.category}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold text-pine dark:text-zinc-100 truncate">{c.category}</span>
                      <span className="text-[10px] font-black text-slate-400 tabular-nums shrink-0">
                        {exact(c.revenue)} · {c.marginPct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 mt-1 overflow-hidden">
                      <div className="h-full rounded-full bg-clay" style={{ width: `${Math.min(100, share)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};

export default SupplierAnalyticsView;
