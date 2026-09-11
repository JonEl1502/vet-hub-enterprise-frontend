import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader2, ReceiptText, AlertTriangle, ShieldAlert } from 'lucide-react';
import { adminSubscriptionReportAPI } from '../../../services/modules/adminSubscriptionReport.api';
import { subscriptionPackagesAPI } from '../../../services/modules/subscriptionPackages.api';
import { toast } from '../../../services';

/**
 * 302 — RECORD A SUBSCRIPTION THE SYSTEM FAILED TO RECORD.
 *
 * User, 2026-09-11: *"I want to be able to give a subpkg if I can prove client
 * paid but system failed to record"*.
 *
 * ⚠️ THIS IS THE LAST RESORT, AND IT SAYS SO. Two better tools exist and both
 * are authoritative in a way this is not:
 *   · Subscription Payments → **Reconcile** re-asks the gateway. It cannot
 *     invent a payment, so it is always the right first move when a reference
 *     exists.
 *   · **Manual activate** forces a known attempt through when the gateway can
 *     no longer confirm it.
 * This one creates a money record from an assertion, for money that arrived
 * with no attempt at all — cash, a bank transfer, M-Pesa to a till, or a
 * checkout that died before `initiate` ran.
 *
 * So the evidence fields are not paperwork, they are the point: in six months
 * nobody can otherwise tell this apart from a free plan quietly handed out. The
 * server enforces the same rules — a reason of at least 10 characters and a
 * reference — and refuses outright if that reference already belongs to a live
 * attempt, because that is reconcile's job.
 */

interface Props {
  ownerKind: 'CLINIC' | 'SUPPLIER' | 'CLIENT';
  ownerId: string;
  ownerName: string;
  onClose: () => void;
  onGranted: () => void;
}

const CYCLES = ['MONTHLY', 'SEMIANNUAL', 'YEARLY', 'BIENNIAL', 'TRIENNIAL'];
const CHANNELS = ['CASH', 'BANK', 'MPESA', 'CARD', 'OTHER'];

const label = 'block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 mb-1.5';
const field = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';

const RecordPaidSubscriptionDialog: React.FC<Props> = ({ ownerKind, ownerId, ownerName, onClose, onGranted }) => {
  const [packages, setPackages] = useState<any[]>([]);
  const [form, setForm] = useState({
    packageId: '', cycle: 'MONTHLY', amount: '', currency: 'KES',
    channel: 'CASH', reference: '', paidAt: new Date().toISOString().slice(0, 10), reason: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    let alive = true;
    subscriptionPackagesAPI.list()
      .then((r) => {
        if (!alive || !r.success) return;
        // Trials are resolved, never sold — the server refuses them too.
        setPackages((r.data?.packages ?? []).filter((p: any) => p.isActive !== false && !p.isTrial));
      })
      .catch(() => { /* the picker just stays empty */ });
    return () => { alive = false; };
  }, []);

  const chosen = packages.find((p) => String(p.id) === form.packageId);

  // Prefill the amount from the package's own price the first time one is
  // picked — the common case is that they paid the list price, and retyping it
  // is how a typo becomes a wrong revenue figure.
  useEffect(() => {
    if (chosen && !form.amount) set('amount', String(Number(chosen.price ?? chosen.amount ?? 0) || ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.packageId]);

  const problem = useMemo(() => {
    if (!form.packageId) return 'Pick the package they paid for.';
    if (!(Number(form.amount) > 0)) return 'Enter the amount that was actually received.';
    if (!form.reference.trim()) return 'A payment reference is required — it is the proof.';
    if (form.reason.trim().length < 10) return 'Give a reason of at least 10 characters. This is the audit trail.';
    return null;
  }, [form]);

  const submit = async () => {
    if (problem) { toast.error(problem); return; }
    setSaving(true);
    try {
      const res = await adminSubscriptionReportAPI.grant({
        ownerKind, ownerId,
        packageId: form.packageId,
        cycle: form.cycle,
        amount: Number(form.amount),
        currency: form.currency,
        channel: form.channel,
        reference: form.reference.trim(),
        paidAt: form.paidAt || undefined,
        reason: form.reason.trim(),
      });
      if (res.success) {
        toast.success(`Recorded — ${ownerName} is now on ${chosen?.name ?? 'the package'}`);
        onGranted();
        onClose();
      }
    } catch (e: any) {
      // The interceptor already surfaced the server's message.
      if (!e?.response && !e?.status) toast.error('Could not record the subscription.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 shrink-0">
            <ReceiptText size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black text-slate-900 dark:text-zinc-100">Record a paid subscription</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{ownerName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-pine dark:hover:text-zinc-100"><X size={16} /></button>
        </div>

        {/* Steer to the authoritative tool first. */}
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800">
          <ShieldAlert size={13} className="shrink-0 mt-0.5 text-sky-600" />
          <p className="text-[11px] text-sky-800 dark:text-sky-300 leading-relaxed">
            If the payment went through a gateway and has a reference, use
            <strong> Subscription Payments → Reconcile</strong> instead — it asks the
            provider directly. Use this only for money that arrived with no attempt
            behind it: cash, a bank transfer, or a checkout that never started.
          </p>
        </div>

        <div>
          <label className={label}>Package they paid for</label>
          <select className={field} value={form.packageId} onChange={(e) => set('packageId', e.target.value)}>
            <option value="">Choose a package…</option>
            {packages.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}{p.isAddon ? ' (add-on)' : ''} — {p.currency || 'KES'} {Number(p.price ?? p.amount ?? 0).toLocaleString()}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>Billing cycle</label>
            <select className={field} value={form.cycle} onChange={(e) => set('cycle', e.target.value)}>
              {CYCLES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Amount received</label>
            <input className={field} type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={label}>How it arrived</label>
            <select className={field} value={form.channel} onChange={(e) => set('channel', e.target.value)}>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={label}>Payment reference (the proof)</label>
            <input className={field} value={form.reference} onChange={(e) => set('reference', e.target.value)} placeholder="M-Pesa code, slip no., bank ref" />
          </div>
        </div>

        <div>
          <label className={label}>Date paid</label>
          <input className={field} type="date" value={form.paidAt} onChange={(e) => set('paidAt', e.target.value)} />
        </div>

        <div>
          <label className={label}>Why this is being recorded by hand</label>
          <textarea
            className={`${field} min-h-[72px] resize-y`}
            value={form.reason}
            onChange={(e) => set('reason', e.target.value)}
            placeholder="e.g. Paid KES 15 by M-Pesa on 10 Sept, receipt SFH4K2L9. Checkout errored before the attempt was created; confirmed against the till statement."
          />
          <p className="mt-1 text-[10px] text-slate-400 dark:text-zinc-500">
            Stored on the payment record with your name. It is how anyone later tells this
            from a plan given away for free.
          </p>
        </div>

        {problem && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <p className="text-[11px] font-semibold">{problem}</p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800">
            Cancel
          </button>
          <button
            onClick={submit} disabled={saving || !!problem}
            className="flex-1 py-2.5 rounded-xl bg-pine text-white text-xs font-black uppercase tracking-widest hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={13} className="animate-spin" />} Record payment
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordPaidSubscriptionDialog;
