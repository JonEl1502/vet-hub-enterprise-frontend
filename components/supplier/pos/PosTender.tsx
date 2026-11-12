import React, { useMemo, useState } from 'react';
import { ArrowLeft, Banknote, Smartphone, CreditCard, Delete, Check, Phone, CircleCheck } from 'lucide-react';
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

const METHODS: { id: PosPaymentMethod; label: string; hint: string; icon: React.FC<any> }[] = [
  { id: 'CASH', label: 'Cash', hint: 'Notes and coins', icon: Banknote },
  { id: 'MPESA', label: 'M-Pesa', hint: 'Till or paybill', icon: Smartphone },
  { id: 'CARD', label: 'Card', hint: 'Card machine', icon: CreditCard },
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

  const lines = preview?.items.length ?? 0;
  const units = (preview?.items ?? []).reduce((n, i) => n + Number(i.quantity), 0);

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--sp-bg)' }}>
      {/* Header — 4rem, level with the till header beside it on a desk. */}
      <div
        className="flex items-center gap-3 px-3 shrink-0 border-b"
        style={{ minHeight: '4rem', borderColor: 'var(--sp-border)', background: 'var(--sp-surface)', paddingTop: 'var(--sp-safe-top)' }}
      >
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl flex items-center justify-center sp-btn-ghost"
          aria-label="Back to the sale"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <p className="text-[15px] font-black leading-tight">Take payment</p>
          <p className="text-[11px] font-semibold sp-muted">
            {units} item{units === 1 ? '' : 's'} · {lines} line{lines === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pt-3 pb-3 space-y-3">
        {/* The number the customer is paying — the hero of this screen. */}
        <div className="sp-due">
          <p className="text-[11px] font-black uppercase tracking-wider" style={{ opacity: 0.8 }}>Amount due</p>
          <p className="text-[32px] font-black leading-none sp-num mt-1.5">{money(total, currency)}</p>
        </div>

        {/* How they are paying */}
        <div>
          <p className="sp-tender-label">Paid by</p>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => {
              const on = method === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => { setMethod(m.id); setEntry(''); setError(null); }}
                  className={`sp-method ${on ? 'sp-method-on' : ''}`}
                  aria-pressed={on}
                >
                  {on && <CircleCheck size={15} className="sp-method-tick" />}
                  <span className="sp-method-icon"><m.icon size={19} /></span>
                  <span className="text-[13px] font-black leading-tight">{m.label}</span>
                  <span className="text-[10px] font-semibold sp-muted leading-tight">{m.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {method === 'CASH' ? (
          <>
            {/* What was handed over, and what goes back. */}
            <div className="sp-card overflow-hidden">
              <div className="flex items-baseline justify-between px-4 pt-3.5 pb-3">
                <span className="text-[12px] font-bold sp-muted">Cash received</span>
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
              <div className={`sp-change ${short ? 'sp-change-short' : change > 0 ? 'sp-change-give' : ''}`}>
                <span className="text-[12px] font-black uppercase tracking-wide">
                  {short ? 'Still to pay' : 'Change to give'}
                </span>
                <span className="text-[26px] font-black sp-num">
                  {short ? money(total - tendered, currency) : money(change, currency)}
                </span>
              </div>
            </div>

            {/* The notes a customer actually hands over. */}
            {quickCash.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => setEntry('')}
                  className={`sp-note ${entry === '' ? 'sp-note-on' : ''}`}
                >
                  Exact
                </button>
                {quickCash.slice(0, 3).map((n) => (
                  <button
                    key={n}
                    onClick={() => setEntry(String(n))}
                    className={`sp-note sp-num ${entry === String(n) ? 'sp-note-on' : ''}`}
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
          <div className="sp-card p-4 space-y-2.5">
            <label className="block">
              <span className="sp-tender-label">
                {method === 'MPESA' ? 'M-Pesa code' : 'Card slip number'}
              </span>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value.toUpperCase())}
                className="sp-input sp-input-big"
                placeholder={method === 'MPESA' ? 'e.g. SJ12AB34CD' : 'Slip number'}
                autoComplete="off"
                autoFocus
              />
            </label>
            <p className="text-[12px] sp-muted">
              Optional, but it is how you match this sale to the
              {method === 'MPESA' ? ' M-Pesa message' : ' card machine slip'} later. Take the
              money on the {method === 'MPESA' ? 'till number' : 'card machine'} as usual first.
            </p>
          </div>
        )}

        {/* Optional — a phone number is what makes a receipt findable later. */}
        <label className="block">
          <span className="sp-tender-label">Customer phone <span className="normal-case font-semibold">(optional)</span></span>
          <span className="relative block">
            <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--sp-muted)' }} />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="sp-input sp-input-icon"
              placeholder="07…"
              inputMode="tel"
              autoComplete="off"
            />
          </span>
        </label>

        {error && (
          <p className="text-[13px] font-bold sp-bad text-center" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* The commit. Pinned above the home indicator. */}
      <div
        className="shrink-0 px-3 pt-3 border-t"
        style={{
          borderColor: 'var(--sp-border)',
          background: 'var(--sp-surface)',
          paddingBottom: 'calc(0.75rem + var(--sp-safe-bottom))',
        }}
      >
        <button onClick={submit} disabled={busy || short} className="sp-btn sp-charge">
          {busy ? (
            <span className="mx-auto">Completing…</span>
          ) : (
            <>
              <span className="flex items-center gap-2"><Check size={19} strokeWidth={2.8} /> Complete sale</span>
              <span className="sp-num">{money(total, currency)}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default PosTender;
