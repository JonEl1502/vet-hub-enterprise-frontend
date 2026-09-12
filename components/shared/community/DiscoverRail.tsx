import React, { useEffect, useState } from 'react';
import { Calendar, MapPin } from 'lucide-react';
import { communityAPI, CommunityPost, CommunityFollowing, FollowSubject } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';

/**
 * The discovery column (297): trending topics, who's here, meet-ups near you,
 * suggested to follow, what you already follow, and your own reach last.
 *
 * ⚠️ Everything here is REAL except presence — topics come from the tag tally
 * endpoint, meet-ups from the feed filtered to MEET, follows from the follow
 * table. Presence has no source yet (see below), so it is the one block that
 * states what it is.
 */

interface Props {
  onOpenTag: (tag: string) => void;
  onOpenPost: (post: CommunityPost) => void;
  /** Totals for the account's own posts — read from its profile. */
  reach: { helpfulTotal: number; followers: number; postCount: number } | null;
}

const Card: React.FC<{ title: string; extra?: React.ReactNode; children: React.ReactNode }> = ({ title, extra, children }) => (
  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
    <h4 className="flex items-center justify-between gap-2 text-[9px] font-display font-extrabold uppercase tracking-[0.14em] text-slate-400 mb-3">
      {title}{extra}
    </h4>
    {children}
  </div>
);

const DiscoverRail: React.FC<Props> = ({ onOpenTag, onOpenPost, reach }) => {
  const [topics, setTopics] = useState<Array<{ tag: string; posts: number }>>([]);
  const [meets, setMeets] = useState<CommunityPost[]>([]);
  const [suggested, setSuggested] = useState<CommunityPost[]>([]);
  const [following, setFollowing] = useState<CommunityFollowing | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [active, setActive] = useState<{
    people: Array<{ id: string; name: string; role: string; avatar: string | null; did: string; minutesAgo: number }>;
    total: number; windowMinutes: number;
  } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      // Failures here must never take the column down — it is all secondary to
      // the feed, and an empty card is better than a thrown render.
      const [t, m, s, f, a] = await Promise.allSettled([
        communityAPI.topics(),
        communityAPI.feed({ kind: 'MEET', limit: 4 }),
        communityAPI.feed({ limit: 12, sort: 'helpful' }),
        communityAPI.following(),
        communityAPI.activeRecently(),
      ]);
      if (!live) return;
      if (a.status === 'fulfilled') setActive(a.value.data ?? null);
      if (t.status === 'fulfilled') setTopics(t.value.data?.topics ?? []);
      if (m.status === 'fulfilled') setMeets(m.value.data?.posts ?? []);
      if (f.status === 'fulfilled') setFollowing(f.value.data ?? null);
      if (s.status === 'fulfilled') {
        // One row per AUTHOR, not per post: three cards for the same busy
        // clinic is not a suggestion list, it is a repeat.
        const seen = new Set<string>();
        const rows = (s.value.data?.posts ?? []).filter(p => {
          const key = p.authorClinicId || p.authorSupplierId || p.authorUserId || p.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setSuggested(rows.slice(0, 4));
      }
    })();
    return () => { live = false; };
  }, []);

  const followedIds = new Set([
    ...(following?.clinics ?? []).map(c => `c${c.id}`),
    ...(following?.suppliers ?? []).map(c => `s${c.id}`),
    ...(following?.people ?? []).map(c => `u${c.id}`),
  ]);

  const subjectOf = (p: CommunityPost): { key: string; subject: FollowSubject } | null => {
    if (p.authorClinicId) return { key: `c${p.authorClinicId}`, subject: { clinicId: p.authorClinicId } };
    if (p.authorSupplierId) return { key: `s${p.authorSupplierId}`, subject: { supplierId: p.authorSupplierId } };
    if (p.authorUserId) return { key: `u${p.authorUserId}`, subject: { userId: p.authorUserId } };
    return null;
  };

  const toggleFollow = async (p: CommunityPost) => {
    const s = subjectOf(p);
    if (!s) return;
    setBusy(s.key);
    try {
      const res = await communityAPI.follow(s.subject);
      const on = !!res.data?.following;
      setFollowing(prev => {
        const next: CommunityFollowing = prev ?? { clinics: [], suppliers: [], people: [], tags: [] };
        const row = { id: (p.authorClinicId || p.authorSupplierId || p.authorUserId)!, name: p.authorName, logo: p.authorLogo, city: null };
        const bucket = p.authorClinicId ? 'clinics' : p.authorSupplierId ? 'suppliers' : 'people';
        const list = (next as any)[bucket] as Array<{ id: string }>;
        return {
          ...next,
          [bucket]: on ? [...list, row] : list.filter(x => String(x.id) !== String(row.id)),
        } as CommunityFollowing;
      });
    } catch { /* toasted by the API layer */ } finally { setBusy(null); }
  };

  const toggleTag = async (tag: string) => {
    try {
      const res = await communityAPI.follow({ tag });
      const on = !!res.data?.following;
      setFollowing(prev => {
        const next = prev ?? { clinics: [], suppliers: [], people: [], tags: [] };
        return { ...next, tags: on ? [...next.tags, tag] : next.tags.filter(t => t !== tag) };
      });
    } catch { /* toasted */ }
  };

  return (
    <aside className="flex flex-col gap-3 min-w-0">
      <p className="text-[8.5px] font-display font-extrabold uppercase tracking-[0.18em] text-slate-400 px-0.5">Discover</p>

      {topics.length > 0 && (
        <Card title="Trending topics">
          {topics.slice(0, 6).map(t => (
            <button
              key={t.tag}
              onClick={() => onOpenTag(t.tag)}
              className="w-full flex items-baseline justify-between gap-2.5 py-1.5 border-b border-slate-100 dark:border-zinc-800 last:border-0 text-left group"
            >
              <span className="text-[12px] font-bold text-pine dark:text-zinc-100 group-hover:text-seafoam truncate">#{t.tag}</span>
              <span className="text-[10.5px] font-semibold text-slate-400 tabular-nums whitespace-nowrap">{t.posts} posts</span>
            </button>
          ))}
        </Card>
      )}

      {/* ⚠️ "Recently active", NOT "who's online". There is no presence signal
          in this platform, so a green dot claiming someone is here right now
          would be a guess dressed as a fact. Who WROTE something, and when, is
          real — and it answers the question the block exists for better than
          presence would: ask now and somebody will reply. */}
      {active && active.people.length > 0 && (
        <Card
          title="Recently active"
          extra={
            <span className="inline-flex items-center gap-1.5 text-[8.5px] font-display font-extrabold tracking-wide text-seafoam normal-case">
              <i className="w-1.5 h-1.5 rounded-full bg-seafoam ring-4 ring-seafoam/15" />
              {active.total} in the last hour
            </span>
          }
        >
          {active.people.map(p => (
            <div key={p.id} className="flex items-center gap-2.5 py-2 border-b border-slate-100 dark:border-zinc-800 last:border-0">
              <span className="relative w-7 h-7 rounded-lg bg-seafoam/10 grid place-items-center text-[10px] font-black text-pine dark:text-seafoam shrink-0">
                {p.avatar && p.avatar.startsWith('http')
                  ? <img src={p.avatar} alt="" className="w-full h-full object-cover rounded-lg" />
                  : p.name.charAt(0)}
                <i className={`absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-zinc-900 ${
                  p.minutesAgo <= 10 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-600'
                }`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-bold text-pine dark:text-zinc-100 truncate">{p.name}</span>
                <span className="block text-[10.5px] font-semibold text-slate-400 truncate">
                  {p.role} · {p.did} {p.minutesAgo < 1 ? 'just now' : `${p.minutesAgo}m ago`}
                </span>
              </span>
            </div>
          ))}
          <p className="mt-2.5 text-[10.5px] font-semibold text-slate-400 leading-relaxed">
            A question asked while people are writing gets answered today, not next week.
          </p>
        </Card>
      )}

      {meets.length > 0 && (
        <Card title="Meet-ups near you">
          {meets.map(m => (
            <button
              key={m.id}
              onClick={() => onOpenPost(m)}
              className="w-full flex flex-col items-start py-2 border-b border-slate-100 dark:border-zinc-800 last:border-0 text-left group"
            >
              <span className="text-[12px] font-bold leading-snug text-pine dark:text-zinc-100 group-hover:text-seafoam">{m.title}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[10.5px] font-semibold text-slate-400">
                {m.startsAt && <span className="inline-flex items-center gap-1"><Calendar size={10} /> {formatDate(m.startsAt)}</span>}
                {m.location && <span className="inline-flex items-center gap-1 truncate"><MapPin size={10} /> {m.location}</span>}
              </span>
            </button>
          ))}
        </Card>
      )}

      {suggested.length > 0 && (
        <Card title="Suggested to follow">
          {suggested.map(p => {
            const s = subjectOf(p);
            const on = s ? followedIds.has(s.key) : false;
            return (
              <div key={p.id} className="flex items-center gap-2.5 py-2 border-b border-slate-100 dark:border-zinc-800 last:border-0">
                <span className="w-7 h-7 rounded-lg bg-seafoam/10 grid place-items-center text-[10px] font-black text-pine dark:text-seafoam shrink-0 overflow-hidden">
                  {p.authorLogo && p.authorLogo.startsWith('http')
                    ? <img src={p.authorLogo} alt="" className="w-full h-full object-cover" />
                    : p.authorName.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-bold text-pine dark:text-zinc-100 truncate">{p.authorName}</span>
                  <span className="block text-[10.5px] font-semibold text-slate-400 capitalize">{p.authorKind.toLowerCase()}</span>
                </span>
                <button
                  onClick={() => toggleFollow(p)}
                  disabled={busy === s?.key}
                  className={`shrink-0 rounded-lg border px-2.5 py-1 text-[8.5px] font-display font-extrabold uppercase tracking-widest transition-colors disabled:opacity-50 ${
                    on ? 'bg-seafoam text-white border-seafoam' : 'border-seafoam text-seafoam hover:bg-seafoam hover:text-white'
                  }`}
                >
                  {on ? 'Following' : 'Follow'}
                </button>
              </div>
            );
          })}
        </Card>
      )}

      {(following?.tags.length || topics.length) ? (
        <Card title="Topics you follow">
          <div className="flex flex-wrap gap-1.5">
            {[...new Set([...(following?.tags ?? []), ...topics.slice(0, 6).map(t => t.tag)])].slice(0, 10).map(t => {
              const on = (following?.tags ?? []).includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleTag(t)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    on ? 'bg-seafoam/10 border-seafoam text-seafoam' : 'border-slate-200 dark:border-zinc-800 text-slate-500 hover:border-seafoam hover:text-seafoam'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-[10.5px] font-semibold text-slate-400 leading-relaxed">
            Built on the tags posts already carry — no separate membership to join.
          </p>
        </Card>
      ) : null}

      {reach && (
        <Card title="Your reach">
          {[['Found helpful', reach.helpfulTotal], ['Followers', reach.followers], ['Posts published', reach.postCount]].map(([k, v]) => (
            <div key={String(k)} className="flex items-baseline justify-between py-1.5 border-b border-slate-100 dark:border-zinc-800 last:border-0">
              <span className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">{k}</span>
              <span className="text-[15px] font-display font-extrabold tabular-nums tracking-tight text-pine dark:text-zinc-100">{Number(v).toLocaleString()}</span>
            </div>
          ))}
          <p className="mt-2.5 text-[10.5px] font-semibold text-slate-400 leading-relaxed">
            Helpful is earned. A boost buys placement, and is always labelled.
          </p>
        </Card>
      )}
    </aside>
  );
};

export default DiscoverRail;
