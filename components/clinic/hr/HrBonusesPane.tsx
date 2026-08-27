import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Gift, Loader2, Plus, X, Save, Ban, Search } from 'lucide-react';
import { payrollAPI, Bonus, BonusStatus } from '../../../services/modules/payroll.api';
import { hrAPI, HrPerson } from '../../../services/modules/hr.api';
import {
  Card, Empty, Field, INPUT, BTN_PRIMARY, BTN_GHOST, Pill, PersonChip,
  titleCase, prettyDate, today,
} from './hrShared';

const money = (n: number, c = 'KES') =>
  `${c} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_TONE: Record<BonusStatus, any> = {
  PENDING: 'amber', ON_RUN: 'sky', PAID: 'emerald', CANCELLED: 'slate',
};
const STATUS_LABEL: Record<BonusStatus, string> = {
  PENDING: 'Awaiting payroll', ON_RUN: 'On a draft run', PAID: 'Paid', CANCELLED: 'Cancelled',
};

/** Common buckets, offered but not enforced — the reason carries the detail. */
const CATEGORIES = ['Performance', 'Overtime', 'Referral', 'Festive', 'Retention', 'Long service', 'Other'];

/**
 * HR ▸ Payroll ▸ Bonuses.
 *
 * A bonus is awarded when it is EARNED, not when payroll runs — by the time a
 * draft run exists the reason has been forgotten, which is the whole point of
 * the reason field. The next pay run covering its date picks it up
 * automatically and puts the reason on the payslip.
 */
const HrBonusesPane: React.FC = () => {
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [people, setPeople] = useState<HrPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Bonus | 'new' | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    payrollAPI.bonuses()
      .then(r => setBonuses(r.data?.bonuses ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  useEffect(() => { hrAPI.people().then(r => setPeople(r.data?.people ?? [])).catch(() => {}); }, []);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return bonuses;
    return bonuses.filter(b => `${b.name} ${b.reason} ${b.category ?? ''}`.toLowerCase().includes(n));
  }, [bonuses, q]);

  const pending = bonuses.filter(b => b.status === 'PENDING');
  const pendingTotal = pending.reduce((s, b) => s + b.amount, 0);

  const cancel = async (b: Bonus) => {
    await payrollAPI.updateBonus(b.id, { cancel: true });
    toast.success('Bonus cancelled');
    load();
  };

  if (loading) return <div className="py-16 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or reason" className={`${INPUT} pl-8`} />
        </div>
        {pending.length > 0 && (
          <Pill tone="amber">{pending.length} awaiting payroll · {money(pendingTotal)}</Pill>
        )}
        <button className={`${BTN_PRIMARY} ml-auto`} onClick={() => setEditing('new')}>
          <Plus size={11} /> Award bonus
        </button>
      </div>

      {filtered.length === 0 ? (
        <Empty icon={Gift} title={q ? 'Nothing matches' : 'No bonuses yet'}
          hint={q ? undefined : 'Award a bonus when it is earned and say why. The next pay run covering that date picks it up and puts the reason on the payslip.'}
          action={q ? undefined : <button className={BTN_PRIMARY} onClick={() => setEditing('new')}><Plus size={11} /> Award the first</button>} />
      ) : (
        <div className="space-y-2">
          {filtered.map(b => (
            <Card key={b.id} className={`p-3.5 ${b.status === 'CANCELLED' ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <PersonChip name={b.name} url={b.avatarUrl}
                  sub={`${prettyDate(b.awardedOn)}${b.awardedByName ? ` · by ${b.awardedByName}` : ''}`} />
                <div className="flex items-center gap-2">
                  <Pill tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Pill>
                  {!b.isTaxable && <Pill tone="violet">Not taxed</Pill>}
                  <span className="text-sm font-black font-mono text-emerald-600">{money(b.amount)}</span>
                </div>
              </div>

              {/* The reason IS the record — given its own line, not a tooltip. */}
              <p className="mt-2 text-[11px] font-bold text-pine dark:text-zinc-100">
                {b.category && <span className="text-slate-400">{b.category} · </span>}
                {b.reason}
              </p>
              {b.payRunPeriod && (
                <p className="mt-0.5 text-[9px] font-bold text-slate-400">
                  On the run for {prettyDate(b.payRunPeriod.start, { day: '2-digit', month: 'short' })} → {prettyDate(b.payRunPeriod.end)}
                </p>
              )}

              {/* Editable only while unpaid — once it is on an approved run it
                  is part of a payslip somebody was paid from. */}
              {(b.status === 'PENDING' || b.status === 'ON_RUN') && (
                <div className="mt-2 flex justify-end gap-1.5">
                  <button className={BTN_GHOST} onClick={() => setEditing(b)}>Edit</button>
                  <button className={`${BTN_GHOST} !text-rose-500`} onClick={() => cancel(b)}>
                    <Ban size={10} /> Cancel
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <BonusModal bonus={editing === 'new' ? null : editing} people={people}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
};

const BonusModal: React.FC<{ bonus: Bonus | null; people: HrPerson[]; onClose: () => void; onDone: () => void }> =
  ({ bonus, people, onClose, onDone }) => {
    const [userId, setUserId] = useState(bonus?.userId ?? people[0]?.userId ?? '');
    const [amount, setAmount] = useState(bonus ? String(bonus.amount) : '');
    const [reason, setReason] = useState(bonus?.reason ?? '');
    const [category, setCategory] = useState(bonus?.category ?? '');
    const [awardedOn, setAwardedOn] = useState(bonus ? String(bonus.awardedOn).slice(0, 10) : today());
    const [isTaxable, setIsTaxable] = useState(bonus ? bonus.isTaxable : true);
    const [busy, setBusy] = useState(false);

    const save = async () => {
      const amt = Number(amount);
      if (!userId) { toast.error('Pick who it is for'); return; }
      if (!Number.isFinite(amt) || amt <= 0) { toast.error('A bonus must be more than zero'); return; }
      // Enforced server-side too — the reason is the point of the record.
      if (!reason.trim()) { toast.error('Say why this bonus is being given'); return; }
      setBusy(true);
      try {
        const payload = { amount: amt, reason: reason.trim(), category: category || undefined, awardedOn, isTaxable };
        const res = bonus
          ? await payrollAPI.updateBonus(bonus.id, payload)
          : await payrollAPI.awardBonus({ userId, ...payload });
        if (res.data) { toast.success(bonus ? 'Bonus updated' : 'Bonus awarded'); onDone(); }
      } finally { setBusy(false); }
    };

    return (
      <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-pine/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-800">
            <h3 className="text-sm font-black text-pine dark:text-zinc-100">{bonus ? 'Edit bonus' : 'Award bonus'}</h3>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-pine"><X size={16} /></button>
          </div>
          <div className="p-5 space-y-3">
            <Field label="Who">
              <select className={INPUT} value={userId} disabled={!!bonus} onChange={e => setUserId(e.target.value)}>
                {people.map(p => <option key={p.userId} value={p.userId}>{p.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount">
                <input type="number" min={0} step="0.01" className={INPUT} value={amount} onChange={e => setAmount(e.target.value)} />
              </Field>
              <Field label="Earned on">
                <input type="date" className={INPUT} value={awardedOn} onChange={e => setAwardedOn(e.target.value)} />
              </Field>
            </div>
            <Field label="Category">
              <select className={INPUT} value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">—</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Reason *">
              <textarea rows={2} className={INPUT} value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Covered the emergency weekend rota single-handed" />
            </Field>
            <p className="text-[9px] font-bold text-slate-400">
              The reason appears on the payslip — write it for the person receiving it, not for the file.
            </p>
            <label className="flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-zinc-300">
              <input type="checkbox" checked={isTaxable} onChange={e => setIsTaxable(e.target.checked)} />
              Taxable (PAYE applies)
            </label>
            {!isTaxable && (
              <p className="text-[9px] font-bold text-amber-600">
                A cash bonus is normally taxable. Only untick this if you are certain the award is exempt.
              </p>
            )}
            <p className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-[10px] font-bold text-slate-500 dark:text-zinc-400">
              The next pay run covering {prettyDate(awardedOn)} picks this up automatically. Nothing is paid until
              that run is approved.
            </p>
          </div>
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-zinc-800">
            <button className={BTN_GHOST} onClick={onClose}>Cancel</button>
            <button className={BTN_PRIMARY} onClick={save} disabled={busy}>
              {busy ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} {bonus ? 'Save' : 'Award'}
            </button>
          </div>
        </div>
      </div>
    );
  };

export default HrBonusesPane;
