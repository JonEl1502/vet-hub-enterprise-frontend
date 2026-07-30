import React, { createContext, useContext } from 'react';

export type InjectService = (
  svc: { id: number; name: string; defaultPrice?: number | null },
  categoryName: string,
) => void;

interface Ctx {
  /** Add a service straight onto the visit. Undefined = visit is locked. */
  injectService?: InjectService;
  /** Service names already on the visit, lowercased — so a panel can say "on visit". */
  addedNames?: Set<string>;
  currency?: string;
}

const ServiceInjectContext = createContext<Ctx>({});

/**
 * Lets any panel inside a visit add a service without the drawer (user,
 * 2026-07-29), and without every intermediate component having to forward a
 * callback.
 *
 * ⚠️ Why a context and not a `StepProps` field: the wizard's prop plumbing
 * lives in `wizard/VisitWizard.tsx`, which another session (S4) had uncommitted
 * changes in when this was built. Staging that file would have swept their
 * in-flight work into this commit — the exact accident `SESSION_BOARD.md`
 * rule 2 exists to prevent. A provider on the VisitDetailView side reaches the
 * steps without touching the file in between. If the wizard is ever refactored,
 * folding this into `StepProps.injectService` (already declared) is fine.
 */
export const ServiceInjectProvider: React.FC<Ctx & { children: React.ReactNode }> = ({ children, ...value }) => (
  <ServiceInjectContext.Provider value={value}>{children}</ServiceInjectContext.Provider>
);

export const useServiceInject = () => useContext(ServiceInjectContext);

export default ServiceInjectContext;
