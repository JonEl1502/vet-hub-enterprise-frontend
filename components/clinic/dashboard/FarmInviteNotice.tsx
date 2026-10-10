import React, { useCallback, useEffect, useState } from 'react';
import { Sprout, ArrowRight } from 'lucide-react';
import { get } from '../../../services/api/client';
import { ApiResponse } from '../../../services/api/types';

interface Invite { id: string; farmName: string; county: string | null; ownerName: string | null; askedAt: string }

/**
 * Farmers who asked THIS clinic to join Farms (backend 315). Shown only while
 * the clinic does not hold Farms, and gone once it does: the point is to turn
 * "my farmer asked me" into a plan upgrade, not to nag a clinic that already did.
 * Reloads on the live `farm.invite` ping so the notice appears without a refresh.
 */
const FarmInviteNotice: React.FC<{ onOpenFarm?: () => void }> = ({ onOpenFarm }) => {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [hasFarms, setHasFarms] = useState(true);

  const load = useCallback(() => {
    get('/farm-invites', { cache: false, silent: true } as any)
      .then((r: ApiResponse<{ hasFarms: boolean; invites: Invite[] }>) => {
        if (r.success && r.data) { setHasFarms(r.data.hasFarms); setInvites(r.data.invites); }
      })
      .catch(() => { /* a notice, never an error */ });
  }, []);

  useEffect(() => {
    load();
    const onStream = (e: Event) => { if ((e as CustomEvent).detail?.type === 'farm.invite') load(); };
    window.addEventListener('vethub:stream', onStream);
    return () => window.removeEventListener('vethub:stream', onStream);
  }, [load]);

  if (hasFarms || invites.length === 0) return null;
  const names = invites.slice(0, 3).map((i) => i.ownerName || i.farmName).join(', ');
  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 flex items-center gap-3">
      <span className="shrink-0 w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-700 flex items-center justify-center"><Sprout size={18} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-pine dark:text-zinc-100">
          {invites.length === 1 ? '1 farmer wants' : `${invites.length} farmers want`} to connect with your clinic
        </p>
        <p className="text-[11px] text-slate-600 dark:text-zinc-400 truncate">
          {names}{invites.length > 3 ? ` and ${invites.length - 3} more` : ''} — add Farms to your plan so you can see their animals and go out to them.
        </p>
      </div>
      {onOpenFarm && (
        <button onClick={onOpenFarm} className="shrink-0 text-[10px] font-black uppercase tracking-widest text-seafoam flex items-center gap-1">
          See how <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
};

export default FarmInviteNotice;
