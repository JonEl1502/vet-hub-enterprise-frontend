import { useEffect, useRef, useCallback, useState } from 'react';

interface UseAutoSaveOptions<T> {
  data: T;
  onSave: (data: T) => Promise<void>;
  delay?: number; // milliseconds
  enabled?: boolean;
}

interface UseAutoSaveReturn {
  isSaving: boolean;
  lastSaved: Date | null;
  error: Error | null;
  forceSave: () => Promise<void>;
}

/**
 * Hook for auto-saving data with debouncing
 * @param options Configuration options
 * @returns Auto-save state and controls
 */
export function useAutoSave<T>({
  data,
  onSave,
  delay = 2000,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousDataRef = useRef<T>(data);
  const isMountedRef = useRef(true);

  const save = useCallback(async () => {
    if (!enabled) return;

    setIsSaving(true);
    setError(null);

    try {
      await onSave(data);
      if (isMountedRef.current) {
        setLastSaved(new Date());
        previousDataRef.current = data;
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err as Error);
        console.error('Auto-save error:', err);
      }
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  }, [data, onSave, enabled]);

  const forceSave = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    await save();
  }, [save]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Check if data has changed
    const hasChanged = JSON.stringify(data) !== JSON.stringify(previousDataRef.current);
    
    if (!hasChanged) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for auto-save
    timeoutRef.current = setTimeout(() => {
      save();
    }, delay);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, delay, enabled, save]);

  return {
    isSaving,
    lastSaved,
    error,
    forceSave,
  };
}

/**
 * Hook for tracking unsaved changes
 */
export function useUnsavedChanges<T>(data: T, savedData: T): boolean {
  return JSON.stringify(data) !== JSON.stringify(savedData);
}

/**
 * Hook for warning user about unsaved changes before leaving
 */
export function useUnsavedChangesWarning(hasUnsavedChanges: boolean) {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);
}

