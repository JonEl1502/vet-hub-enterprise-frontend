import { useEffect, useRef, useState } from 'react';

/**
 * Remember where each screen was scrolled to, and put the user back there.
 *
 * Opening a client from page 7 and pressing Back used to land at the top of
 * page 1 — the list is remounted, so both the scroll position and the page
 * were simply gone. Losing your place after every single record is what makes
 * working through a long list miserable.
 *
 * Scroll lives HERE rather than in the nav stack because it changes on every
 * wheel tick: routing it through React state would re-render the whole app
 * while you scroll. A module-level Map is per-session, per-key, and free.
 *
 * Keyed by screen identity (view + the params that decide WHAT is shown), so
 * two different clients' profiles do not inherit each other's offset.
 */
const positions = new Map<string, number>();

/** Forget a screen's position — call when a filter/search changes what is listed. */
export function forgetScrollPosition(key: string) {
  positions.delete(key);
}

export function useScrollMemory(key: string, ready: boolean = true) {
  const restored = useRef(false);

  useEffect(() => {
    restored.current = false;
    if (!ready) return;

    const saved = positions.get(key);
    if (saved != null && saved > 0) {
      // Two frames: the first lets the list paint at its real height, the
      // second scrolls once the page is actually tall enough to accept it.
      // Restoring in the same tick silently clamps to 0 on a short page.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: saved, behavior: 'auto' });
          restored.current = true;
        });
      });
    } else {
      restored.current = true;
    }

    let raf = 0;
    const onScroll = () => {
      // Ignore scroll events fired before the restore lands, or the act of
      // restoring records 0 over the position we are trying to return to.
      if (!restored.current) return;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        positions.set(key, window.scrollY);
        raf = 0;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (restored.current) positions.set(key, window.scrollY);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [key, ready]);
}

export default useScrollMemory;

/**
 * A piece of list state (which page you were on) that survives leaving the
 * screen and coming back.
 *
 * Same reasoning as the scroll offset, and it has to be the same lifetime:
 * restoring the position of page 7 while the list rebuilt itself at page 1
 * would drop the user into the wrong records. Session-scoped on purpose — a
 * remembered page is a convenience, not something to persist across reloads
 * where the underlying list may have changed entirely.
 */
const listState = new Map<string, unknown>();

export function useRememberedState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() =>
    listState.has(key) ? (listState.get(key) as T) : initial);
  const set = (v: T) => { listState.set(key, v); setValue(v); };
  return [value, set];
}

/** Drop remembered list state — call when a filter changes what is listed. */
export function forgetRememberedState(key: string) {
  listState.delete(key);
}
