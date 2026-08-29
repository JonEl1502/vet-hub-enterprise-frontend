import React, { useMemo, useState } from 'react';
import { ArrowLeft, Banknote, Smartphone, CreditCard, Delete, Check } from 'lucide-react';
import type { PosController } from './usePos';
import type { PosPaymentMethod } from '../../../services';

/**
 * Taking the money.
 *
 * A full screen on mobile and a modal on desktop, because at this moment the
 * cashier is doing exactly one thing and the grid behind is a distraction.
 *
 * ── Why the keypad and not the phone keyboard ──────────────────────────────
 * The OS numeric keyboard covers half the screen, takes ~300ms to animate in,
 * and puts the decimal point somewhere different on every device. A keypad in
 * the page is instant, always in the same place, and leaves the change due
 * visible while the cashier types.
 */

const METHODS: { id: PosPaymentMethod; label: string; icon: React.FC<any> }[] = [
  { id: 'CASH', label: 'Cash', icon: Banknote },
  { id: 'MPESA', label: 'M-Pesa', icon: Smartphone },
  { id: 'CARD', label: 'Card', icon: CreditCard },
];

/** "5000" -> "5,000"; "5000.5" -> "5,000.5"; "5000." -> "5,000." */
const groupWhileTyping = (raw: string) => {
  const [whole, ...rest] = raw.split('.');
  const grouped = whole ? Number(whole).toLocaleString() : whole;
  return raw.includes('.') ? `${grouped}.${rest.join('')}` : grouped;
};

const money = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  pos: PosController;
  onDone: (sale: any) => void;
  onBack: () => void;
}

const PosTender: React.FC<Props> = ({ pos, onDone, onBack }) => {
  const { preview, currency, completeSale } = pos;
  const total = preview?.total ?? 0;

  const [method, setMethod] = useState<PosPaymentMethod>('CASH');
  const [entry, setEntry] = useState('');
  const [reference, setReference] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // An empty keypad means "the customer paid it exactly" — the overwhelmingly
  // common case, and one the cashier should not have to type.
  const tendered = entry === '' ? total : Number(entry) || 0;
  const change = Math.max(0, tendered - total);
  const short = tendered < total;

  /**
   * The notes a cashier is actually handed. Built from the total rather than
   * hard-coded, so a 90-shilling sale offers 100/200/500 and not 50.
   */
  const quickCash = useMemo(() => {
    if (method !== 'CASH') return [];
    const notes = [50, 100, 200, 500, 1000, 2000, 5000];
    const out: number[] = [];
    for (const n of notes) {
      if (n >= total && !out.includes(n)) out.push(n);
      if (out.length === 3) break;
    }
    // Round up to the next hundred as a fourth option when the total is awkward.
    const roundUp = Math.ceil(total / 100) * 100;
    if (roundUp > total && !out.includes(roundUp)) out.unshift(roundUp);
    return out.slice(0, 4).sort((a, b) => a - b);
  }, [total, method]);

  const press = (key: string) => {
    setError(null);
    if (key === 'del') return setEntry((e) => e.slice(0, -1));
    if (key === '.') return setEntry((e) => (e.includes('.') ? e : e === '' ? '0.' : e + '.'));
    setEntry((e) => {
      const next = e + key;
      // Two decimal places is all money has.
      if (/\.\d{3}/.test(next)) return e;
      return next.replace(/^0(?=\d)/, '');
    });
  };

  const submit = async () => {
    if (short) {
      setError('That does not cover the total');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const sale = await completeSale(
        [
          {
            method,
            // ⚠️ AMOUNT is what the sale was worth; TENDERED is what changed
            // hands. Recording the tendered figure as the amount would inflate
            // the day's takings by the change given.
            amount: total,
            tendered: method === 'CASH' ? tendered : undefined,
            reference: reference.trim() || undefined,
          },
        ],
        { customerPhone: phone.trim() || undefined }
      );
      onDone(sale);
    } catch (e: any) {
      setError(e?.message || 'The sale could not be completed');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--sp-bg)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-3 shrink-0">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl flex items-center justify-center sp-btn-ghost"
          aria-label="Back to the sale"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider sp-muted">Amount due</p>
          <p className="text-[26px] font-black leading-none sp-num">{money(total, currency)}</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-3">
        {/* How they are paying */}
        <div className="grid grid-cols-3 gap-2">
          {METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => { setMethod(m.id); setEntry(''); }}
              className={`sp-btn ${method === m.id ? '' : 'sp-btn-ghost'} flex-col gap-1 py-3`}
              style={{ minHeight: '4.25rem' }}
            >
              <m.icon size={18} />
              <span className="text-[11px] font-bold">{m.label}</span>
            </button>
          ))}
        </div>

        {method === 'CASH' ? (
          <>
            {/* What was handed over */}
            <div className="sp-card p-3.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider sp-muted">
                  Cash received
                </span>
                {/*
                  Grouped while typing, but ONLY the whole part, and the raw
                  tail is kept verbatim — reformatting "5000." to "5,000.00"
                  mid-keystroke would eat the decimal point the cashier just
                  pressed.
                */}
                <span className="text-[24px] font-black sp-num">
                  {entry === '' ? money(total, currency) : `${currency} ${groupWhileTyping(entry)}`}
                </span>
              </div>
              <div
                className="flex items-baseline justify-between mt-2.5 pt-2.5 border-t"
                style={{ borderColor: 'var(--sp-border)' }}
              >
                <span className="text-[13px] font-black uppercase tracking-wide">Change</span>
                <span
                  className={`text-[28px] font-black sp-num ${short ? 'sp-bad' : change > 0 ? 'sp-good' : ''}`}
                >
                  {short ? 'Short' : money(change, currency)}
                </span>
              </div>
            </div>

            {quickCash.length > 0 && (
              <div className="sp-rail">
                <button
                  onClick={() => setEntry('')}
                  className={`sp-chip ${entry === '' ? 'sp-chip-on' : ''}`}
                >
                  Exact
                </button>
                {quickCash.map((n) => (
                  <button
                    key={n}
                    onClick={() => setEntry(String(n))}
                    className={`sp-chip sp-num ${entry === String(n) ? 'sp-chip-on' : ''}`}
                  >
                    {n.toLocaleString()}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((k) => (
                <button key={k} onClick={() => press(k)} className="sp-key">
                  {k}
                </button>
              ))}
              <button onClick={() => press('del')} className="sp-key" aria-label="Delete">
                <Delete size={20} />
              </button>
            </div>
          </>
        ) : (
          <div className="sp-card p-3.5 space-y-2.5">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider sp-muted">
                {method === 'MPESA' ? 'M-Pesa code' : 'Card slip reference'}
              </span>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value.toUpperCase())}
                className="sp-input mt-1.5"
                placeholder={method === 'MPESA' ? 'e.g. SJ12AB34CD' : 'Slip number'}
                autoComplete="off"
              />
            </label>
            <p className="text-[11px] sp-muted">
              Recorded against the sale. The payment itself is taken on the
              {method === 'MPESA' ? ' till number' : ' card machine'} as usual.
            </p>
          </div>
        )}

        {/* Optional — a phone number is what makes a receipt findable later. */}
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wider sp-muted">
            Customer phone (optional)
          </span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="sp-input mt-1.5"
            placeholder="07…"
            inputMode="tel"
            autoComplete="off"
          />
        </label>

        {error && (
          <p className="text-[13px] font-bold sp-bad text-center" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* The commit. Pinned above the home indicator. */}
      <div
        className="shrink-0 px-3 pt-2.5 border-t"
        style={{
          borderColor: 'var(--sp-border)',
          background: 'var(--sp-surface)',
          paddingBottom: 'calc(0.75rem + var(--sp-safe-bottom))',
        }}
      >
        <button onClick={submit} disabled={busy || short} className="sp-btn w-full text-[15px]">
          {busy ? 'Completing…' : <><Check size={18} /> Complete sale</>}
        </button>
      </div>
    </div>
  );
};

export default PosTender;
