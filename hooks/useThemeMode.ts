/**
 * Light / dark / system, shared with the clinic app.
 *
 * ⚠️ This deliberately reuses `App.tsx`'s existing contract rather than
 * inventing a second one: the key is `vethub-theme` and the switch is a `dark`
 * class on `<html>` (Tailwind is `darkMode: 'class'`). A separate mechanism
 * would give a user who is both a clinic owner and a portal client two
 * different themes on one machine.
 *
 * The one thing added here is an explicit **SYSTEM** state. `App.tsx` stores
 * only 'dark' | 'light' and treats a missing key as "follow the OS", which
 * works until the first toggle and then never follows the OS again. Storing
 * the word 'system' makes that reachable on purpose, and the media listener
 * below is what makes it live.
 */
import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

const KEY = 'vethub-theme';
const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

const read = (): ThemeMode => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' || v === 'system' ? v : 'system';
  } catch { return 'system'; }
};

const apply = (mode: ThemeMode) => {
  const dark = mode === 'dark' || (mode === 'system' && prefersDark());
  document.documentElement.classList.toggle('dark', dark);
};

export const useThemeMode = () => {
  const [mode, setModeState] = useState<ThemeMode>(read);

  useEffect(() => { apply(mode); }, [mode]);

  // Only meaningful in SYSTEM — but the listener is cheap and unconditional
  // registration avoids a stale closure when the mode changes.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (read() === 'system') apply('system'); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    try { localStorage.setItem(KEY, m); } catch { /* private mode — the class still applies */ }
    setModeState(m);
  }, []);

  return { mode, setMode, isDark: mode === 'dark' || (mode === 'system' && prefersDark()) };
};

export default useThemeMode;
