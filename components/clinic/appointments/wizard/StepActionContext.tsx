import React from 'react';

/**
 * Lets a wizard STEP contribute a button to the wizard's fixed bottom bar.
 *
 * The grooming report's "Save report" sat at the bottom of its own card, far
 * above the real action bar, so the screen had two competing "finish" affordances
 * and the save was easy to miss (user, 2026-08-03: "move the Save report to the
 * bottom bar"). A step registers its action; the shell renders it beside
 * Done → next.
 *
 * Registration is keyed so a step replacing its own action never duplicates it,
 * and unmounting clears it — the bar must never keep a button belonging to a
 * step you have navigated away from.
 */

export interface StepAction {
  label: string;
  onClick: () => void;
  busy?: boolean;
  /** Rendered after the button — e.g. "Saved ✓". */
  note?: string;
  disabled?: boolean;
}

interface Ctx {
  action: StepAction | null;
  setAction: (key: string, action: StepAction | null) => void;
}

const StepActionContext = React.createContext<Ctx>({ action: null, setAction: () => {} });

export const StepActionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [entry, setEntry] = React.useState<{ key: string; action: StepAction } | null>(null);
  const setAction = React.useCallback((key: string, action: StepAction | null) => {
    setEntry(prev => {
      if (action) return { key, action };
      // Only the owner may clear it — a late unmount must not wipe the action
      // a newly-mounted step just registered.
      return prev && prev.key !== key ? prev : null;
    });
  }, []);
  const value = React.useMemo(() => ({ action: entry?.action ?? null, setAction }), [entry, setAction]);
  return <StepActionContext.Provider value={value}>{children}</StepActionContext.Provider>;
};

export const useStepActionSlot = (): StepAction | null => React.useContext(StepActionContext).action;

/** Register this step's bottom-bar action. Cleared automatically on unmount. */
export const useRegisterStepAction = (key: string, action: StepAction | null) => {
  const { setAction } = React.useContext(StepActionContext);
  const label = action?.label; const busy = action?.busy; const note = action?.note; const disabled = action?.disabled;
  // Depend on the VALUES, not the object — callers build a fresh object each
  // render and an identity check would loop forever.
  React.useEffect(() => {
    setAction(key, action);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, label, busy, note, disabled]);
  React.useEffect(() => () => setAction(key, null), [key, setAction]);
};

export default StepActionContext;
