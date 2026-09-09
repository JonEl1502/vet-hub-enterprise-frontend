import React, { useState } from 'react';
import { Dog, Wheat, Loader2, Check, ArrowRightLeft } from 'lucide-react';
import { usePortalMode, type PortalMode } from '../usePortalMode';
import { toast, dialog } from '../../../services';

/**
 * 290 — MANAGE THE TWO SIDES OF THIS ACCOUNT, from Settings.
 *
 * User, 2026-09-09: *"they can go to settings and say they want to activate
 * pet side, and they can add pets. This will activate the pet side, and they
 * will have both. And if user had pet side, they can also say go to settings
 * and say they want to move to farm side also. And also, maybe someone created
 * the account by mistake as [pets], and then they wanted farm, so they can
 * transfer the account to pet side or farm side, whichever."*
 *
 * Two different things, kept visibly different:
 *
 *   ACTIVATE — turn the other side ON and keep both. This is the common case
 *              and it is the primary button.
 *   MOVE     — "I made this on the wrong side." Only offered when the side
 *              being LEFT is empty, because a move switches a side off, and
 *              switching off a side that holds animals would hide real records
 *              behind a setting nobody would think to look at. The server
 *              refuses it too; this just doesn't offer what would be refused.
 *
 * ⚠️ MOVE is behind a confirm. ACTIVATE is not — adding a capability is not a
 * decision anyone regrets, and a confirm on it would be noise.
 */
const SIDE_META: Record<PortalMode, { icon: typeof Dog; label: string; noun: string; blurb: string }> = {
  PETS: {
    icon: Dog,
    label: 'Pet side',
    noun: 'pets',
    blurb: 'Dogs, cats and other animals you keep at home — their visits, vaccinations and bills.',
  },
  FARM: {
    icon: Wheat,
    label: 'Farm side',
    noun: 'farms',
    blurb: 'Herds, flocks, crops and the money moving through them — plus a clinic or vet officer link.',
  },
};

const PortalSidesPanel: React.FC = () => {
  const { holdings, loading, chooseSide, mode } = usePortalMode();
  const [busy, setBusy] = useState<string | null>(null);

  const sides = holdings?.sides;
  if (loading || !sides) return null;

  const run = async (side: PortalMode, action: 'ACTIVATE' | 'MOVE' | 'DEFAULT', key: string) => {
    setBusy(key);
    try {
      const res = await chooseSide(side, action);
      if (res?.success) {
        toast.success(
          action === 'ACTIVATE' ? `${SIDE_META[side].label} is on — both sides are now available.`
          : action === 'MOVE'   ? `This account has been moved to the ${SIDE_META[side].label.toLowerCase()}.`
          : `You'll open on the ${SIDE_META[side].label.toLowerCase()} from now on.`,
        );
      }
    } finally {
      setBusy(null);
    }
  };

  const confirmMove = async (side: PortalMode) => {
    const leaving: PortalMode = side === 'PETS' ? 'FARM' : 'PETS';
    const ok = await dialog.confirm({
      title: `Move this account to the ${SIDE_META[side].label.toLowerCase()}?`,
      message: `The ${SIDE_META[leaving].label.toLowerCase()} will be switched off and disappear from your navigation. It is empty, so nothing is deleted — and you can switch it back on here at any time.`,
      confirmLabel: 'Move the account',
      variant: 'warning',
    });
    if (ok) run(side, 'MOVE', `move-${side}`);
  };

  const Row: React.FC<{ id: PortalMode }> = ({ id }) => {
    const meta = SIDE_META[id];
    const s = id === 'PETS' ? sides.pets : sides.farm;
    const other = id === 'PETS' ? sides.farm : sides.pets;
    const isDefault = holdings?.defaultSide === id;
    // A move must LEAVE the other side, so it is only offered when that side
    // is empty — see the header.
    const canMoveHere = !s.active && s.available && other.count === 0;

    return (
      <div
        className="rounded-xl border p-4"
        style={{
          borderColor: s.active ? 'var(--cp-accent)' : 'var(--cp-border)',
          background: s.active ? 'var(--cp-accent-soft)' : 'transparent',
        }}
      >
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: 'var(--cp-accent-soft)' }}>
            <meta.icon className="w-4 h-4 cp-accent-text" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm" style={{ color: 'var(--cp-ink)' }}>{meta.label}</span>
              {s.active && (
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest cp-accent-text">
                  <Check className="w-3 h-3" /> On
                </span>
              )}
              {isDefault && s.active && (
                <span className="text-[9px] font-black uppercase tracking-widest cp-muted">Opens here</span>
              )}
              {!s.available && (
                <span className="text-[9px] font-black uppercase tracking-widest cp-muted">Not on your plan</span>
              )}
            </div>
            <p className="text-xs cp-muted mt-1 leading-relaxed">{meta.blurb}</p>
            {s.active && (
              <p className="text-[11px] cp-muted mt-1">
                {s.count === 0 ? `No ${meta.noun} added yet.` : `${s.count} ${s.count === 1 ? meta.noun.replace(/s$/, '') : meta.noun} on this account.`}
              </p>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              {!s.active && s.available && (
                <button className="cp-btn-ghost" disabled={!!busy} onClick={() => run(id, 'ACTIVATE', `act-${id}`)}>
                  {busy === `act-${id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Turn on the {meta.label.toLowerCase()}
                </button>
              )}
              {canMoveHere && (
                <button className="cp-btn-ghost" disabled={!!busy} onClick={() => confirmMove(id)}>
                  {busy === `move-${id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                  Move this account here instead
                </button>
              )}
              {s.active && !isDefault && (
                <button className="cp-btn-ghost" disabled={!!busy} onClick={() => run(id, 'DEFAULT', `def-${id}`)}>
                  {busy === `def-${id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Open here by default
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="cp-card p-5">
      <div className="font-bold text-sm" style={{ color: 'var(--cp-ink)' }}>Pets and farm</div>
      <p className="text-xs cp-muted mt-1 leading-relaxed">
        One account, two sides. Turn on whichever you need — you can have both, and
        switching between them never moves or deletes anything.
        {mode === 'FARM' ? ' You are on the farm side right now.' : ' You are on the pet side right now.'}
      </p>
      <div className="mt-4 space-y-3">
        <Row id="PETS" />
        <Row id="FARM" />
      </div>
    </div>
  );
};

export default PortalSidesPanel;
