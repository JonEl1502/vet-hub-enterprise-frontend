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
}

interface TourContextValue {
  tours: Tour[];
  activeTour: Tour | null;
  currentStep: TourStep | null;
  currentIndex: number;
  isActive: boolean;
  completedTours: string[];
  startTour: (id: string) => void;
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
  children: React.ReactNode;
}

export const TourProvider: React.FC<ProviderProps> = ({ tours, onNavigate, children }) => {
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

  const startTour = useCallback((id: string) => {
    const tour = tours.find(t => t.id === id);
    if (!tour) return;
    directionRef.current = 'forward';
    setIsMenuOpen(false);
    setActiveId(id);
    setCurrentIndex(0);
    const first = tour.steps[0];
    if (first?.navigateTo && onNavigate) onNavigate(first.navigateTo, first.navigateParams);
  }, [tours, onNavigate]);

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
    startTour,
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
