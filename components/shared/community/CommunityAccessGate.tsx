import React, { createContext, useContext } from 'react';
import { dialog } from '../../../services/utils/dialog';

/**
 * Community's 15-second preview (2026-09-18) let a non-subscriber sit and
 * read the timer down, but nothing stopped them liking, commenting or
 * following in the meantime — a real action reaching the server, not
 * something a countdown alone should wave through. Every write action in
 * Community now runs through `requireAccess()` first: an account with real
 * Community Access sails through silently, one without it gets an upgrade
 * dialog instead of the action, right there where they tried it — "Not now"
 * just dismisses and the preview countdown (a plain interval, untouched by
 * any of this) keeps running exactly as it was.
 */
interface CommunityAccessGateValue {
  hasAccess: boolean;
  /** Returns true if the action should proceed. False means it was blocked
   *  and an upgrade dialog is already on screen (or was dismissed). */
  requireAccess: () => boolean;
}

const CommunityAccessGateContext = createContext<CommunityAccessGateValue>({
  hasAccess: true,
  requireAccess: () => true,
});

export const CommunityAccessGateProvider: React.FC<{
  hasAccess: boolean;
  onGetAccess: () => void;
  children: React.ReactNode;
}> = ({ hasAccess, onGetAccess, children }) => {
  const requireAccess = () => {
    if (hasAccess) return true;
    dialog.confirm({
      title: 'Get Community Access',
      message: 'Liking, replying and following are part of Community Access. Reading stays free — this just needs the add-on to join in.',
      confirmLabel: 'Get Access',
      cancelLabel: 'Not now',
      variant: 'info',
    }).then((ok) => { if (ok) onGetAccess(); });
    return false;
  };
  return (
    <CommunityAccessGateContext.Provider value={{ hasAccess, requireAccess }}>
      {children}
    </CommunityAccessGateContext.Provider>
  );
};

export const useCommunityAccessGate = () => useContext(CommunityAccessGateContext);
