import React from 'react';
import { Smartphone, Coins, Landmark, CreditCard, ReceiptText } from 'lucide-react';
import { CHANNEL_GROUPS, PaymentChannel, channelById } from './paymentChannels';

/**
 * Pick HOW the money arrived, and capture its reference.
 *
 * One component for every money screen. Before this, "Received by" was four
 * flat buttons (M-Pesa / Cash / Bank / Card) beside a single vague
 * "M-Pesa code, slip no." box — so a Pochi payment and a Paybill payment were
 * indistinguishable afterwards, and the reference had no label telling staff
 * what to actually type (user, 2026-08-13).
 *
 * The caller gets BOTH the channel id (for `metadata.channel`) and the
 * `PaymentMethod` enum value the channel settles as, so the ledger keeps
 * recording the method it always did.
 */
const GROUP_ICON: Record<string, React.ReactNode> = {
  cash: <Coins size={13} />,
  mpesa: <Smartphone size={13} />,
  bank: <Landmark size={13} />,
  card: <CreditCard size={13} />,
};

interface Props {
  value: string | null;
  onChange: (channel: PaymentChannel) => void;
  reference: string;
  onReferenceChange: (v: string) => void;
  /** Hide the reference input (e.g. the caller renders its own). */
  hideReference?: boolean;
  /** Restrict to one group — a bank wallet should not offer M-Pesa. */
  onlyGroups?: string[];
  className?: string;
}

const PaymentChannelPicker: React.FC<Props> = ({
  value, onChange, reference, onReferenceChange, hideReference, onlyGroups, className,
}) => {
  const groups = onlyGroups?.length
    ? CHANNEL_GROUPS.filter(g => onlyGroups.includes(g.key))
    : CHANNEL_GROUPS;
  const picked = channelById(value);

  return (
    <div className={className}>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Received by</p>
      <div className="space-y-2">
        {groups.map(g => (
          <div key={g.key}>
            {/* The group label is what staff say out loud ("it came by M-Pesa");
                the channel under it is what reconciliation needs. */}
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-slate-400">{GROUP_ICON[g.key]}</span>
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{g.label}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {g.channels.map(c => {
                const on = value === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onChange(c)}
                    className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${
                      on
                        ? 'border-seafoam bg-seafoam/10 text-seafoam'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:border-seafoam/50'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {picked?.hint && (
        <p className="mt-2 text-[10px] font-bold text-slate-400 leading-relaxed">{picked.hint}</p>
      )}

      {/* The reference is labelled by the CHANNEL, so staff are told exactly
          what to type — a cheque number is not an M-Pesa code. Cash has none,
          so the field disappears rather than sitting there unanswerable. */}
      {!hideReference && picked?.refLabel && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between mb-1.5">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{picked.refLabel}</p>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">
              {picked.refExpected ? 'Recommended' : 'Optional'}
            </span>
          </div>
          <div className="relative">
            <ReceiptText size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              value={reference}
              maxLength={100}
              onChange={e => onReferenceChange(e.target.value)}
              placeholder={picked.refPlaceholder}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm font-mono text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentChannelPicker;
