import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowUpRight, Clock } from 'lucide-react';
import { usePlanAccess } from '../../../contexts/PlanAccessContext';
import { daysOverdue, planLabel } from '../../../services/entitlements';

/**
 * THE PAST-DUE REMINDER.
 *
 * "Reduce further if subscription is out and every page view to pop a modal to
 * remind user to pay" (user, 2026-09-12).
 *
 * It fires on every VIEW CHANGE, which is what was asked — but not over three
 * screens, and each exclusion is load-bearing rather than a softening:
 *
 *   EMERGENCY / TRIAGE — `emergency` is in `ALWAYS_VIEWS` on purpose: a locked
 *     clinic must still be able to handle a crashing animal. A payment nag in
 *     front of a vet mid-resuscitation is a patient-safety problem, not a
 *     collections tactic, and no invoice is worth it.
 *   BILLING — they are on the page that takes the money. Blocking it is
 *     self-defeating.
 *   SETTINGS — where the owner fixes a dead card.
 *
 * "Remind me later" suppresses it for 15 minutes rather than for the session:
 * a nag with no snooze gets dismissed reflexively and stops being read, and a
 * nag that is gone for a whole session is not a reminder. It is deliberately
 * NOT permanently dismissible.
 */

/** Views this must never cover. */
const NEVER_OVER = new Set(['emergency', 'triage', 'billing', 'settings', 'subscription-management']);

const SNOOZE_MS = 15 * 60 * 1000;
const SNOOZE_KEY = 'vethub.subLapsedSnoozeUntil';

interface Props {
  /** The view the app is on right now. */
  activeView: string;
  onGoToBilling: () => void;
}

const SubscriptionLapsedModal: React.FC<Props> = ({ activeView, onGoToBilling }) => {
  const { access } = usePlanAccess();
  const overdue = daysOverdue(access);
  const lapsed = overdue != null;

  const [snoozedUntil, setSnoozedUntil] = React.useState<number>(() => {
    try { return Number(localStorage.getItem(SNOOZE_KEY) || 0); } catch { return 0; }
  });
  // Re-shown on every view change — the ask — by keying "have I shown it for
  // THIS view" off the view itself.
  const [shownFor, setShownFor] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!lapsed || NEVER_OVER.has(activeView)) return;
    setShownFor(null); // a new view means a new showing
  }, [activeView, lapsed]);

  if (!lapsed) return null;
  if (NEVER_OVER.has(activeView)) return null;
  if (shownFor === activeView) return null;
  if (snoozedUntil > Date.now()) return null;

  const snooze = () => {
    const until = Date.now() + SNOOZE_MS;
    try { localStorage.setItem(SNOOZE_KEY, String(until)); } catch { /* private window */ }
    setSnoozedUntil(until);
    setShownFor(activeView);
  };

  const label = planLabel(access);
  const planName = access?.packageName || 'Your plan';

  return createPortal(
    // Portalled for the same reason every other modal here is: the nav is
    // `backdrop-blur`, which makes it a containing block for fixed children.
    <div className="fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md my-auto overflow-hidden">
        <div className="bg-amber-600 text-white px-5 py-4 flex items-center gap-2.5">
          <AlertTriangle size={18} className="shrink-0" />
          <div className="min-w-0">
            <p className="text-base font-black uppercase tracking-tight leading-tight">Subscription past due</p>
            <p className="text-[10px] text-white/75 font-bold uppercase tracking-wider">{label.text}</p>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm font-bold text-pine dark:text-zinc-100">
            {planName} ended{' '}
            {overdue === 0 ? 'today' : `${overdue} day${overdue === 1 ? '' : 's'} ago`}.
          </p>
          <p className="text-[12px] text-slate-500 dark:text-zinc-400 leading-relaxed">
            Parts of VetHubCore are switched off until it is renewed. Nothing has been deleted —
            your patients, records and history are exactly where you left them, and everything
            comes back the moment payment lands.
          </p>
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700">
            <Clock size={13} className="text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 leading-relaxed">
              Emergency stays open on every plan, paid or not. You will never be locked out of a
              patient who needs you now.
            </p>
          </div>
        </div>

        <div className="px-5 pb-5 flex items-center justify-end gap-2">
          <button
            onClick={snooze}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
          >
            Remind me later
          </button>
          <button
            onClick={() => { setShownFor(activeView); onGoToBilling(); }}
            className="px-4 py-2 rounded-xl bg-pine dark:bg-zinc-100 text-white dark:text-pine text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:opacity-90"
          >
            <ArrowUpRight size={13} /> Renew now
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SubscriptionLapsedModal;
