/** Farm dashboard — herd, feed and produce status at a glance. */
import React, { useEffect, useState } from 'react';
import { LayoutDashboard, AlertTriangle, CalendarClock, UtensilsCrossed } from 'lucide-react';
import { livestockAPI, type LivestockDashboard, type LivestockAlerts } from '../../services/modules/livestock.api';
import LoadingSpinner from '../shared/common/LoadingSpinner';
import { LivestockPage, Stat, EmptyState, fmtDate } from './shared';

const goTo = (view: string) =>
  window.dispatchEvent(new CustomEvent('vethub:navigate', { detail: { view } }));

const LivestockDashboardView: React.FC = () => {
  const [data, setData] = useState<LivestockDashboard | null>(null);
  // `/livestock/alerts` was built but never called from anywhere, so overdue
  // feeding was computed server-side and then thrown away. This is the surface
  // that reads it.
  const [alerts, setAlerts] = useState<LivestockAlerts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      livestockAPI.dashboard().then((r) => { if (r.success && r.data) setData(r.data); }).catch(() => {}),
      livestockAPI.alerts().then((r) => { if (r.success && r.data) setAlerts(r.data); }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><LoadingSpinner size="lg" message="Loading dashboard..." /></div>;
  }

  if (!data || data.farms === 0) {
    return (
      <LivestockPage title="Farm Dashboard" subtitle="Herd, feed and produce at a glance" icon={LayoutDashboard}>
        <EmptyState
          icon={LayoutDashboard}
          title="No farms yet"
          hint="Register a farm to start tracking herds, feeding and produce."
        />
      </LivestockPage>
    );
  }

  const overdue = alerts?.feedingOverdue ?? [];

  return (
    <LivestockPage title="Farm Dashboard" subtitle="Herd, feed and produce at a glance" icon={LayoutDashboard}>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Farms" value={data.farms} />
        <Stat label="Total head" value={data.totalHead.toLocaleString()} hint={`${data.animalGroups} groups`} />
        <Stat label="Crop plots" value={data.cropPlots} />
        <Stat label="Feeding plans" value={data.activeFeedingPlans} hint="active" />
        <Stat label="Produce due" value={data.produceDue.length} hint="today or overdue" />
      </div>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
          <UtensilsCrossed size={15} /> Feeding outstanding
        </h2>
        {!overdue.length ? (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 text-center text-xs text-slate-400">
            Every plan has had its rations today.
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-slate-100 dark:divide-zinc-800">
            {overdue.map((f) => (
              <button key={f.id} onClick={() => goTo('feeding')}
                className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{f.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {f.animalGroupName || f.farmName}
                    {f.quantityKg != null ? ` · ${f.quantityKg} kg` : ''}
                  </p>
                </div>
                {/* Amber = started but still owed, rose = nothing logged. The
                    partial case is the one the old "fed at all" check hid. */}
                <span className={`shrink-0 text-[11px] font-black ${
                  f.partial ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {f.timesPerDay && f.timesPerDay > 1
                    ? `${f.fedToday} of ${f.timesPerDay}`
                    : f.cadence === 'DAILY' ? 'Not fed today' : `${f.cadence.toLowerCase()} — due`}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
          <AlertTriangle size={15} /> Produce due
        </h2>
        {data.produceDue.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 text-center text-xs text-slate-400">
            Nothing due — you're up to date.
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-slate-100 dark:divide-zinc-800">
            {data.produceDue.map((s) => (
              <button key={s.id} onClick={() => goTo('produce-schedule')}
                className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{s.produce}</p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {s.animalGroupName || s.cropPlotName || s.farmName}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <CalendarClock size={11} /> {fmtDate(s.nextDueOn)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-3">Recent yield</h2>
        {data.recentProduce.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 text-center text-xs text-slate-400">
            No produce recorded yet.
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-slate-100 dark:divide-zinc-800">
            {data.recentProduce.map((r) => (
              <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500 dark:text-zinc-400">{fmtDate(r.recordedOn)}</span>
                <span className="text-sm font-mono font-bold text-slate-800 dark:text-white">
                  {r.quantity} <span className="text-[11px] font-sans font-normal text-slate-400">{r.unit}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </LivestockPage>
  );
};

export default LivestockDashboardView;
