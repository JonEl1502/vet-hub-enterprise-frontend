import React from 'react';
import { Users, Phone, Mail } from 'lucide-react';

/**
 * The owner, on a patient card: name, phone, email.
 *
 * A card that names an animal and not the person to ring is half a card — the
 * ward and kennel lists are worked by people who need to REACH the owner, and
 * hunting through the client record for a number is the step this removes
 * (user, 2026-08-24).
 *
 * ⚠️ SPANS, NOT LINKS, on purpose. Every list card here is a real `<button>`,
 * and an `<a>` inside a `<button>` is invalid HTML — the parser hoists it out
 * and the card's markup breaks. The values are selectable and carry a title,
 * which is as far as this can go inside a button. Use `tel:` / `mailto:`
 * anchors only where the card is a div (the patients grid does exactly that).
 */
export interface OwnerLike {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

const OwnerContact: React.FC<{
  owner?: OwnerLike | null;
  /** Shown when there is no owner on record — an orphaned patient. */
  fallback?: string;
  className?: string;
}> = ({ owner, fallback = 'No owner on record', className = '' }) => {
  const name = owner?.name?.trim();
  const phone = owner?.phone?.trim();
  const email = owner?.email?.trim();

  return (
    <div className={`space-y-0.5 ${className}`}>
      <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-zinc-400">
        <Users size={10} className="text-slate-300 dark:text-zinc-600 shrink-0" />
        <span className="truncate">{name || fallback}</span>
      </span>
      {phone && (
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 dark:text-zinc-500" title={phone}>
          <Phone size={10} className="text-slate-300 dark:text-zinc-600 shrink-0" />
          <span className="truncate">{phone}</span>
        </span>
      )}
      {email && (
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 dark:text-zinc-500" title={email}>
          <Mail size={10} className="text-slate-300 dark:text-zinc-600 shrink-0" />
          <span className="truncate">{email}</span>
        </span>
      )}
    </div>
  );
};

export default OwnerContact;
