import React, { useMemo } from 'react';
import { useClinic } from '../../../contexts/ClinicContext';
import { COUNTRIES } from '../../../utils/countries';

interface Props {
  value: string;
  onChange: (next: string) => void;
  /**
   * The currency code (e.g. "KES", "USD"). When undefined the active clinic's
   * currency is used as the displayed default — the form should still capture
   * an explicit value via `onCurrencyChange` when the user submits, otherwise
   * the active clinic's currency is what gets persisted.
   */
  currency?: string;
  onCurrencyChange?: (next: string) => void;
  /** Hide the currency selector and only show the active clinic's currency
   *  as a non-interactive label. Useful for fields that must lock to org. */
  lockCurrency?: boolean;
  placeholder?: string;
  min?: number;
  step?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}

/**
 * Money entry control: number input on the left, currency selector on the
 * right. Currency defaults to the active clinic's currency; the user can
 * override it (unless `lockCurrency` is true). Use this everywhere money is
 * entered so the persisted record always carries an explicit currency.
 */
const CurrencyAmountInput: React.FC<Props> = ({
  value, onChange, currency, onCurrencyChange,
  lockCurrency = false, placeholder = '0.00', min = 0, step = '0.01',
  disabled = false, className = '', inputClassName = '',
}) => {
  const { selectedClinics } = useClinic();
  const clinicCurrency = selectedClinics?.[0]?.currency || 'KES';
  const effectiveCurrency = (currency || clinicCurrency).toUpperCase();

  const currencies = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ code: string; label: string }> = [];
    // Always include the effective currency first so it's never missing
    // from the dropdown (covers exotic codes the country list doesn't have).
    seen.add(effectiveCurrency);
    list.push({ code: effectiveCurrency, label: effectiveCurrency });
    for (const c of COUNTRIES) {
      const code = c.currency?.toUpperCase();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      list.push({ code, label: code });
    }
    return list.sort((a, b) => a.code.localeCompare(b.code));
  }, [effectiveCurrency]);

  return (
    <div className={`flex items-stretch rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 focus-within:ring-2 focus-within:ring-seafoam/40 overflow-hidden ${className}`}>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`flex-1 min-w-0 px-3 py-2 text-xs font-semibold text-pine dark:text-zinc-100 bg-transparent outline-none ${inputClassName}`}
      />
      {lockCurrency || !onCurrencyChange ? (
        <span className="px-3 flex items-center text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest border-l border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50">
          {effectiveCurrency}
        </span>
      ) : (
        <select
          value={effectiveCurrency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          disabled={disabled}
          className="px-2 py-2 text-[10px] font-black text-pine dark:text-zinc-100 uppercase tracking-widest bg-slate-50 dark:bg-zinc-800/50 border-l border-slate-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-seafoam/40 cursor-pointer"
        >
          {currencies.map(c => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      )}
    </div>
  );
};

export default CurrencyAmountInput;
