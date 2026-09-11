import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * 298 — a crossfading animal backdrop for the CLIENT auth screens.
 *
 * User, 2026-09-11: *"for login and sign up ad bg carousel for cat dogs sheep
 * cows chicken etc"*. The portal is for pet owners AND farmers now, so the
 * imagery has to say so before a word is read — a page showing only cats and
 * dogs quietly tells a smallholder this is not for them.
 *
 * ⚠️ LIGHT, NOT DARK. The staff `AuthShell` runs the same idea over a deep
 * pine scrim, because staff land on a dense dark app. The client portal is the
 * warm sand one (`--cp-*`), and a dark full-bleed photo behind a soft cream
 * card reads as a different product. So the scrim here is a WARM WASH: the
 * photo carries the feeling, the sand palette still owns the page, and the card
 * keeps its contrast.
 *
 * ⚠️ EVERY IMAGE IS PROBED BEFORE IT IS SHOWN. These are third-party CDN URLs;
 * one that 404s, or a device that is offline, must degrade to the plain sand
 * background rather than flashing a broken slide behind a login form. Only
 * images that actually decoded make it into the rotation, and an empty result
 * renders nothing at all.
 */

/**
 * Species spread on purpose — companion animals AND livestock.
 *
 * The first six are the exact URLs the staff AuthShell has been serving since
 * it shipped, so they are known-good rather than guessed. `/auth-bg-horse.jpg`
 * is self-hosted (see AuthShell for its provenance and the licensing caveat —
 * it is Alamy stock we do not hold a licence for, which is a commercial
 * decision someone should close out).
 *
 * To widen the set, drop files in `public/` and add the paths here. Anything
 * that fails to load is dropped silently, so a half-finished set is safe to
 * commit.
 */
const CANDIDATES = [
  'https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1574158622682-e40e69881006?auto=format&fit=crop&w=1920&q=80',
  '/auth-bg-horse.jpg',
];

const SLIDE_MS = 7000;

const ClientAuthBackdrop: React.FC = () => {
  const [images, setImages] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  // Probe first, show second. See the header: a broken slide behind a login
  // form is worse than no photo at all.
  useEffect(() => {
    let alive = true;
    Promise.all(
      CANDIDATES.map(
        (src) =>
          new Promise<string | null>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(src);
            img.onerror = () => resolve(null);
            img.src = src;
          }),
      ),
    ).then((results) => {
      if (alive) setImages(results.filter((s): s is string => !!s));
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (images.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [images.length]);

  if (images.length === 0) return null;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
      <AnimatePresence>
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 1.6, ease: 'easeInOut' }, scale: { duration: 8, ease: 'linear' } }}
          className="absolute inset-0"
          style={{
            backgroundImage: `url("${images[index]}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      </AnimatePresence>

      {/* The warm wash. Heavy enough that the cream card keeps its contrast on
          a bright photo, light enough that the animal is still legible. */}
      <div className="absolute inset-0 bg-[#faf7f2]/82 backdrop-blur-[2px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#faf7f2]/70 via-[#faf7f2]/40 to-[#faf7f2]/90" />
    </div>
  );
};

export default ClientAuthBackdrop;
