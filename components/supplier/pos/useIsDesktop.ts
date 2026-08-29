import { useEffect, useState } from 'react';

/**
 * Is this a desk, or a hand?
 *
 * ⚠️ A JS breakpoint, not a CSS one, and deliberately. The two layouts do not
 * merely LOOK different — they place the tender step somewhere structurally
 * different (a full-screen takeover on a phone, the right-hand rail on a desk).
 * That is a decision about which React tree renders, and `hidden md:flex` cannot
 * express it: rendering both and hiding one would mount the keypad twice and
 * let a stray click land on the copy nobody can see.
 *
 * ⚠️ 1024 (`lg`), NOT 768 (`md`). A 768px tablet held at a counter IS a
 * handheld till — it wants the touch layout, and the desk layout's 384px cart
 * rail would eat half its screen. Everything in the POS CSS that changes with
 * layout uses this same 1024 line; if you move it, move those too.
 */
const QUERY = '(min-width: 1024px)';

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    // Re-read on mount: the first render may have guessed before layout settled.
    setIsDesktop(mq.matches);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}
