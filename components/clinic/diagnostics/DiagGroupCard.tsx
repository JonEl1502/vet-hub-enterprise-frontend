import React from 'react';
import { Clock, ExternalLink, Share2 } from 'lucide-react';
import { formatDate } from '../../../services/utils/dateFormatter';

/**
 * One card per patient/visit on the Laboratory and Imaging lists
 * (user, 2026-11-26).
 *
 * The services sit on one line, comma-separated, and each name opens its own
 * record. Under them, three counts: resulted, internal and pending. The card
 * has two actions only, Open and Share. Delete lives on the record page,
 * not on the list.
 */
export interface DiagGroupItem {
  id: string;
  label: string;
  done: boolean;          // resulted / completed
  internal: boolean;      // done in-house (not sent out)
  shared: boolean;        // has partner clinics on it
}

interface Props {
  pet: string;
  petMeta?: string | null;
  date?: string | null;
  items: DiagGroupItem[];
  incomingFrom?: string | null;
  onOpenItem: (id: string) => void;
  onShare: () => void;
}

const DiagGroupCard: React.FC<Props> = ({ pet, petMeta, date, items, incomingFrom, onOpenItem, onShare }) => {
  const resulted = items.filter(i => i.done).length;
  const internal = items.filter(i => i.internal).length;
  const pending = items.length - resulted;
  const anyShared = items.some(i => i.shared);
  // Open the first one still waiting — that is the one somebody needs to work on.
  const openTarget = (items.find(i => !i.done) || items[0])?.id;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
      <div className="min-w-0">
        <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">{pet}</p>
        {petMeta && <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wide truncate">{petMeta}</p>}
        {date && <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><Clock size={10} /> {formatDate(date)}</p>}
        {incomingFrom && <p className="text-[9px] font-black text-violet-600 dark:text-violet-400 mt-0.5">📥 From {incomingFrom}</p>}
      </div>

      <p className="text-[12px] font-bold text-slate-600 dark:text-zinc-300 leading-snug">
        {items.map((it, i) => (
          <React.Fragment key={it.id}>
            <button type="button" onClick={() => onOpenItem(it.id)} className="hover:text-seafoam hover:underline text-left">{it.label}</button>
            {i < items.length - 1 ? ', ' : ''}
          </React.Fragment>
        ))}
      </p>

      <div className="flex flex-wrap gap-1.5">
        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">{resulted} resulted</span>
        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">{internal} internal</span>
        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${pending > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500'}`}>{pending} pending</span>
      </div>

      <div className="flex items-center gap-2 mt-auto pt-1">
        <button type="button" onClick={() => openTarget && onOpenItem(openTarget)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl bg-seafoam text-white text-[10px] font-black uppercase tracking-widest hover:bg-pine transition-all">
          <ExternalLink size={12} /> Open
        </button>
        <button type="button" onClick={onShare} title="Share with partner clinics"
          className={`inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${anyShared ? 'border-seafoam text-seafoam' : 'border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-seafoam hover:text-seafoam'}`}>
          <Share2 size={12} /> Share
        </button>
      </div>
    </div>
  );
};

export default DiagGroupCard;
