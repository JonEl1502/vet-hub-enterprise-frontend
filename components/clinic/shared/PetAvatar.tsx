import React, { useState } from 'react';

/**
 * Pet avatar — the pet's REAL profile photo wherever one exists, falling back
 * to the species emoji chip otherwise (user, 2026-08-01: "the patient
 * avatar/profile pic is very important").
 *
 * Accepts both the full store Pet (avatar — always a URL, but dicebear bot
 * placeholders don't count as real photos) and the visit's embedded pet
 * (avatarUrl) — the latter matters on CLINICAL_TRANSFER visits, where the
 * shared patient is NOT in this clinic's pets store.
 */
export interface PetAvatarSource {
  name?: string | null;
  species?: string | null;
  avatar?: string | null;        // store Pet: real avatarUrl or dicebear fallback
  avatarUrl?: string | null;     // embedded/visit pet: raw column value
  passportPhotoUrl?: string | null;
}

const SPECIES_EMOJI: Record<string, string> = {
  dog: '🐶', cat: '🐱', bird: '🐦', rabbit: '🐰', horse: '🐴', cattle: '🐮',
  cow: '🐮', goat: '🐐', sheep: '🐑', pig: '🐷', reptile: '🦎', snake: '🐍',
  fish: '🐟', hamster: '🐹', 'guinea pig': '🐹', lion: '🦁',
};

export const petEmoji = (species?: string | null): string => {
  const s = (species || '').toLowerCase();
  return SPECIES_EMOJI[s] || Object.entries(SPECIES_EMOJI).find(([k]) => s.includes(k))?.[1] || '🐾';
};

/** A real uploaded photo — never the dicebear placeholder. */
export const petPhotoUrl = (pet?: PetAvatarSource | null): string | null => {
  if (!pet) return null;
  const candidates = [pet.avatarUrl, pet.avatar, pet.passportPhotoUrl];
  for (const c of candidates) {
    if (c && /^https?:\/\//.test(c) && !c.includes('dicebear')) return c;
  }
  return null;
};

const PetAvatar: React.FC<{
  pet?: PetAvatarSource | null;
  /** Extra source merged in (e.g. store pet + visit-embedded pet). */
  fallbackPet?: PetAvatarSource | null;
  size?: number;                  // px, default 40
  rounded?: string;               // tailwind rounding, default rounded-xl
  className?: string;
}> = ({ pet, fallbackPet, size = 40, rounded = 'rounded-xl', className = '' }) => {
  // Global +40% (user, 2026-08-02: "avatars are still small") — applied here so
  // every call site grows together; `size` stays the caller's logical size.
  const px = Math.round(size * 1.4);
  const [broken, setBroken] = useState(false);
  const src = petPhotoUrl(pet) || petPhotoUrl(fallbackPet);
  const species = pet?.species || fallbackPet?.species;
  const name = pet?.name || fallbackPet?.name || 'Patient';
  const isDog = (species || '').toLowerCase().includes('dog');
  const box = `flex items-center justify-center shrink-0 overflow-hidden shadow-sm ${rounded} ${className}`;

  if (src && !broken) {
    return (
      <img
        src={src} alt={name} title={name} loading="lazy"
        onError={() => setBroken(true)}
        style={{ width: px, height: px }}
        className={`${box} object-cover border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900`}
      />
    );
  }
  return (
    <div
      title={name}
      style={{ width: px, height: px, fontSize: Math.round(px * 0.5) }}
      className={`${box} ${isDog ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30' : 'bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/30'}`}
    >
      {petEmoji(species)}
    </div>
  );
};

export default PetAvatar;
