import React, { useCallback, useEffect, useState } from 'react';
import { Siren, ChevronRight } from 'lucide-react';
import { triageAPI } from '../../../services';
import { TRIAGE_CHANGED_EVENT } from './triageEvents';

/**
 * AMBER ALERT — clinic-wide, on every page, while any patient is still in
 * emergency triage.
 *
 * The emergency board is a page you have to be looking at. A patient mid-triage
 * is the one thing in the building that shouldn't wait for someone to navigate
 * there, so this rides above the whole app until the last one is stabilised and
 * has moved into the normal clinical workflow.
 *
 * "Still in emergency" = a triage record with status IN_PROGRESS. `scope:'board'`
 * is exactly that filter server-side (`triage.service.list` → `where.status =
 * 'IN_PROGRESS'`), so a record that reaches STABILIZED drops out on the next
 * poll and the bar disappears on its own.
 */

const POLL_MS = 45_000;

const EmergencyAlertBar: React.FC<{ onOpen?: () => void; onOpenVisit?: (appointmentId: number) => void }> = ({ onOpen, onOpenVisit }) => {
  const [rows, setRows] = useState<Array<{ id: string; petName: string; appointmentId: string | null }>>([]);

  const load = useCallback(async () => {
    try {
      const res = await triageAPI.list({ scope: 'board' } as any);
      if (res.success && res.data?.records) {
        setRows(res.data.records
          .filter((r: any) => r.status === 'IN_PROGRESS')
          .map((r: any) => ({ id: r.id, petName: r.pet?.name || 'Patient', appointmentId: r.appointmentId ?? null })));
      }
    } catch {
      // Best-effort: a failed poll must never break the page it sits on. The
      // bar simply keeps its last known state.
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    // Coming back to the tab is the moment a stale count matters most.
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    // Stabilising a patient must clear the bar AT ONCE — waiting out the poll
    // meant the alert outlived the emergency, which is how an alert stops being
    // believed. The interval stays as the backstop for other tabs / other staff.
    window.addEventListener(TRIAGE_CHANGED_EVENT, load);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener(TRIAGE_CHANGED_EVENT, load);
    };
  }, [load]);

  if (rows.length === 0) return null;

  const names = rows.map(r => r.petName).slice(0, 3).join(', ');
  const more = rows.length > 3 ? ` +${rows.length - 3} more` : '';
  const single = rows.length === 1 ? rows[0] : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-40 bg-amber-500 text-amber-950 border-b-2 border-amber-600 shadow-md"
    >
      <button
        type="button"
        onClick={() => {
          // One patient with a visit → straight to the work. Otherwise the board.
          if (single?.appointmentId && onOpenVisit) onOpenVisit(Number(single.appointmentId));
          else onOpen?.();
        }}
        className="w-full flex items-center gap-2 px-3 sm:px-4 py-2 text-left hover:bg-amber-400 transition-colors"
      >
        {/* Pulses so it reads as live, not as a dismissed notice. */}
        <span className="relative flex items-center shrink-0">
          <Siren size={15} className="animate-pulse" />
        </span>
        <span className="min-w-0 flex-1 text-[10px] sm:text-[11px] font-black uppercase tracking-widest truncate">
          Amber alert · {rows.length} patient{rows.length === 1 ? '' : 's'} in emergency triage
          <span className="hidden sm:inline font-bold normal-case tracking-normal"> — {names}{more}</span>
        </span>
        <span className="hidden sm:flex items-center gap-1 shrink-0 text-[9px] font-black uppercase tracking-widest">
          {single?.appointmentId ? 'Open visit' : 'Open board'} <ChevronRight size={12} />
        </span>
      </button>
    </div>
  );
};

export default EmergencyAlertBar;
