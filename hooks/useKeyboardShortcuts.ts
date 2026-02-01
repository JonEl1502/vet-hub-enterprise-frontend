import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean; // Command key on Mac
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

/**
 * Hook for registering keyboard shortcuts
 * @param options Configuration options
 */
export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Ctrl/Cmd+S even in inputs
        if (!(event.key === 's' && (event.ctrlKey || event.metaKey))) {
          return;
        }
      }

      for (const shortcut of shortcuts) {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrl ? event.ctrlKey : true;
        const metaMatches = shortcut.meta ? event.metaKey : true;
        const shiftMatches = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatches = shortcut.alt ? event.altKey : !event.altKey;

        // Check if modifier keys are required
        const ctrlOrMetaRequired = shortcut.ctrl || shortcut.meta;
        const hasCorrectModifier = ctrlOrMetaRequired
          ? event.ctrlKey || event.metaKey
          : !event.ctrlKey && !event.metaKey;

        if (
          keyMatches &&
          hasCorrectModifier &&
          shiftMatches &&
          altMatches
        ) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
}

/**
 * Get keyboard shortcut display string
 */
export function getShortcutDisplay(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  
  if (shortcut.ctrl || shortcut.meta) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (shortcut.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }
  
  parts.push(shortcut.key.toUpperCase());
  
  return parts.join(isMac ? '' : '+');
}

/**
 * Common keyboard shortcuts for appointment views
 */
export const commonShortcuts = {
  save: {
    key: 's',
    ctrl: true,
    meta: true,
    description: 'Save changes',
  },
  search: {
    key: 'k',
    ctrl: true,
    meta: true,
    description: 'Search/Filter',
  },
  escape: {
    key: 'Escape',
    description: 'Close modal/Cancel',
  },
  newAppointment: {
    key: 'n',
    description: 'New appointment',
  },
  help: {
    key: '?',
    shift: true,
    description: 'Show keyboard shortcuts',
  },
};

