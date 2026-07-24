import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export interface TourStep {
  target: string;
  title: string;
  body: string;
  placement?: TourPlacement;
  navigateTo?: string;
  navigateParams?: Record<string, any>;
  waitMs?: number;
  optional?: boolean;
  // The target only appears AFTER the user does something on screen (e.g. picks
  // an owner/client, which renders the dependent form fields). The overlay turns
  // non-blocking and waits (long) for the target instead of auto-skipping, so the
  // user can interact; the tour advances once the field appears.
  awaitInteraction?: boolean;
}

export interface Tour {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
  steps: TourStep[];
  // Contextual tours (e.g. "Manage a client") walk through a single record page
  // and have no `navigateTo` — they can only run while that page, with a record
  // loaded, is on screen. List the view(s) the tour belongs to here. Tours with
  // no `requiresView` are global and can start from anywhere (their first step
  // navigates to the right module). When set, the menu only offers the tour on a
  // matching page and `startTour` refuses to start it elsewhere — otherwise the
  // overlay floats over a page that has none of its target elements.
  requiresView?: string[];
}

interface TourContextValue {
  tours: Tour[];
  activeTour: Tour | null;
  currentStep: TourStep | null;
  currentIndex: number;
  isActive: boolean;
  completedTours: string[];
  /** The view the app is currently showing — lets the menu tell which
   *  contextual tours can run from here. */
  currentView?: string;
  /** Whether a tour can be started from the current view (true for global
   *  tours, true for contextual tours only while on their page). */
  isTourAvailable: (tour: Tour) => boolean;
  startTour: (id: string) => void;
  /** Navigate to the list page a contextual tour lives on (visits / clients /
   *  patients) so the user can open a record and replay it — used when they
   *  tap a tour that isn't runnable from the current page. */
  goToTourHome: (tour: Tour) => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  finish: () => void;
  /** Advance past a step in the direction the user is travelling — used to
   *  auto-skip an `optional` step whose target isn't on screen. */
  autoSkip: () => void;
  isMenuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

const STORAGE_KEY = 'vethub_completed_tours';

const readCompleted = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeCompleted = (ids: string[]) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch {}
};

interface ProviderProps {
  tours: Tour[];
  onNavigate?: (view: string, params?: Record<string, any>) => void;
  /** The view the app is currently showing. Used to gate contextual tours. */
  currentView?: string;
  children: React.ReactNode;
}

export const TourProvider: React.FC<ProviderProps> = ({ tours, onNavigate, currentView, children }) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedTours, setCompletedTours] = useState<string[]>(() => readCompleted());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // Which way the user is travelling — lets us auto-skip a missing optional
  // step forwards (Next) or backwards (Back) instead of dead-ending on it.
  const directionRef = useRef<'forward' | 'back'>('forward');

  const activeTour = useMemo(() => tours.find(t => t.id === activeId) ?? null, [tours, activeId]);
  const currentStep = activeTour?.steps[currentIndex] ?? null;

  const markCompleted = useCallback((id: string) => {
    setCompletedTours(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      writeCompleted(next);
      return next;
    });
  }, []);

  // A global tour (no requiresView) can start anywhere; a contextual tour can
  // only start while its page is on screen — otherwise the overlay would float
  // over a page that has none of its target elements.
  const isTourAvailable = useCallback(
    (tour: Tour) => !tour.requiresView?.length || (!!currentView && tour.requiresView.includes(currentView)),
    [currentView],
  );

  const startTour = useCallback((id: string) => {
    const tour = tours.find(t => t.id === id);
    if (!tour) return;
    if (!isTourAvailable(tour)) return; // contextual tour, wrong page — don't float a dialog over nothing
    directionRef.current = 'forward';
    setIsMenuOpen(false);
    setActiveId(id);
    setCurrentIndex(0);
    const first = tour.steps[0];
    if (first?.navigateTo && onNavigate) onNavigate(first.navigateTo, first.navigateParams);
  }, [tours, onNavigate, isTourAvailable]);

  // Map a contextual tour's required page to the list view you reach it from.
  const TOUR_HOME: Record<string, string> = {
    'appointment-detail': 'appointments', // the Visits list
    'client-profile': 'clients',
    'pet-profile': 'patients',
  };
  const goToTourHome = useCallback((tour: Tour) => {
    const view = tour.requiresView?.map(v => TOUR_HOME[v]).find(Boolean);
    if (view && onNavigate) { setIsMenuOpen(false); onNavigate(view); }
  }, [onNavigate]);

  const finish = useCallback(() => {
    if (activeId) markCompleted(activeId);
    setActiveId(null);
    setCurrentIndex(0);
  }, [activeId, markCompleted]);

  const skip = useCallback(() => {
    setActiveId(null);
    setCurrentIndex(0);
  }, []);

  const next = useCallback(() => {
    if (!activeTour) return;
    directionRef.current = 'forward';
    const nextIdx = currentIndex + 1;
    if (nextIdx >= activeTour.steps.length) { finish(); return; }
    const step = activeTour.steps[nextIdx];
    if (step.navigateTo && onNavigate) onNavigate(step.navigateTo, step.navigateParams);
    setCurrentIndex(nextIdx);
  }, [activeTour, currentIndex, finish, onNavigate]);

  const back = useCallback(() => {
    if (currentIndex === 0) return;
    directionRef.current = 'back';
    const prevIdx = currentIndex - 1;
    const step = activeTour?.steps[prevIdx];
    if (step?.navigateTo && onNavigate) onNavigate(step.navigateTo, step.navigateParams);
    setCurrentIndex(prevIdx);
  }, [activeTour, currentIndex, onNavigate]);

  // Auto-skip a missing optional step. Travel the way the user was going; if
  // we're going backwards and hit the first step, fall back to going forward
  // so the tour never gets stuck.
  const autoSkip = useCallback(() => {
    if (directionRef.current === 'back' && currentIndex > 0) back();
    else next();
  }, [back, next, currentIndex]);

  useEffect(() => {
    if (!activeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeId, next, back, skip]);

  const value: TourContextValue = {
    tours,
    activeTour,
    currentStep,
    currentIndex,
    isActive: !!activeTour,
    completedTours,
    currentView,
    isTourAvailable,
    startTour,
    goToTourHome,
    next,
    back,
    skip,
    finish,
    autoSkip,
    isMenuOpen,
    openMenu: () => setIsMenuOpen(true),
    closeMenu: () => setIsMenuOpen(false),
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
};

export const useTour = (): TourContextValue => {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
};
