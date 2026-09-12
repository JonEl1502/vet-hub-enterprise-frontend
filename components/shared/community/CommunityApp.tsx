import React, { useEffect, useMemo, useState } from 'react';
import {
  Home, Users, Tag, Calendar, Hash, Bookmark, PenLine, User as UserIcon,
  ArrowLeft, Bell, Search,
} from 'lucide-react';
import { communityAPI, CommunityPost } from '../../../services';
import { useAuth } from '../../../contexts/AuthContext';
import { usePlanAccess } from '../../../contexts/PlanAccessContext';
import CommunityLockup from './CommunityLockup';
import CommunityFeed from './CommunityFeed';
import PostDetail from './PostDetail';
import AuthorProfile, { ProfileSubject } from './AuthorProfile';
import MarketplaceRail, { Listing } from './MarketplaceRail';
import ListingView from './ListingView';
import DiscoverRail from './DiscoverRail';

/**
 * Community, as its own destination (297).
 *
 * ── Why it has its own chrome ─────────────────────────────────────────────
 * Community is a different mode of attention from running a clinic. Framing a
 * social feed with "Appointments · Inventory · Billing" keeps the reader at
 * work while they read it. So this renders OUTSIDE the clinic shell: its own
 * header, its own wordmark, its own nav, a warmer ground, more air.
 *
 * ⚠️ IT IS NOT A SEPARATE APP. Same bundle, same token, same session — the
 * router simply swaps the shell. "Back to work" is then instant with no reload
 * and no re-auth, and returns to the exact screen the user left. A genuinely
 * separate deployment would buy nothing here and cost shared auth, a second
 * deploy and a second bundle.
 *
 * ── The rail does not move ────────────────────────────────────────────────
 * ONE fixed rail, same width and position in both worlds. Only its TOP section
 * swaps: Community's own nav here, the clinic's nav underneath it always, so
 * the rest of the app stays one click away from inside the community.
 */

interface Props {
  /** Leaves Community for the clinic app, at the view the user came from. */
  onBackToWork: () => void;
  /** Jumps straight to a work view from the "Your clinic" section. */
  onGoToWorkView: (view: string) => void;
  /** Billing page id differs per audience, so the router supplies it (288). */
  onGoToBilling: () => void;
  /** Carries a deal's products into a pre-filled purchase order. */
  onOrder?: (post: CommunityPost, items: CommunityPost['items']) => void;
  /** Shown on the exit so a reader can see what is piling up while they browse. */
  waitingCount?: number;
  /** Named on the exit so a shared machine shows which account it returns to. */
  workspaceName?: string;
  /** Rows for the "Your clinic" section — App owns the permission logic. */
  workLinks?: Array<{ id: string; label: string; badge?: number }>;
}

type Screen =
  | { name: 'FEED' }
  | { name: 'POST'; post: CommunityPost }
  | { name: 'PROFILE'; subject: ProfileSubject }
  | { name: 'LISTING'; listing: Listing };

const NAV: Array<{ key: string; label: string; icon: any }> = [
  { key: 'all', label: 'Home', icon: Home },
  { key: 'following', label: 'Following', icon: Users },
  { key: 'DEAL', label: 'Deals', icon: Tag },
  { key: 'MEET', label: 'Meet-ups', icon: Calendar },
];

const YOURS: Array<{ key: string; label: string; icon: any }> = [
  { key: 'saved', label: 'Saved', icon: Bookmark },
  { key: 'mine', label: 'My posts', icon: PenLine },
  { key: 'profile', label: 'Profile', icon: UserIcon },
];

const CommunityApp: React.FC<Props> = ({
  onBackToWork, onGoToWorkView, onGoToBilling, onOrder,
  waitingCount, workspaceName, workLinks = [],
}) => {
  const { user } = useAuth();
  const { access } = usePlanAccess();
  const [view, setView] = useState('all');
  const [screen, setScreen] = useState<Screen>({ name: 'FEED' });
  const [reach, setReach] = useState<{ helpfulTotal: number; followers: number; postCount: number } | null>(null);

  const role = String(user?.role || '');
  const isPractitioner = role === 'FREELANCER';
  const isClient = role === 'CLIENT';
  const userId = (user as any)?.id ? String((user as any).id) : undefined;

  /**
   * May this account ORIGINATE a post?
   *
   * ⚠️ The SERVER is the authority — the controller refuses without the add-on
   * regardless of what this says, and checks a different entitlement per author
   * kind. This only decides whether to show the composer or the offer, so it
   * fails OPEN: an account whose plan we cannot read is not nagged.
   *
   * A CLIENT never sees the composer (they reply, they do not broadcast), and a
   * PRACTITIONER needs nothing — organising a meet-up is not advertising.
   */
  const canPost = !isClient && (
    !access
    || isPractitioner
    || access.featureKeys?.includes('*')
    || access.featureKeys?.includes('community:participate')
    || (((access as any).addOns ?? []) as Array<{ name: string }>).some(a => /community/i.test(a.name))
  );

  const mySubject: ProfileSubject = useMemo(() => ({ userId: userId ?? null }), [userId]);

  useEffect(() => {
    let live = true;
    if (!userId) return;
    communityAPI.profile({ userId })
      .then(r => { if (live && r.data?.profile) {
        const p = r.data.profile;
        setReach({ helpfulTotal: p.helpfulTotal, followers: p.followers, postCount: p.postCount });
      } })
      .catch(() => undefined);
    return () => { live = false; };
  }, [userId]);

  const go = (v: string) => {
    if (v === 'profile') { setScreen({ name: 'PROFILE', subject: mySubject }); return; }
    setView(v === 'mine' ? 'mine' : v);
    setScreen({ name: 'FEED' });
  };

  const openAuthor = (p: CommunityPost) => setScreen({
    name: 'PROFILE',
    subject: { clinicId: p.authorClinicId, supplierId: p.authorSupplierId, userId: p.authorUserId },
  });

  const railLink = (active: boolean) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] font-bold transition-colors ${
      active
        ? 'bg-seafoam/10 text-seafoam'
        : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/60 hover:text-pine dark:hover:text-zinc-100'
    }`;

  const onFeed = screen.name === 'FEED';

  return (
    /* A warmer ground than the clinic app, on purpose: you should be able to
       feel which room you are in before reading a word. */
    <div className="min-h-screen bg-[#F4F1EA] dark:bg-[#12100C] text-slate-900 dark:text-zinc-100">

      {/* ══ ONE FIXED RAIL — never scrolls away, never moves between worlds ══ */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[214px] z-40 flex-col gap-0.5 overflow-y-auto border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#1A1814] px-3 py-4">
        <div className="flex items-start gap-2.5 px-2 pt-0.5 pb-4">
          <span className="w-[30px] h-[30px] rounded-[10px] bg-gradient-to-br from-seafoam to-pine grid place-items-center shrink-0">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-[17px] h-[17px] text-white dark:text-[#12100C]">
              <ellipse cx="6" cy="9" rx="2.3" ry="3" /><ellipse cx="11.4" cy="6.4" rx="2.3" ry="3.1" />
              <ellipse cx="17" cy="8.4" rx="2.2" ry="2.9" />
              <path d="M12 12c2.6 0 4.6 1.8 5.6 3.7.9 1.7.2 3.8-1.7 4.2-1.3.3-2.6-.2-3.9-.2s-2.6.5-3.9.2c-1.9-.4-2.6-2.5-1.7-4.2C7.4 13.8 9.4 12 12 12Z" />
            </svg>
          </span>
          <CommunityLockup />
        </div>

        <p className="px-3 pt-1 pb-1.5 text-[9px] font-display font-extrabold uppercase tracking-[0.14em] text-slate-400">Community</p>
        {NAV.map(n => (
          <button key={n.key} onClick={() => go(n.key)} className={railLink(onFeed && view === n.key)}>
            <n.icon size={16} className="opacity-85 shrink-0" /> {n.label}
          </button>
        ))}
        <button onClick={() => go('all')} className={railLink(view.startsWith('tag:'))}>
          <Hash size={16} className="opacity-85 shrink-0" /> Topics
        </button>

        <p className="px-3 pt-4 pb-1.5 text-[9px] font-display font-extrabold uppercase tracking-[0.14em] text-slate-400">Yours</p>
        {YOURS.map(n => (
          <button
            key={n.key}
            onClick={() => go(n.key)}
            className={railLink(n.key === 'profile' ? screen.name === 'PROFILE' : onFeed && view === n.key)}
          >
            <n.icon size={16} className="opacity-85 shrink-0" /> {n.label}
          </button>
        ))}

        <div className="mx-0.5 mt-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 p-2.5">
          <p className="flex items-center gap-1.5 text-[9px] font-display font-extrabold uppercase tracking-widest text-seafoam">
            <i className="w-1.5 h-1.5 rounded-full bg-seafoam" />
            {canPost ? 'Community Access · active' : 'Reading & replying · free'}
          </p>
          <p className="mt-1.5 text-[10.5px] font-semibold text-slate-400 leading-relaxed">
            {canPost
              ? 'Reading and replying are free for everyone; this is what lets you publish.'
              : 'Reply to anyone for free. Publishing your own posts is the add-on.'}
          </p>
          {!canPost && (
            <button onClick={onGoToBilling} className="mt-2 w-full rounded-lg bg-gradient-to-r from-pine to-seafoam py-1.5 text-[8.5px] font-display font-extrabold uppercase tracking-widest text-white">
              Get access
            </button>
          )}
        </div>

        {/* ⚠️ The clinic's nav stays here, always. Community is a room in the
            same building, not a different address — the rest of the app has to
            be one click away from inside it. */}
        {workLinks.length > 0 && (
          <>
            <p className="px-3 pt-4 pb-1.5 text-[9px] font-display font-extrabold uppercase tracking-[0.14em] text-slate-400">
              {workspaceName ? 'Your workspace' : 'Your clinic'}
            </p>
            {workLinks.map(w => (
              <button key={w.id} onClick={() => onGoToWorkView(w.id)} className={railLink(false)}>
                <span className="truncate">{w.label}</span>
                {!!w.badge && (
                  <span className="ml-auto rounded-full bg-amber px-1.5 text-[8.5px] font-display font-extrabold text-[#3A2A05]">{w.badge}</span>
                )}
              </button>
            ))}
          </>
        )}
      </aside>

      <div className="md:ml-[214px] min-w-0">
        {/* ══ Community's own header ══ */}
        <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-slate-200 dark:border-zinc-800 bg-[#F4F1EA]/90 dark:bg-[#12100C]/90 px-4 sm:px-5 backdrop-blur">
          <div className="hidden lg:flex flex-1 max-w-sm items-center gap-2 rounded-full border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#1A1814] px-3.5 py-2 text-[12.5px] font-semibold text-slate-400">
            <Search size={14} /> Search posts, people, topics
          </div>
          <span className="flex-1" />

          <button className="relative grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-white dark:hover:bg-zinc-900">
            <Bell size={17} />
            <span className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full border-2 border-[#F4F1EA] dark:border-[#12100C] bg-amber" />
          </button>

          {/* THE WAY OUT. A bordered pill, not a text link — it is the one
              control that leaves, and it names where it returns to. */}
          <button
            onClick={onBackToWork}
            className="flex shrink-0 items-center gap-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#1A1814] py-1.5 pl-2.5 pr-3 shadow-sm hover:border-seafoam group"
          >
            <ArrowLeft size={15} className="text-slate-400 group-hover:text-seafoam shrink-0" />
            <span className="text-left leading-tight">
              <span className="block text-[10px] font-display font-extrabold tracking-wide text-pine dark:text-zinc-100">Back to work</span>
              {workspaceName && <span className="hidden sm:block text-[9.5px] font-semibold text-slate-400">{workspaceName}</span>}
            </span>
            {/* What is piling up while you browse. Community is the one screen
                where twenty minutes disappear with a patient in the waiting room. */}
            {!!waitingCount && (
              <span className="shrink-0 rounded-full bg-amber px-1.5 py-0.5 text-[8.5px] font-display font-extrabold text-[#3A2A05]">
                {waitingCount} waiting
              </span>
            )}
          </button>

          {/* Who you are posting AS. The clinic shell carries this and its
              absence here made Community read like a different login. */}
          <span
            title={user?.name || 'You'}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-pine to-seafoam font-display text-xs font-extrabold text-white"
          >
            {(user?.name || 'V').charAt(0).toUpperCase()}
          </span>
        </header>

        {/* Four columns counting the fixed rail: nav · feed · marketplace ·
            discovery. They shed in order of what each is carrying — discovery
            first, then the marketplace. The feed never goes. */}
        <div className="grid items-start gap-4 min-[1120px]:gap-[18px] px-4 sm:px-5 pt-5 pb-16 max-w-[1520px]
                        grid-cols-1
                        min-[1120px]:grid-cols-[minmax(0,1fr)_288px]
                        min-[1400px]:grid-cols-[minmax(0,1fr)_288px_268px]">
          <main className="min-w-0">
            {screen.name === 'FEED' && (
              <CommunityFeed
                view={view}
                onChangeView={setView}
                onOpenPost={p => setScreen({ name: 'POST', post: p })}
                onOpenAuthor={openAuthor}
                onOrder={onOrder}
                canPost={canPost}
                isPractitioner={isPractitioner}
                currentUserId={userId}
                onGetAccess={onGoToBilling}
                avatarLetter={(user?.name || 'V').charAt(0).toUpperCase()}
              />
            )}

            {screen.name === 'POST' && (
              <PostDetail
                post={screen.post}
                onBack={() => setScreen({ name: 'FEED' })}
                onChange={p => setScreen({ name: 'POST', post: p })}
                onOpenAuthor={openAuthor}
                onOpenTag={t => { setView(`tag:${t}`); setScreen({ name: 'FEED' }); }}
                onOrder={onOrder}
                ownsPost={!!userId && String(screen.post.authorUserId) === String(userId)}
              />
            )}

            {screen.name === 'PROFILE' && (
              <AuthorProfile
                subject={screen.subject}
                onBack={() => setScreen({ name: 'FEED' })}
                onOpenPost={p => setScreen({ name: 'POST', post: p })}
                onOpenTag={t => { setView(`tag:${t}`); setScreen({ name: 'FEED' }); }}
                onOrder={onOrder}
                currentUserId={userId}
              />
            )}

            {screen.name === 'LISTING' && (
              <ListingView
                listing={screen.listing}
                onBack={() => setScreen({ name: 'FEED' })}
                onOpenListing={l => setScreen({ name: 'LISTING', listing: l })}
              />
            )}
          </main>

          <div className="hidden min-[1120px]:block min-w-0">
            <MarketplaceRail
              onOpenListing={l => setScreen({ name: 'LISTING', listing: l })}
              onBrowseAll={() => setScreen({ name: 'LISTING', listing: {
                id: 'browse', category: 'Pets for sale', title: 'German Shepherd puppies — 9 weeks',
                price: 'KES 35,000', kind: 'CLASSIFIED',
                gradient: 'linear-gradient(140deg,#1C7A5B,#144E35)',
              } })}
            />
          </div>

          <div className="hidden min-[1400px]:block min-w-0">
            <DiscoverRail
              onOpenTag={t => { setView(`tag:${t}`); setScreen({ name: 'FEED' }); }}
              onOpenPost={p => setScreen({ name: 'POST', post: p })}
              reach={reach}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityApp;
