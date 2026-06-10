import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// Full-bleed pet photos sourced from Unsplash's CDN. Swap any URL for a
// licensed asset by editing this list. Shared by every auth page so the
// background stays consistent as the user moves between login, forgot,
// OTP, and reset flows.
const PET_IMAGES = [
  'https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=1920&q=80',
  'https://images.unsplash.com/photo-1574158622682-e40e69881006?auto=format&fit=crop&w=1920&q=80',
];

const SLIDE_MS = 6000;

interface AuthShellProps {
  children: React.ReactNode;
}

const AuthShell: React.FC<AuthShellProps> = ({ children }) => {
  const [index, setIndex] = useState(0);

  // Preload all bg images so each crossfade swaps in instantly.
  useEffect(() => {
    PET_IMAGES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i + 1) % PET_IMAGES.length),
      SLIDE_MS,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0d2a27]">
      {/* Crossfading pet photos — each layer fades in over the previous */}
      <AnimatePresence>
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 1.4, ease: 'easeInOut' }, scale: { duration: 7, ease: 'linear' } }}
          className="absolute inset-0"
          style={{
            backgroundImage: `url("${PET_IMAGES[index]}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      </AnimatePresence>

      {/* Dark legibility overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0d2a27]/85 via-[#144E35]/65 to-[#0d2a27]/80 pointer-events-none" />
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />

      {/* Auth card centered on top */}
      <div className="relative h-full w-full flex items-center justify-center px-4 py-10 overflow-y-auto">
        <div className="w-full max-w-[440px]">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthShell;
