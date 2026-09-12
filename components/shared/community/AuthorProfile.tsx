import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { communityAPI, CommunityPost, CommunityProfile, FollowSubject } from '../../../services';
import PostCard from './PostCard';

/**
 * An author's own page (297).
 *
 * ⚠️ THIS IS THE BIGGEST SINGLE LEVER ON WHETHER THE SPACE READS AS SOCIAL.
 * Before it, every author was a name on a card that led nowhere — you could
 * read a clinic's article and have no way to see anything else they had ever
 * written, or to hear from them again. A feed where every name is a dead end
 * is a noticeboard however many reactions you bolt onto it.
 *
 * ⚠️ "Found helpful" totals PUBLISHED posts only. Counting drafts would let an
 * author inflate the number with writing nobody can read.
 */

export interface ProfileSubject {
  clinicId?: string | null;
  supplierId?: string | null;
  userId?: string | null;
}

interface Props {
  subject: ProfileSubject;
  onBack: () => void;
  onOpenPost: (post: CommunityPost) => void;
  onOpenTag: (tag: string) => void;
  onOrder?: (post: CommunityPost, items: CommunityPost['items']) => void;
  currentUserId?: string;
}

const KIND_TABS: Array<{ key: string; label: string }> = [
  { key: 'ALL', label: 'Posts' },
  { key: 'ARTICLE', label: 'Articles' },
  { key: 'DEAL', label: 'Deals' },
  { key: 'MEET', label: 'Meet-ups' },
];

const AuthorProfile: React.FC<Props> = ({ subject, onBack, onOpenPost, onOpenTag, onOrder, currentUserId }) => {
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [tab, setTab] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      try {
        const [p, f] = await Promise.all([
          communityAPI.profile(subject),
          communityAPI.feed({
            clinicId: subject.clinicId ?? undefined,
            supplierId: subject.supplierId ?? undefined,
            userId: subject.userId ?? undefined,
            kind: tab === 'ALL' ? undefined : tab,
            limit: 30,
          }),
        ]);
        if (!live) return;
        setProfile(p.data?.profile ?? null);
        setFollowing(!!p.data?.profile?.viewerFollows);
        setPosts(f.data?.posts ?? []);
      } catch {
        if (live) { setProfile(null); setPosts([]); }
      } finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [subject.clinicId, subject.supplierId, subject.userId, tab]);

  const toggleFollow = async () => {
    if (!profile) return;
    const s: FollowSubject | null =
      profile.clinicId ? { clinicId: profile.clinicId }
      : profile.supplierId ? { supplierId: profile.supplierId }
      : profile.userId ? { userId: profile.userId }
      : null;
    if (!s) return;
    setBusy(true);
    setFollowing(v => !v);
    try {
      const res = await communityAPI.follow(s);
      if (res.data) setFollowing(res.data.following);
    } catch { setFollowing(v => !v); } finally { setBusy(false); }
  };

  // Following yourself puts your own posts in a feed whose entire purpose is
  // other people's, so the control simply is not there.
  const isSelf = !!currentUserId && !!profile?.userId && String(profile.userId) === String(currentUserId);

  return (
    <div className="flex flex-col gap-3.5 min-w-0">
      <button onClick={onBack} className="self-start inline-flex items-center gap-1.5 text-[9.5px] font-display font-extrabold uppercase tracking-widest text-slate-400 hover:text-seafoam">
        <ArrowLeft size={13} /> Back to the feed
      </button>

      {loading && !profile ? (
        <div className="py-20 text-center text-[11px] font-bold text-slate-400">Loading…</div>
      ) : !profile ? (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-10 text-center">
          <p className="text-sm font-black text-pine dark:text-zinc-100">We couldn't find that profile.</p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5">
            <div className="flex items-start gap-4 flex-wrap">
              <span className="w-16 h-16 rounded-2xl bg-seafoam/10 grid place-items-center text-2xl font-black text-pine dark:text-seafoam shrink-0 overflow-hidden">
                {profile.logo && profile.logo.startsWith('http')
                  ? <img src={profile.logo} alt="" className="w-full h-full object-cover" />
                  : profile.name.charAt(0)}
              </span>
              <div className="flex-1 min-w-[180px]">
                <h2 className="text-xl font-display font-extrabold tracking-tight text-pine dark:text-zinc-100">{profile.name}</h2>
                <p className="mt-0.5 text-[12px] font-semibold text-slate-400 capitalize">
                  {profile.kind.toLowerCase()}{profile.subtitle ? ` · ${profile.subtitle}` : ''}
                </p>
                <div className="flex flex-wrap gap-6 mt-3">
                  {[
                    ['Found helpful', profile.helpfulTotal],
                    ['Followers', profile.followers],
                    ['Posts', profile.postCount],
                    ['Replies', profile.commentTotal],
                  ].map(([k, v]) => (
                    <div key={String(k)}>
                      <span className="block text-[17px] font-display font-extrabold tracking-tight tabular-nums text-pine dark:text-zinc-100">
                        {Number(v).toLocaleString()}
                      </span>
                      <span className="block text-[9px] font-display font-extrabold uppercase tracking-widest text-slate-400">{k}</span>
                    </div>
                  ))}
                </div>
              </div>
              {!isSelf && (
                <button
                  onClick={toggleFollow}
                  disabled={busy}
                  className={`shrink-0 px-5 py-2.5 rounded-xl text-[10px] font-display font-extrabold uppercase tracking-widest transition-colors disabled:opacity-50 ${
                    following
                      ? 'border border-seafoam text-seafoam hover:bg-seafoam/10'
                      : 'bg-gradient-to-r from-pine to-seafoam text-white'
                  }`}
                >
                  {following ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-0.5 border-b border-slate-200 dark:border-zinc-800">
            {KIND_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3.5 py-2.5 -mb-px text-[9.5px] font-display font-extrabold uppercase tracking-widest border-b-2 transition-colors ${
                  tab === t.key ? 'text-seafoam border-seafoam' : 'text-slate-400 border-transparent hover:text-seafoam'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-12 text-center"><Loader2 size={18} className="animate-spin mx-auto text-slate-300" /></div>
          ) : posts.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-10 text-center">
              <p className="text-[12px] font-semibold text-slate-400">Nothing published under this yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {posts.map(p => (
                <PostCard
                  key={p.id}
                  post={p}
                  onChange={updated => setPosts(list => list.map(x => x.id === updated.id ? updated : x))}
                  onOpen={onOpenPost}
                  onOpenAuthor={() => {}}
                  onOpenTag={onOpenTag}
                  onOrder={onOrder}
                  mine={!!currentUserId && String(p.authorUserId) === String(currentUserId)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AuthorProfile;
