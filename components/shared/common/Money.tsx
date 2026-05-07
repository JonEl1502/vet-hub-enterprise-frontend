/**
 * <Money> — canonical currency-aware amount display.
 *
 * Renders an amount in the *target* currency (defaulting to the active
 * clinic's currency) with an optional small annotation showing the
 * original currency when they differ. Uses the FxContext rates table for
 * synchronous conversion — no network calls per render.
 *
 * Usage:
 *   <Money amount={txn.amount} currency={txn.currency} />
 *   <Money amount={250} currency="USD" target="KES" />
 *   <Money amount={250} currency="USD" target="KES" inline /> // single line
 *   <Money amount={250} currency="USD" target="KES" hideOriginal />
 *
 * If conversion isn't possible (unknown currency, rates unloaded) the
 * original amount is shown unchanged — never blank, never NaN.
 */

import React from 'react';
import { useFx } from '../../../contexts/FxContext';
import { useClinic } from '../../../contexts/ClinicContext';

interface MoneyProps {
  amount: number;
  /** Currency the `amount` is denominated in (e.g. 'KES', 'USD'). Required. */
  currency: string;
  /** Currency to display in. Defaults to the active clinic's currency. */
  target?: string;
  /** When true, render primary + original on a single line instead of two-line. */
  inline?: boolean;
  /** When true, never show the original-currency annotation even if currencies differ. */
  hideOriginal?: boolean;
  /** Optional extra className applied to the wrapping element. */
  className?: string;
  /** Override the primary amount's text class (size/weight/color). */
  primaryClassName?: string;
  /** Override the secondary annotation text class. */
  secondaryClassName?: string;
  /** Show currency code instead of symbol (e.g. 'KES 1,250' vs 'KSh 1,250'). */
  showCode?: boolean;
}

/** Currency code → symbol mapping for the codes we commonly see. */
const SYMBOLS: Record<string, string> = {
  KES: 'KSh',
  USD: '$',
  EUR: '€',
  GBP: '£',
  ZAR: 'R',
  UGX: 'USh',
  TZS: 'TSh',
  RWF: 'FRw',
  NGN: '₦',
  GHS: 'GH₵',
  INR: '₹',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥',
  CNY: '¥',
};

function symbolFor(code: string, showCode?: boolean): string {
  const c = (code || '').toUpperCase();
  if (showCode) return `${c} `;
  const sym = SYMBOLS[c];
  return sym ? `${sym} ` : `${c} `;
}

/** Format a number with thousands separators and 2 dp (or 0 dp if integer). */
function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  // Whole numbers render without decimals; fractional amounts always 2dp.
  const isWhole = Math.abs(n - Math.round(n)) < 0.005;
  const opts: Intl.NumberFormatOptions = abs >= 1000 || isWhole
    ? { minimumFractionDigits: 0, maximumFractionDigits: isWhole ? 0 : 2 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return new Intl.NumberFormat('en-US', opts).format(n);
}

/** Build the primary display string: '<symbol> <number>'. */
function formatAmount(amount: number, code: string, showCode?: boolean): string {
  return `${symbolFor(code, showCode)}${formatNumber(amount)}`;
}

const Money: React.FC<MoneyProps> = ({
  amount,
  currency,
  target,
  inline = false,
  hideOriginal = false,
  className = '',
  primaryClassName = '',
  secondaryClassName = '',
  showCode = false,
}) => {
  const { convert } = useFx();
  const { selectedClinics } = useClinic();
  // Resolve the display target. Caller can force one (e.g. a supplier page
  // overrides to supplier currency); otherwise we default to the active
  // clinic's currency. With multiple clinics selected we use the first one's
  // currency as the display default — admin pages that want a different
  // behavior should pass `target` explicitly.
  const activeClinicCurrency = selectedClinics?.[0]?.currency || undefined;
  const targetCurrency = (target || activeClinicCurrency || currency).toUpperCase();
  const sourceCurrency = (currency || '').toUpperCase();

  const sameCurrency = !sourceCurrency || sourceCurrency === targetCurrency;
  const converted = sameCurrency ? amount : convert(amount, sourceCurrency, targetCurrency);
  // When conversion isn't possible, fall back to displaying the original
  // unchanged — better than showing nothing or a wrong number.
  const conversionFailed = converted === null;
  const primaryAmount = conversionFailed ? amount : (converted as number);
  const primaryCurrency = conversionFailed ? sourceCurrency : targetCurrency;

  const primary = formatAmount(primaryAmount, primaryCurrency, showCode);
  const showAnnotation = !hideOriginal
    && !sameCurrency
    && !conversionFailed
    && sourceCurrency
    && sourceCurrency !== primaryCurrency;
  const annotation = showAnnotation
    ? `${formatAmount(amount, sourceCurrency, true)} original`
    : null;

  if (!annotation) {
    return <span className={`${primaryClassName} ${className}`.trim()}>{primary}</span>;
  }

  if (inline) {
    return (
      <span className={`inline-flex items-baseline gap-1.5 ${className}`.trim()}>
        <span className={primaryClassName}>{primary}</span>
        <span className={`text-[10px] font-medium text-slate-400 dark:text-zinc-500 ${secondaryClassName}`.trim()}>
          · {annotation}
        </span>
      </span>
    );
  }

  return (
    <span className={`inline-flex flex-col items-start leading-tight ${className}`.trim()}>
      <span className={primaryClassName}>{primary}</span>
      <span className={`text-[9px] font-medium text-slate-400 dark:text-zinc-500 mt-0.5 ${secondaryClassName}`.trim()}>
        {annotation}
      </span>
    </span>
  );
};

export default Money;
