import React from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, PiggyBank, Banknote, Smartphone, Landmark, CreditCard } from 'lucide-react';
import { clientsAPI, toast } from '../../../services';

/**
 * Top up a client's payment account — money in ADVANCE of any bill, which the
 * next collection can spend (user, 2026-08-04: "in both credits allow top up").
 *
 * The method is recorded, not processed: this posts the advance straight to the
 * account. Wiring M-Pesa STK / card capture happens later, so the copy says
 * "record", never "charge" — the front desk has already taken the money.
 */
const METHODS = [
  { id: 'MPESA', label: 'M-Pesa', icon: Smartphone },
  { id: 'CASH', label: 'Cash', icon: Banknote },
  { id: 'BANK_TRANSFER', label: 'Bank', icon: Landmark },
  { id: 'CARD', label: 'Card', icon: CreditCard },
];

const CreditTopUpModal: React.FC<{
  open: boolean;
  clientId: string | number;
  clientName?: string;
  currency: string;
  currentCredit: number;
  onClose: () => void;
  onDone: () => void;
}> = ({ open, clientId, clientName, currency, currentCredit, onClose, onDone }) => {
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState('MPESA');
  const [reference, setReference] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => { if (open) { setAmount(''); setReference(''); setMethod('MPESA'); } }, [open]);
  if (!open) return null;

  const n = Number(amount);
  const valid = Number.isFinite(n) && n > 0;
  const money = (v: number) => `${currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const res = await clientsAPI.recordAdvance(clientId, {
        amount: n,
        paymentMethod: method,
        ...(reference.trim() ? { note: reference.trim() } : {}),
      } as any);
      if (res.success) {
        toast.success(`${money(n)} added to ${clientName || 'the client'}'s account`);
        onDone();
        onClose();
      }
    } catch (e: any) { toast.error(e?.message || 'Could not record the top-up'); }
    finally { setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 bg-pine/95 dark:bg-black/95 backdrop-blur-sm z-[850] flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-sm w-full rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}>
        <div className="bg-emerald-600 px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[8px] font-black text-white/60 uppercase tracking-[0.2em]">Top up payment account</p>
            <p className="text-base font-black text-white uppercase tracking-tight truncate">{clientName || 'Client'}</p>
            <p className="text-[10px] font-bold text-white/70 mt-0.5">Available now · {money(currentCredit)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 shrink-0"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Amount ({currency})</label>
            <input type="number" min="0" step="any" inputMode="decimal" autoFocus
              value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-lg font-black font-mono text-right text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Received by</label>
            <div className="grid grid-cols-2 gap-1.5">
              {METHODS.map(m => (
                <button key={m.id} type="button" onClick={() => setMethod(m.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                    method === m.id
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                      : 'border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:border-emerald-400'
                  }`}>
                  <m.icon size={13} /> {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Reference (optional)</label>
            <input type="text" value={reference} onChange={e => setReference(e.target.value)}
              placeholder="M-Pesa code, slip no."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          {valid && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Credit after</span>
              <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-400">{money(currentCredit + n)}</span>
            </div>
          )}

          <p className="text-[9px] font-bold text-slate-400 leading-relaxed">
            This records money already received. It lands on the account as spendable credit —
            the next collection draws from it before cash. Card and M-Pesa capture are not wired yet.
          </p>

          <button onClick={submit} disabled={!valid || busy}
            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-40">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <PiggyBank size={14} />}
            {busy ? 'Recording…' : valid ? `Add ${money(n)}` : 'Enter an amount'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CreditTopUpModal;
