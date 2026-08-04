import React from 'react';

/**
 * Lets a record PANEL contribute buttons to its page's fixed `RecordActionBar`.
 *
 * Same problem the wizard solved with `StepActionContext`, one level up: a
 * panel owns the state and the handler ("save this report", "check out"), but
 * the bar that should show them belongs to the PAGE. Without this the buttons
 * stay stranded in the middle of a long scroll while the real action bar sits
 * pinned at the bottom — two competing "finish" affordances, and the one people
 * actually reach for is the wrong one (user, 2026-08-04: "move save n cheouts
 * below too. in other pgs too").
 *
 * Differs from `StepActionContext` in ONE way that matters: this holds a LIST,
 * keyed by owner, because a record page routinely has more than one terminal
 * action (Save report AND Checkout). The wizard's slot deliberately holds one.
 *
 * Order is registration order, so a panel registering [save, checkout] gets
 * them in that order regardless of render timing.
 */

export interface RecordAction {
  key: string;
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ size?: number | string; className?: string }>;
  /** The one filled button. At most one should set this. */
  primary?: boolean;
  busy?: boolean;
  disabled?: boolean;
  /** Rendered beside the button — e.g. "Saved ✓". */
  note?: string;
}

interface Ctx {
  actions: RecordAction[];
  setActions: (key: string, actions: RecordAction[] | null) => void;
  /** True when a page is actually providing a bar to render into. */
  present: boolean;
}

const RecordActionContext = React.createContext<Ctx>({ actions: [], setActions: () => {}, present: false });

export const RecordActionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [entries, setEntries] = React.useState<{ key: string; actions: RecordAction[] }[]>([]);

  const setActions = React.useCallback((key: string, actions: RecordAction[] | null) => {
    setEntries(prev => {
      const without = prev.filter(e => e.key !== key);
      if (!actions || actions.length === 0) return without;
      // Keep registration order stable: replace in place if already present,
      // otherwise append. Re-registering must not make a button jump.
      const at = prev.findIndex(e => e.key === key);
      if (at === -1) return [...without, { key, actions }];
      const next = [...prev];
      next[at] = { key, actions };
      return next;
    });
  }, []);

  const actions = React.useMemo(() => entries.flatMap(e => e.actions), [entries]);
  const value = React.useMemo(() => ({ actions, setActions, present: true }), [actions, setActions]);
  return <RecordActionContext.Provider value={value}>{children}</RecordActionContext.Provider>;
};

/** What the page renders into its `RecordActionBar`. */
export const useRecordActionSlot = (): RecordAction[] => React.useContext(RecordActionContext).actions;

/** Is a bar available? Panels use this to decide whether to keep buttons inline. */
export const useHasRecordActionBar = (): boolean => React.useContext(RecordActionContext).present;

/**
 * Register this panel's bar actions. Cleared on unmount.
 *
 * Depends on the VALUES, not the array identity — callers build a fresh array
 * every render, so an identity check would re-register forever.
 */
export const useRegisterRecordActions = (key: string, actions: RecordAction[] | null) => {
  const { setActions } = React.useContext(RecordActionContext);
  const sig = JSON.stringify(
    (actions ?? []).map(a => [a.key, a.label, a.primary, a.busy, a.disabled, a.note]),
  );
  React.useEffect(() => {
    setActions(key, actions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, sig]);
  React.useEffect(() => () => setActions(key, null), [key, setActions]);
};

export default RecordActionContext;
