import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
    const nextIdx = currentIndex + 1;
    if (nextIdx >= activeTour.steps.length) { finish(); return; }
    const step = activeTour.steps[nextIdx];
    if (step.navigateTo && onNavigate) onNavigate(step.navigateTo, step.navigateParams);
    setCurrentIndex(nextIdx);
  }, [activeTour, currentIndex, finish, onNavigate]);

  const back = useCallback(() => {
    if (currentIndex === 0) return;
    const prevIdx = currentIndex - 1;
    const step = activeTour?.steps[prevIdx];
    if (step?.navigateTo && onNavigate) onNavigate(step.navigateTo, step.navigateParams);
    setCurrentIndex(prevIdx);
  }, [activeTour, currentIndex, onNavigate]);

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
