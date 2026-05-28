import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw, DollarSign, CheckCircle2, AlertTriangle, Hourglass, Filter,
  Search, Building2, Calendar, Download,
} from 'lucide-react';
import {
  adminSubscriptionReportAPI,
  type AdminReportRow,
  type AdminReportResponse,
  type AdminChannel,
  type AdminStatus,
} from '../../../services/modules/adminSubscriptionReport.api';
import { subscriptionPackagesAPI, type SubscriptionPackagePlan } from '../../../services/modules/subscriptionPackages.api';

const CHANNELS: AdminChannel[] = ['LIPANA', 'MPESA', 'PESAPAL', 'PAYSTACK'];
const STATUSES: AdminStatus[] = ['SUCCESS', 'PENDING', 'FAILED', 'CANCELLED', 'EXPIRED'];

const SubscriptionPaymentsAdminPage: React.FC = () => {
  const [packages, setPackages] = useState<SubscriptionPackagePlan[]>([]);
  const [report, setReport] = useState<AdminReportResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [packageId, setPackageId] = useState<string>('');
  const [channel, setChannel] = useState<AdminChannel | ''>('');
  const [status, setStatus] = useState<AdminStatus | ''>('');
  const [clinicSearch, setClinicSearch] = useState<string>('');
  const [minSubsPerClinic, setMinSubsPerClinic] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminSubscriptionReportAPI.list({
        from: from || undefined,
        to: to || undefined,
        packageId: packageId || undefined,
        channel: (channel || undefined) as AdminChannel | undefined,
        status: (status || undefined) as AdminStatus | undefined,
        clinicSearch: clinicSearch || undefined,
        minSubsPerClinic: minSubsPerClinic ? Number(minSubsPerClinic) : undefined,
        limit: 200,
      });
      if (res.success && res.data) setReport(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    subscriptionPackagesAPI.list().then((r) => {
      if (r.success && r.data?.packages) setPackages(r.data.packages);
    });
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = () => load();
  const reset = () => {
    setFrom(''); setTo(''); setPackageId(''); setChannel(''); setStatus('');
    setClinicSearch(''); setMinSubsPerClinic('');
    setTimeout(load, 0);
  };

  const exportCsv = () => {
    if (!report) return;
    const header = ['Date', 'Clinic', 'Package', 'Channel', 'Amount', 'Currency', 'AmountUSD', 'Status', 'Reference', 'TxnId'];
    const rows = report.rows.map((r) => [
      r.settledAt || r.createdAt,
      r.clinicName,
      r.packageName,
      r.channel,
      r.amount,
      r.currency,
      r.amountUsd,
      r.status,
      r.reference,
      r.transactionId ?? '',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscription-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const aggregates = report?.aggregates;
  const fmtDate = (s: string) => new Date(s).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl md:text-4xl font-black text-pine dark:text-zinc-100 tracking-tighter uppercase flex items-center gap-3">
            <DollarSign className="text-seafoam" size={32}/> Subscription Payments
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Cross-clinic report · every gateway · server-side filters
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="h-10 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-zinc-800">
            {loading ? <RefreshCw size={12} className="animate-spin"/> : <RefreshCw size={12}/>} Refresh
          </button>
          <button onClick={exportCsv} disabled={!report?.rows.length} className="h-10 px-4 rounded-xl bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[10px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 active:scale-95">
            <Download size={12}/> Export CSV
          </button>
        </div>
      </header>

      {/* KPI cards */}
      {aggregates && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Revenue (USD)" value={`$${aggregates.totalSuccessAmountUsd.toFixed(2)}`} icon={<DollarSign size={14}/>} tone="emerald" />
          <Kpi label="Successful" value={aggregates.successCount.toLocaleString()} icon={<CheckCircle2 size={14}/>} tone="emerald" />
          <Kpi label="Pending" value={aggregates.pendingCount.toLocaleString()} icon={<Hourglass size={14}/>} tone="amber" />
          <Kpi label="Failed / Cancelled" value={aggregates.failedCount.toLocaleString()} icon={<AlertTriangle size={14}/>} tone="rose" />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-5 space-y-3">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Filter size={11}/> Filters
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="From">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls}/>
          </Field>
          <Field label="To">
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls}/>
          </Field>
          <Field label="Package">
            <select value={packageId} onChange={(e) => setPackageId(e.target.value)} className={inputCls}>
              <option value="">All packages</option>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Channel">
            <select value={channel} onChange={(e) => setChannel(e.target.value as AdminChannel | '')} className={inputCls}>
              <option value="">All channels</option>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as AdminStatus | '')} className={inputCls}>
              <option value="">Any status</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Clinic search">
            <input value={clinicSearch} onChange={(e) => setClinicSearch(e.target.value)} placeholder="name contains…" className={inputCls}/>
          </Field>
          <Field label="Min successful subs / clinic">
            <input type="number" value={minSubsPerClinic} onChange={(e) => setMinSubsPerClinic(e.target.value)} placeholder="e.g. 3" className={inputCls}/>
          </Field>
          <div className="flex items-end gap-2">
            <button onClick={apply} className="flex-1 h-10 rounded-xl bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[10px] font-black uppercase tracking-widest active:scale-95">Apply</button>
            <button onClick={reset} className="h-10 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-zinc-800">Reset</button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-800/60 text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Date</th>
                <th className="text-left px-4 py-2 font-semibold">Clinic</th>
                <th className="text-left px-4 py-2 font-semibold">Package</th>
                <th className="text-left px-4 py-2 font-semibold">Channel</th>
                <th className="text-right px-4 py-2 font-semibold">Amount</th>
                <th className="text-right px-4 py-2 font-semibold">USD</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
                <th className="text-left px-4 py-2 font-semibold">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {report?.rows.length ? report.rows.map((row) => (
                <tr key={`${row.channel}-${row.id}`} className="text-slate-700 dark:text-zinc-300">
                  <td className="px-4 py-3 whitespace-nowrap text-xs">{fmtDate(row.settledAt || row.createdAt)}</td>
                  <td className="px-4 py-3 font-medium">{row.clinicName}</td>
                  <td className="px-4 py-3">{row.packageName}</td>
                  <td className="px-4 py-3"><Pill text={row.channel}/></td>
                  <td className="px-4 py-3 text-right font-mono">{row.currency} {row.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-500 dark:text-zinc-500 text-xs">${row.amountUsd.toFixed(2)}</td>
                  <td className="px-4 py-3"><StatusPill status={row.status}/></td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-zinc-500 truncate max-w-[160px]">{row.reference}</td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400 dark:text-zinc-500 text-sm">
                  {loading ? 'Loading…' : 'No payments match the current filters.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {report && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-zinc-800 text-[10px] uppercase tracking-widest font-semibold text-slate-400 dark:text-zinc-500 flex justify-between">
            <span>{report.rows.length} of {report.total} shown</span>
            <span>{report.aggregates.distinctClinics} distinct clinics</span>
          </div>
        )}
      </div>

      {/* Per-clinic counts */}
      {report?.perClinicCounts && report.perClinicCounts.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3">
            <Building2 size={11}/> Successful subscriptions per clinic
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {report.perClinicCounts.map((c) => (
              <div key={c.clinicId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800/60">
                <span className="text-sm text-slate-700 dark:text-zinc-300 truncate">{c.clinicName}</span>
                <span className="text-xs font-black text-pine dark:text-seafoam">{c.successCount}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const inputCls = 'w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/20';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1">
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
    {children}
  </div>
);

const Pill: React.FC<{ text: string }> = ({ text }) => (
  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">{text}</span>
);

const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
    status === 'SUCCESS'
      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
      : status === 'PENDING'
      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
      : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
  }`}>{status}</span>
);

const Kpi: React.FC<{ label: string; value: string; icon: React.ReactNode; tone: 'emerald' | 'amber' | 'rose' }> = ({ label, value, icon, tone }) => {
  const toneCls = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
    amber:   'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
    rose:    'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300',
  }[tone];
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${toneCls}`}>
        {icon} {label}
      </div>
      <p className="mt-2 text-2xl font-black text-pine dark:text-zinc-100">{value}</p>
    </div>
  );
};

export default SubscriptionPaymentsAdminPage;
