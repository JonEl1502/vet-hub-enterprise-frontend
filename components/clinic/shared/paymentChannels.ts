/**
 * HOW the money arrived, one rung below the payment METHOD.
 *
 * `paymentMethod` (CASH / M_PESA / BANK_TRANSFER / CARD / CHEQUE) is what the
 * ledger and the enum record. It is not what staff actually see at the counter:
 * "M-Pesa" is four different things — a Send Money to a phone, Pochi la
 * Biashara, a Paybill with an account number, or a Till — and each leaves a
 * DIFFERENT reference on the client's phone. A bank is a transfer, a cheque or
 * a cash deposit, and each has its own slip.
 *
 * Recording only the method means the reference field has to be a vague
 * "M-Pesa code, slip no." catch-all, and reconciliation later cannot tell a
 * Pochi payment from a Paybill one without opening the statement.
 *
 * The channel rides in `transactions.metadata.channel` — Json, so no migration
 * — beside `metadata.reference`, which already existed.
 *
 * ⚠️ The METHOD is what must stay valid: it is a Postgres enum and the ledger,
 * the drawer and every report group on it. A channel is a label. If the two
 * ever disagree, the method wins.
 */

export interface PaymentChannel {
  /** Stored in `metadata.channel`. Stable — reports may group on it. */
  id: string;
  label: string;
  /** The `PaymentMethod` enum value this channel settles as. */
  method: 'CASH' | 'M_PESA' | 'BANK_TRANSFER' | 'CARD' | 'CHEQUE';
  /** What to call the reference for this channel. Null = no reference exists. */
  refLabel: string | null;
  refPlaceholder?: string;
  /** True when a payment on this channel is meaningless without its reference. */
  refExpected?: boolean;
  hint?: string;
}

export const PAYMENT_CHANNELS: PaymentChannel[] = [
  // ── Cash ────────────────────────────────────────────────────────────────
  { id: 'CASH', label: 'Cash', method: 'CASH', refLabel: null,
    hint: 'Handed over at the counter.' },

  // ── M-Pesa ──────────────────────────────────────────────────────────────
  // All four settle as M_PESA; they differ in where the money lands and what
  // the client can quote back to you.
  { id: 'MPESA_SEND_MONEY', label: 'Send Money', method: 'M_PESA',
    refLabel: 'M-Pesa code', refPlaceholder: 'e.g. SFH4KJ21XZ', refExpected: true,
    hint: 'Sent to a phone number. The code is the only proof — capture it.' },
  { id: 'MPESA_POCHI', label: 'Pochi la Biashara', method: 'M_PESA',
    refLabel: 'M-Pesa code', refPlaceholder: 'e.g. SFH4KJ21XZ', refExpected: true,
    hint: 'Business pocket on a phone number. No account number.' },
  { id: 'MPESA_PAYBILL', label: 'Paybill', method: 'M_PESA',
    refLabel: 'M-Pesa code', refPlaceholder: 'e.g. SFH4KJ21XZ', refExpected: true,
    hint: 'Paybill + account number.' },
  { id: 'MPESA_TILL', label: 'Till (Buy Goods)', method: 'M_PESA',
    refLabel: 'M-Pesa code', refPlaceholder: 'e.g. SFH4KJ21XZ', refExpected: true,
    hint: 'Buy Goods till. No account number.' },

  // ── Bank ────────────────────────────────────────────────────────────────
  { id: 'BANK_TRANSFER', label: 'Bank transfer', method: 'BANK_TRANSFER',
    refLabel: 'Transfer reference', refPlaceholder: 'Bank reference / slip no.', refExpected: true },
  { id: 'BANK_DEPOSIT', label: 'Cash deposit', method: 'BANK_TRANSFER',
    refLabel: 'Deposit slip no.', refPlaceholder: 'Slip number', refExpected: true,
    hint: 'Paid in over the counter at the bank.' },
  { id: 'BANK_PAYBILL', label: 'Bank paybill', method: 'BANK_TRANSFER',
    refLabel: 'M-Pesa code', refPlaceholder: 'e.g. SFH4KJ21XZ', refExpected: true,
    hint: "The bank's own paybill, quoting your account number. Settles into the bank." },
  { id: 'CHEQUE', label: 'Cheque', method: 'CHEQUE',
    refLabel: 'Cheque number', refPlaceholder: 'e.g. 004512', refExpected: true,
    hint: 'Recorded now; it clears with the bank in its own time.' },

  // ── Card ────────────────────────────────────────────────────────────────
  { id: 'CARD', label: 'Card', method: 'CARD',
    refLabel: 'Auth / receipt no.', refPlaceholder: 'Terminal reference' },
];

/** Channels grouped for the picker, in the order a counter would think of them. */
export const CHANNEL_GROUPS: { key: string; label: string; channels: PaymentChannel[] }[] = [
  { key: 'cash',  label: 'Cash',   channels: PAYMENT_CHANNELS.filter(c => c.id === 'CASH') },
  { key: 'mpesa', label: 'M-Pesa', channels: PAYMENT_CHANNELS.filter(c => c.method === 'M_PESA') },
  { key: 'bank',  label: 'Bank',   channels: PAYMENT_CHANNELS.filter(c => c.method === 'BANK_TRANSFER' || c.method === 'CHEQUE') },
  { key: 'card',  label: 'Card',   channels: PAYMENT_CHANNELS.filter(c => c.id === 'CARD') },
];

export const channelById = (id?: string | null): PaymentChannel | null =>
  (id ? PAYMENT_CHANNELS.find(c => c.id === id) ?? null : null);

/**
 * Best channel for a bare method, for rows recorded before channels existed
 * (and for a wallet that dictates its own method). Returns the plainest option
 * so nothing is invented: an old M_PESA row becomes "M-Pesa", not "Paybill".
 */
export const defaultChannelForMethod = (method?: string | null): PaymentChannel | null => {
  switch (method) {
    case 'CASH': return channelById('CASH');
    case 'M_PESA': return channelById('MPESA_PAYBILL');
    case 'BANK_TRANSFER': return channelById('BANK_TRANSFER');
    case 'CHEQUE': return channelById('CHEQUE');
    case 'CARD': return channelById('CARD');
    default: return null;
  }
};
