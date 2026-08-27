import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Wallet, Loader2, Plus, X, Save, ShieldAlert, ShieldCheck, RefreshCw,
  Check, Banknote, FileSpreadsheet, ChevronLeft, Trash2,
} from 'lucide-react';
import {
  payrollAPI, PayRun, RateTable, RateConfig, Payslip, StatutoryReturn,
} from '../../../services/modules/payroll.api';
import {
  Card, Empty, Field, INPUT, BTN_PRIMARY, BTN_GHOST, Pill, titleCase, prettyDate, isoDay,
} from './hrShared';

const RUN_TONE: Record<string, any> = {
  DRAFT: 'amber', APPROVED: 'sky', PAID: 'emerald', CANCELLED: 'slate',
};

const money = (n: number, c = 'KES') =>
  `${c} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * HR ▸ Payroll — owner only.
 *
 * A DRAFT run is disposable and recomputes on demand. Approval is the point of
 * no return, and it is gated on somebody having VERIFIED the statutory rates:
 * the seeded figures are a starting point typed from public guidance, not tax
 * advice, and payroll refuses to approve a run computed from unchecked rates.
 */
const HrPayrollTab: React.FC = () => {
  const [pane, setPane] = useState<'runs' | 'rates'>('runs');
  const [openRun, setOpenRun] = useState<string | null>(null);

  if (openRun) return <RunDetail id={openRun} onBack={() => setOpenRun(null)} />;

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-800">
        {(['runs', 'rates'] as const).map(p => (
          <button key={p} type="button" onClick={() => setPane(p)}
            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
              pane === p ? 'bg-seafoam text-white' : 'bg-white dark:bg-zinc-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800'
            }`}>
            {p === 'runs' ? 'Pay runs' : 'Statutory rates'}
          </button>
        ))}
      </div>
      {pane === 'runs' ? <Runs onOpen={setOpenRun} /> : <Rates />}
    </div>
  );
};

// ── Runs ────────────────────────────────────────────────────────────────────
const Runs: React.FC<{ onOpen: (id: string) => void }> = ({ onOpen }) => {
  const [runs, setRuns] = useState<PayRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    payrollAPI.runs()
      .then(r => setRuns(r.data?.runs ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  if (loading) return <div className="py-16 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button className={BTN_PRIMARY} onClick={() => setCreating(true)}><Plus size={11} /> New pay run</button>
      </div>

      {runs.length === 0 ? (
        <Empty icon={Wallet} title="No pay runs yet"
          hint="A run builds a payslip for everyone with a live employment file, works out PAYE, NSSF, SHIF and the housing levy, and totals what the clinic owes."
          action={<button className={BTN_PRIMARY} onClick={() => setCreating(true)}><Plus size={11} /> Start the first</button>} />
      ) : (
        <div className="space-y-2">
          {runs.map(r => (
            <Card key={r.id} className="p-3.5 hover:border-seafoam/40 transition-all cursor-pointer" >
              <div onClick={() => onOpen(r.id)} className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[11px] font-black text-pine dark:text-zinc-100">
                      {prettyDate(r.periodStart, { day: '2-digit', month: 'short' })} → {prettyDate(r.periodEnd)}
                    </p>
                    <Pill tone={RUN_TONE[r.status]}>{titleCase(r.status)}</Pill>
                    {r.rateTableVerified === false && <Pill tone="rose"><ShieldAlert size={9} /> Rates unverified</Pill>}
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                    {r.headcount} staff · {r.rateTable ?? 'no rate table'}
                    {r.paidAt ? ` · paid ${prettyDate(r.paidAt)}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Net to staff</p>
                  <p className="text-base font-black font-mono text-pine dark:text-zinc-100">{money(r.totals.net)}</p>
                  <p className="text-[9px] font-bold text-slate-400">Costs {money(r.totals.employerCost)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {creating && <NewRun onClose={() => setCreating(false)} onDone={(id) => { setCreating(false); load(); onOpen(id); }} />}
    </div>
  );
};

const NewRun: React.FC<{ onClose: () => void; onDone: (id: string) => void }> = ({ onClose, onDone }) => {
  // Default to the month just gone — the period you are almost always paying.
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const [periodStart, setPeriodStart] = useState(isoDay(first));
  const [periodEnd, setPeriodEnd] = useState(isoDay(last));
  const [payDate, setPayDate] = useState(isoDay(last));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const res = await payrollAPI.createRun({ periodStart, periodEnd, payDate });
      if (res.data?.id) { toast.success('Pay run created'); onDone(res.data.id); }
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-pine/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-800">
          <h3 className="text-sm font-black text-pine dark:text-zinc-100">New pay run</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-pine"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Period from"><input type="date" className={INPUT} value={periodStart} onChange={e => setPeriodStart(e.target.value)} /></Field>
            <Field label="Period to"><input type="date" className={INPUT} value={periodEnd} min={periodStart} onChange={e => setPeriodEnd(e.target.value)} /></Field>
          </div>
          <Field label="Pay date"><input type="date" className={INPUT} value={payDate} onChange={e => setPayDate(e.target.value)} /></Field>
          <p className="text-[9px] font-bold text-slate-400">
            Everyone with a live employment file in this period gets a payslip. It starts as a draft — nothing is
            final until you approve it.
          </p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-zinc-800">
          <button className={BTN_GHOST} onClick={onClose}>Cancel</button>
          <button className={BTN_PRIMARY} onClick={save} disabled={busy}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Create
          </button>
        </div>
      </div>
    </div>
  );
};

// ── One run ─────────────────────────────────────────────────────────────────
const RunDetail: React.FC<{ id: string; onBack: () => void }> = ({ id, onBack }) => {
  const [run, setRun] = useState<PayRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [statutory, setStatutory] = useState<StatutoryReturn | null>(null);
  const [paying, setPaying] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    payrollAPI.run(id)
      .then(r => setRun(r.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(load, [load]);

  const act = async (what: string, fn: () => Promise<any>) => {
    setBusy(what);
    try { await fn(); load(); } finally { setBusy(null); }
  };

  if (loading) return <div className="py-20 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>;
  if (!run) return <Empty icon={Wallet} title="Pay run not found" />;

  const isDraft = run.status === 'DRAFT';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className={BTN_GHOST} onClick={onBack}><ChevronLeft size={12} /> All runs</button>
        <Pill tone={RUN_TONE[run.status]}>{titleCase(run.status)}</Pill>
        <span className="text-[11px] font-black text-pine dark:text-zinc-100">
          {prettyDate(run.periodStart, { day: '2-digit', month: 'short' })} → {prettyDate(run.periodEnd)}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isDraft && (
            <button className={BTN_GHOST} disabled={!!busy}
              onClick={() => act('compute', async () => { await payrollAPI.computeRun(run.id); toast.success('Recomputed'); })}>
              {busy === 'compute' ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Recompute
            </button>
          )}
          {isDraft && (
            <button className={BTN_PRIMARY} disabled={!!busy}
              onClick={() => act('approve', async () => { await payrollAPI.approveRun(run.id); toast.success('Approved'); })}>
              <Check size={11} /> Approve
            </button>
          )}
          {run.status === 'APPROVED' && (
            <button className={BTN_PRIMARY} disabled={!!busy} onClick={() => setPaying(true)}>
              <Banknote size={11} /> Mark paid
            </button>
          )}
          <button className={BTN_GHOST} disabled={!!busy}
            onClick={() => act('stat', async () => {
              const r = await payrollAPI.statutory(run.id);
              setStatutory(r.data ?? null);
            })}>
            <FileSpreadsheet size={11} /> Statutory
          </button>
          {run.status !== 'PAID' && (
            <button className={`${BTN_GHOST} !text-rose-500`} disabled={!!busy}
              onClick={() => act('cancel', async () => { await payrollAPI.cancelRun(run.id); toast.success('Cancelled'); onBack(); })}>
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      {/* The gate. Said plainly, where the Approve button is. */}
      {isDraft && run.rateTableVerified === false && (
        <Card className="p-4 border-rose-300 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/20">
          <div className="flex items-start gap-2.5">
            <ShieldAlert size={16} className="text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">
                These statutory rates have not been verified
              </p>
              <p className="text-[10px] font-bold text-rose-700/90 dark:text-rose-400/90 mt-0.5">
                The seeded PAYE bands, NSSF limits, SHIF and housing levy are a starting point typed from public
                guidance — not tax advice. Check every figure under <b>Statutory rates</b> against the current
                Finance Act and mark the table verified. This run cannot be approved until you do.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Gross', run.totals.gross, ''],
          ['PAYE', run.totals.paye, 'text-amber-600'],
          ['Net to staff', run.totals.net, 'text-emerald-600'],
          ['Total clinic cost', run.totals.employerCost, 'text-violet-500'],
        ].map(([l, v, tone]) => (
          <Card key={String(l)} className="p-4">
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">{l}</p>
            <p className={`text-lg font-black font-mono ${tone || 'text-pine dark:text-zinc-100'}`}>{money(v as number)}</p>
          </Card>
        ))}
      </div>

      {/* Employer contributions are invisible on a payslip and are the number
          owners are most often surprised by — so they get their own line. */}
      <Card className="p-3.5">
        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">What the clinic remits</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1.5">
          {[
            ['PAYE → KRA', run.totals.paye],
            ['NSSF (both halves)', run.totals.nssfEmployee + run.totals.nssfEmployer],
            ['SHIF', run.totals.shif],
            ['Housing levy (both)', run.totals.housingEmployee + run.totals.housingEmployer],
          ].map(([l, v]) => (
            <span key={String(l)} className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">
              {l}: <b className="font-mono text-pine dark:text-zinc-100">{money(v as number)}</b>
            </span>
          ))}
        </div>
      </Card>

      {(run.payslips ?? []).length === 0 ? (
        <Empty icon={Wallet} title="No payslips"
          hint="Nobody has a live employment file covering this period. Add one under People, then Recompute." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800">
                <th className="text-left px-3 py-2 text-[8px] font-black uppercase tracking-widest text-slate-400">Staff</th>
                {['Basic', 'Gross', 'Taxable', 'PAYE', 'NSSF', 'SHIF', 'Housing', 'Other', 'Net'].map(h => (
                  <th key={h} className="text-right px-3 py-2 text-[8px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(run.payslips ?? []).map(p => (
                <tr key={p.id} className="border-b border-slate-100 dark:border-zinc-800/60">
                  <td className="px-3 py-2">
                    <p className="text-[10px] font-black text-pine dark:text-zinc-100 truncate">{p.staffName}</p>
                    <p className="text-[9px] font-bold text-slate-400 truncate">
                      {p.jobTitle || '—'}{p.daysWorked ? ` · ${p.daysWorked}d worked` : ''}
                    </p>
                  </td>
                  {[p.basicPay, p.grossPay, p.taxablePay, p.paye, p.nssfEmployee, p.shif, p.housingEmployee, p.otherDeductions].map((v, i) => (
                    <td key={i} className="px-3 py-2 text-right text-[10px] font-mono text-slate-600 dark:text-zinc-300">
                      {v ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right text-[10px] font-black font-mono text-emerald-600">
                    {p.netPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {statutory && <StatutoryModal data={statutory} onClose={() => setStatutory(null)} />}
      {paying && (
        <MarkPaid run={run} onClose={() => setPaying(false)}
          onDone={() => { setPaying(false); load(); }} />
      )}
    </div>
  );
};

const MarkPaid: React.FC<{ run: PayRun; onClose: () => void; onDone: () => void }> = ({ run, onClose, onDone }) => {
  const [paidOn, setPaidOn] = useState(run.payDate ? String(run.payDate).slice(0, 10) : isoDay(new Date()));
  const [paidVia, setPaidVia] = useState('BANK_TRANSFER');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const res = await payrollAPI.markPaid(run.id, { paidOn, paidVia });
      if (res.data) { toast.success('Marked paid — expense posted'); onDone(); }
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-pine/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-800">
          <h3 className="text-sm font-black text-pine dark:text-zinc-100">Mark paid</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-pine"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          {/* Say exactly what this writes before it writes it. */}
          <p className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-700 dark:text-amber-400">
            This posts <b>{money(run.totals.employerCost)}</b> to Finance as a Payroll expense — gross plus the
            employer's NSSF and housing levy. That is the clinic's real cost, not the {money(run.totals.net)} that
            reaches staff accounts. It can only be done once.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Paid on"><input type="date" className={INPUT} value={paidOn} onChange={e => setPaidOn(e.target.value)} /></Field>
            <Field label="Paid via">
              <select className={INPUT} value={paidVia} onChange={e => setPaidVia(e.target.value)}>
                {['BANK_TRANSFER', 'CASH', 'M_PESA', 'CHEQUE'].map(m => <option key={m} value={m}>{titleCase(m)}</option>)}
              </select>
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-zinc-800">
          <button className={BTN_GHOST} onClick={onClose}>Cancel</button>
          <button className={BTN_PRIMARY} onClick={save} disabled={busy}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Banknote size={11} />} Post expense
          </button>
        </div>
      </div>
    </div>
  );
};

const StatutoryModal: React.FC<{ data: StatutoryReturn; onClose: () => void }> = ({ data, onClose }) => (
  <div className="fixed inset-0 z-[400] flex items-start justify-center p-4 overflow-y-auto bg-pine/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
    <div className="w-full max-w-3xl my-8 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h3 className="text-sm font-black text-pine dark:text-zinc-100">Statutory return</h3>
          <p className="text-[9px] font-bold text-slate-400">
            {prettyDate(data.period.start)} → {prettyDate(data.period.end)}
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-pine"><X size={16} /></button>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[['PAYE', data.totals.paye], ['NSSF', data.totals.nssf], ['SHIF', data.totals.shif], ['Housing levy', data.totals.housingLevy]].map(([l, v]) => (
            <div key={String(l)} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800">
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{l}</p>
              <p className="text-sm font-black font-mono text-pine dark:text-zinc-100">{money(v as number)}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-bold text-slate-400">
          NSSF and the housing levy show BOTH halves — the employee's deduction and the employer's, which are
          remitted together.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800">
                {['Staff', 'KRA PIN', 'Gross', 'Taxable', 'PAYE', 'NSSF', 'SHIF', 'Housing'].map(h => (
                  <th key={h} className={`px-2 py-2 text-[8px] font-black uppercase tracking-widest text-slate-400 ${h === 'Staff' || h === 'KRA PIN' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-zinc-800/60">
                  <td className="px-2 py-1.5 text-[10px] font-bold text-pine dark:text-zinc-100 truncate">{r.staffName}</td>
                  <td className={`px-2 py-1.5 text-[10px] font-mono ${r.kraPin ? 'text-slate-500' : 'text-rose-500'}`}>
                    {r.kraPin || 'missing'}
                  </td>
                  {[r.grossPay, r.taxablePay, r.paye, r.nssf, r.shif, r.housingLevy].map((v, j) => (
                    <td key={j} className="px-2 py-1.5 text-right text-[10px] font-mono text-slate-600 dark:text-zinc-300">
                      {v ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
);

// ── Rates ───────────────────────────────────────────────────────────────────
const Rates: React.FC = () => {
  const [tables, setTables] = useState<RateTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RateTable | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    payrollAPI.rates()
      .then(r => setTables(r.data?.tables ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const seed = async () => {
    setBusy(true);
    try { await payrollAPI.seedRates(); toast.success('Starting rates created — now check them'); load(); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="py-16 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>;

  if (tables.length === 0) {
    return (
      <Empty icon={ShieldAlert} title="No statutory rates set"
        hint="Payroll needs PAYE bands, NSSF limits, SHIF and the housing levy. Start from a Kenyan template, then check every figure against the current Finance Act before you run anything."
        action={<button className={BTN_PRIMARY} onClick={seed} disabled={busy}>
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Create starting rates
        </button>} />
    );
  }

  return (
    <div className="space-y-3">
      {tables.map(t => (
        <Card key={t.id} className={`p-4 ${t.isVerified ? '' : 'border-rose-300 dark:border-rose-900/60'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[11px] font-black text-pine dark:text-zinc-100">{t.name}</p>
                {t.isVerified
                  ? <Pill tone="emerald"><ShieldCheck size={9} /> Verified</Pill>
                  : <Pill tone="rose"><ShieldAlert size={9} /> Not verified</Pill>}
              </div>
              <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                From {prettyDate(t.effectiveFrom)}{t.effectiveTo ? ` to ${prettyDate(t.effectiveTo)}` : ' · current'}
                {t.isVerified && t.verifiedByName ? ` · checked by ${t.verifiedByName}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className={BTN_GHOST} onClick={() => setEditing(t)}>Review & edit</button>
              {!t.isVerified && (
                <button className={BTN_PRIMARY}
                  onClick={async () => { await payrollAPI.verifyRates(t.id); toast.success('Rates verified'); load(); }}>
                  <ShieldCheck size={11} /> Mark verified
                </button>
              )}
            </div>
          </div>
          {!t.isVerified && (
            <p className="mt-2 text-[10px] font-bold text-rose-700/90 dark:text-rose-400/90">
              No pay run can be approved against these until somebody confirms them. Editing any figure resets this.
            </p>
          )}
        </Card>
      ))}

      {editing && <RateEditor table={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
    </div>
  );
};

const RateEditor: React.FC<{ table: RateTable; onClose: () => void; onDone: () => void }> = ({ table, onClose, onDone }) => {
  const [c, setC] = useState<RateConfig>(() => JSON.parse(JSON.stringify(table.config)));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await payrollAPI.updateRates(table.id, {
        name: table.name, effectiveFrom: table.effectiveFrom, effectiveTo: table.effectiveTo,
        config: c, notes: table.notes,
      });
      toast.success('Saved — mark it verified when you are happy');
      onDone();
    } finally { setBusy(false); }
  };

  const band = (i: number, k: 'upTo' | 'rate', v: string) => {
    const next = { ...c, payeBands: c.payeBands.map((b, j) => j === i ? { ...b, [k]: v === '' ? null : Number(v) } : b) };
    setC(next);
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-start justify-center p-4 overflow-y-auto bg-pine/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl my-8 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-800">
          <h3 className="text-sm font-black text-pine dark:text-zinc-100">{table.name}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-pine"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-5">
          <p className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-700 dark:text-amber-400">
            Check each figure against the current Finance Act. Saving any change resets verification, and payroll
            will not approve a run until the table is verified again.
          </p>

          <section>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">PAYE bands (monthly)</p>
            <div className="space-y-2">
              {c.payeBands.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-slate-400 w-16">
                    {i === 0 ? 'First' : c.payeBands[i - 1].upTo?.toLocaleString()}
                  </span>
                  <input type="number" className={INPUT} placeholder="no upper limit"
                    value={b.upTo ?? ''} onChange={e => band(i, 'upTo', e.target.value)} />
                  <span className="text-[9px] font-bold text-slate-400">@</span>
                  <input type="number" step="0.5" className={`${INPUT} max-w-[90px]`}
                    value={b.rate} onChange={e => band(i, 'rate', e.target.value)} />
                  <span className="text-[9px] font-bold text-slate-400">%</span>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[9px] font-bold text-slate-400">
              Each band taxes only the slice inside it. The last must have no upper limit, or income above the
              highest bound would fall through untaxed.
            </p>
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Personal relief / month">
              <input type="number" className={INPUT} value={c.personalRelief}
                onChange={e => setC({ ...c, personalRelief: Number(e.target.value) })} />
            </Field>
            <Field label="NSSF tier I up to">
              <input type="number" className={INPUT} value={c.nssf.tier1UpTo}
                onChange={e => setC({ ...c, nssf: { ...c.nssf, tier1UpTo: Number(e.target.value) } })} />
            </Field>
            <Field label="NSSF tier II up to">
              <input type="number" className={INPUT} value={c.nssf.tier2UpTo}
                onChange={e => setC({ ...c, nssf: { ...c.nssf, tier2UpTo: Number(e.target.value) } })} />
            </Field>
            <Field label="NSSF rate %">
              <input type="number" step="0.1" className={INPUT} value={c.nssf.rate}
                onChange={e => setC({ ...c, nssf: { ...c.nssf, rate: Number(e.target.value) } })} />
            </Field>
            <Field label="SHIF rate %">
              <input type="number" step="0.01" className={INPUT} value={c.shif.rate}
                onChange={e => setC({ ...c, shif: { ...c.shif, rate: Number(e.target.value) } })} />
            </Field>
            <Field label="SHIF minimum">
              <input type="number" className={INPUT} value={c.shif.minimum}
                onChange={e => setC({ ...c, shif: { ...c.shif, minimum: Number(e.target.value) } })} />
            </Field>
            <Field label="Housing levy — employee %">
              <input type="number" step="0.1" className={INPUT} value={c.housingLevy.employeeRate}
                onChange={e => setC({ ...c, housingLevy: { ...c.housingLevy, employeeRate: Number(e.target.value) } })} />
            </Field>
            <Field label="Housing levy — employer %">
              <input type="number" step="0.1" className={INPUT} value={c.housingLevy.employerRate}
                onChange={e => setC({ ...c, housingLevy: { ...c.housingLevy, employerRate: Number(e.target.value) } })} />
            </Field>
          </div>

          <section>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Deducted from pay before PAYE
            </p>
            <p className="text-[9px] font-bold text-slate-400 mb-2">
              The most consequential switch here — it has changed by law more than once. Getting it wrong shifts
              every PAYE figure.
            </p>
            <div className="flex flex-wrap gap-4">
              {([['nssf', 'NSSF'], ['shif', 'SHIF'], ['housingLevy', 'Housing levy']] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-zinc-300">
                  <input type="checkbox" checked={c.taxableDeductions[k]}
                    onChange={e => setC({ ...c, taxableDeductions: { ...c.taxableDeductions, [k]: e.target.checked } })} />
                  {l}
                </label>
              ))}
            </div>
          </section>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-zinc-800">
          <button className={BTN_GHOST} onClick={onClose}>Cancel</button>
          <button className={BTN_PRIMARY} onClick={save} disabled={busy}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default HrPayrollTab;
