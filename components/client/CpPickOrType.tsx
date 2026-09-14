import React, { useEffect, useState } from 'react';

/**
 * Portal twin of the livestock module's `PickOrType` — a dropdown of the
 * sensible answers with "Other" that lets you type.
 *
 * User, 2026-09-14: *"breed for farm animals please to be dropdown, other to
 * allow typing."* The portal used a `<datalist>`, which types freely but which
 * Android and iOS render inconsistently — sometimes as a plain text box with no
 * hint that a list exists at all. An explicit select says what the answers are.
 *
 * ⚠️ THE LIST IS NEVER A CAGE, and a stored value outside it opens in free-text
 * mode rather than being silently dropped — the classic way a dropdown eats
 * data that was already there.
 */
const CpPickOrType: React.FC<{
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  emptyLabel?: string;
}> = ({ options, value, onChange, placeholder, emptyLabel = 'Not sure' }) => {
  const inList = (v: string) => options.some((o) => o.toLowerCase() === v.trim().toLowerCase());
  const [other, setOther] = useState(() => !!value && !inList(value));

  // The species changed: a Friesian on a flock of layers is no longer a listed
  // breed, so the field keeps what was typed instead of blanking it.
  useEffect(() => {
    if (value && !inList(value)) setOther(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.join('|')]);

  if (options.length === 0) {
    return (
      <input
        className="cp-input w-full"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div className="space-y-2">
      <select
        className="cp-input w-full"
        value={other ? '__other' : (inList(value) ? value : '')}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '__other') { setOther(true); onChange(''); return; }
          setOther(false);
          onChange(v);
        }}
      >
        <option value="">{emptyLabel}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value="__other">Other…</option>
      </select>
      {other && (
        <input
          className="cp-input w-full"
          autoFocus
          value={value}
          placeholder={placeholder ?? 'Type it'}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
};

export default CpPickOrType;
