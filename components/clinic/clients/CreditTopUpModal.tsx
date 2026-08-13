import React from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, PiggyBank } from 'lucide-react';
import { clientsAPI, toast } from '../../../services';
import PaymentChannelPicker from '../shared/PaymentChannelPicker';
import { PaymentChannel, channelById } from '../shared/paymentChannels';

/**
 * Top up a client's payment account — money in ADVANCE of any bill, which the
 * next collection can spend (user, 2026-08-04: "in both credits allow top up").
 *
 * The method is recorded, not processed: this posts the advance straight to the
 * account. Wiring M-Pesa STK / card capture happens later, so the copy says
 * "record", never "charge" — the front desk has already taken the money.
 */
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
  // The CHANNEL is what staff pick ("Pochi", "Cheque"); the enum method it
  // settles as is derived from it, so the ledger keeps recording what it always
  // did while reconciliation gains the detail it was missing.
  const [channelId, setChannelId] = React.useState('MPESA_PAYBILL');
  const [reference, setReference] = React.useState('');
  /** The phone number / bank account the money came FROM. */
  const [payer, setPayer] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => { if (open) { setAmount(''); setReference(''); setPayer(''); setChannelId('MPESA_PAYBILL'); } }, [open]);
  if (!open) return null;

  const n = Number(amount);
  const valid = Number.isFinite(n) && n > 0;
  const money = (v: number) => `${currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const channel = channelById(channelId);
      const res = await clientsAPI.recordAdvance(clientId, {
        amount: n,
        paymentMethod: channel?.method ?? 'CASH',
        channel: channelId,
        ...(reference.trim() ? { reference: reference.trim(), note: reference.trim() } : {}),
        ...(payer.trim() ? { payer: payer.trim() } : {}),
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
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm z-[850] flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="bg-emerald-600 px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[8px] font-black text-white/60 uppercase tracking-[0.2em]">Top up payment account</p>
            <p className="text-base font-black text-white uppercase tracking-tight truncate">{clientName || 'Client'}</p>
            <p className="text-[10px] font-bold text-white/70 mt-0.5">Available now · {money(currentCredit)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 shrink-0"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Amount ({currency})</label>
            <input type="number" min="0" step="any" inputMode="decimal" autoFocus
              value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-lg font-black font-mono text-right text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          {/* Channel + its own reference. Replaces four flat method buttons and
              a vague "M-Pesa code, slip no." box that could not tell a Pochi
              payment from a Paybill one after the fact. */}
          <PaymentChannelPicker
            value={channelId}
            onChange={(c: PaymentChannel) => setChannelId(c.id)}
            reference={reference}
            onReferenceChange={setReference}
            payer={payer}
            onPayerChange={setPayer}
          />

          {valid && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Credit after</span>
              <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-400">{money(currentCredit + n)}</span>
            </div>
          )}

          <p className="text-[9px] font-bold text-slate-400 leading-relaxed">
            This records money already received. It lands on the account as spendable credit —
            the next collection draws from it before cash. Nothing is charged here: the money
            has already changed hands, and the reference is what proves it.
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
