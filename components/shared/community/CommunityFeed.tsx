import React, { useEffect, useState } from 'react';
import { Loader2, Megaphone, X } from 'lucide-react';
import { communityAPI, CommunityPost, CommunityKind, toast, dialog } from '../../../services';
import PostCard from './PostCard';

/**
 * The feed, and the thing you write into it (297).
 *
 * ── The composer is the biggest behavioural change on this screen ─────────
 * 207 opened a MODAL FORM with price, compare-at price, and three levels of
 * audience targeting. That is an ad-booking form, and it was the default
 * gesture for a vet who simply wanted to say something. Here the resting state
 * is one line — "Share something with the community…" — and ARTICLE / DEAL /
 * MEET are modes you step into.
 *
 * ⚠️ THE TARGETING BLOCK ONLY APPEARS FOR DEAL AND MEET. It is advertising
 * machinery: a Nairobi delivery deal means nothing in Mombasa, and a meet-up
 * has a place. A plain post reaches your followers and the feed, and asking
 * someone to fill in three location levels before they can speak is how a
 * community stays silent.
 */

const TABS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'For you' },
  { key: 'following', label: 'Following' },
  { key: 'DEAL', label: 'Deals' },
  { key: 'MEET', label: 'Meet-ups' },
];

type Mode = 'POST' | 'ARTICLE' | 'DEAL' | 'MEET';

const MODE_HINT: Record<Mode, string> = {
  POST: 'Goes to everyone who follows you, and to anyone browsing For you. No targeting — that belongs to deals and meet-ups.',
  ARTICLE: 'The long one. It gets its own page, and Helpful on it is what builds your reach.',
  DEAL: 'Attached products carry the OFFER price into a buyer\'s purchase order. Targeting matters here — a Nairobi delivery deal means nothing in Mombasa.',
  MEET: 'Leave the location levels open and everyone on VetHub sees it. Set a town and it reaches that town.',
};

interface Props {
  /** 'all' | 'following' | 'saved' | ARTICLE|DEAL|MEET | 'tag:<x>' */
  view: string;
  onChangeView: (v: string) => void;
  onOpenPost: (post: CommunityPost) => void;
  onOpenAuthor: (post: CommunityPost) => void;
  onOrder?: (post: CommunityPost, items: CommunityPost['items']) => void;
  /** False when the account holds no add-on — shows the offer, not a wall. */
  canPost: boolean;
  isPractitioner: boolean;
  currentUserId?: string;
  onGetAccess: () => void;
  avatarLetter: string;
}

const CommunityFeed: React.FC<Props> = ({
  view, onChangeView, onOpenPost, onOpenAuthor, onOrder,
  canPost, isPractitioner, currentUserId, onGetAccess, avatarLetter,
}) => {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(isPractitioner ? 'MEET' : 'POST');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', body: '', tags: '',
    price: '', compareAtPrice: '', endsAt: '', startsAt: '',
    venueMode: 'IN_PERSON' as 'IN_PERSON' | 'ONLINE',
    venueCountry: '', venueCity: '', venueAddress: '', venueLink: '',
    audienceCities: '', audienceCountries: '', audienceRegions: '',
  });

  const load = async () => {
    setLoading(true);
    setEmptyReason(null);
    try {
      const tag = view.startsWith('tag:') ? view.slice(4) : undefined;
      const kind = ['ARTICLE', 'DEAL', 'MEET'].includes(view) ? view : undefined;
      const res = await communityAPI.feed({
        kind, tag,
        following: view === 'following',
        saved: view === 'saved',
        limit: 20,
      });
      setPosts(res.data?.posts ?? []);
      setEmptyReason((res.data as any)?.empty ?? null);
    } catch { setPosts([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [view]);

  const replace = (p: CommunityPost) => setPosts(list => list.map(x => x.id === p.id ? p : x));

  const publish = async () => {
    if (!form.title.trim()) { toast.error('Give it a title'); return; }
    setSaving(true);
    try {
      // A plain POST is an ARTICLE on the wire — the server knows three kinds,
      // and inventing a fourth for "a short one" would mean a migration, a new
      // badge, and a distinction no reader cares about.
      const kind: CommunityKind = mode === 'POST' ? 'ARTICLE' : mode;
      const targeted = mode === 'DEAL' || mode === 'MEET';
      await communityAPI.create({
        kind,
        ...(isPractitioner ? { authorKind: 'PRACTITIONER' as const } : {}),
        title: form.title.trim(),
        body: form.body.trim() || undefined,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        ...(mode === 'DEAL' ? {
          price: form.price ? Number(form.price) : undefined,
          compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
          endsAt: form.endsAt || undefined,
        } : {}),
        ...(mode === 'MEET' ? {
          startsAt: form.startsAt || undefined,
          venueMode: form.venueMode,
          venueCountry: form.venueMode === 'IN_PERSON' ? (form.venueCountry.trim() || undefined) : undefined,
          venueCity: form.venueMode === 'IN_PERSON' ? (form.venueCity.trim() || undefined) : undefined,
          venueAddress: form.venueMode === 'IN_PERSON' ? (form.venueAddress.trim() || undefined) : undefined,
          venueLink: form.venueMode === 'ONLINE' ? (form.venueLink.trim() || undefined) : undefined,
        } : {}),
        ...(targeted ? {
          audienceCities: form.audienceCities.split(',').map(t => t.trim()).filter(Boolean),
          audienceCountries: form.audienceCountries.split(',').map(t => t.trim()).filter(Boolean),
          audienceRegions: form.audienceRegions ? [form.audienceRegions] : [],
        } : {}),
      });
      toast.success('Posted to Community');
      setOpen(false);
      setForm({
        title: '', body: '', tags: '', price: '', compareAtPrice: '', endsAt: '', startsAt: '',
        venueMode: 'IN_PERSON', venueCountry: '', venueCity: '', venueAddress: '', venueLink: '',
        audienceCities: '', audienceCountries: '', audienceRegions: '',
      });
      await load();
    } catch {
      /* the API layer surfaces the 403 with the upgrade wording */
    } finally { setSaving(false); }
  };

  const removePost = async (p: CommunityPost) => {
    const ok = await dialog.confirm({
      title: `Take down “${p.title}”?`,
      message: 'It stops appearing in the feed. Nothing is deleted — the post stays on record.',
      confirmLabel: 'Take it down',
      variant: 'danger',
    });
    if (!ok) return;
    try { await communityAPI.remove(p.id); await load(); } catch { /* toasted */ }
  };

  const modes: Mode[] = isPractitioner ? ['POST', 'MEET'] : ['POST', 'ARTICLE', 'DEAL', 'MEET'];

  return (
    <div className="flex flex-col gap-3.5 min-w-0">
      {/* ── composer ── */}
      {canPost && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl">
          <div className="flex items-center gap-2.5 p-3.5">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-pine to-seafoam grid place-items-center text-white font-display font-extrabold text-sm shrink-0">
              {avatarLetter}
            </span>
            <button
              onClick={() => setOpen(true)}
              className="flex-1 text-left rounded-full border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-4 py-2.5 text-[13px] text-slate-400"
            >
              Share something with the community…
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 px-3.5 pb-3.5">
            {modes.map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setOpen(true); }}
                className={`rounded-lg border px-2.5 py-1.5 text-[9px] font-display font-extrabold uppercase tracking-widest transition-colors ${
                  open && mode === m
                    ? 'bg-pine text-white border-pine dark:bg-seafoam dark:border-seafoam'
                    : 'border-slate-200 dark:border-zinc-800 text-slate-400 hover:border-seafoam hover:text-seafoam'
                }`}
              >
                {m === 'MEET' ? 'Meet-up' : m.charAt(0) + m.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {open && (
            <div className="border-t border-slate-100 dark:border-zinc-800 p-3.5 flex flex-col gap-2.5">
              <input
                id="community-title"
                className="field-input"
                placeholder={mode === 'DEAL' ? 'What is the offer?' : mode === 'MEET' ? 'What is the meet-up?' : 'Title'}
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
              <textarea
                id="community-body"
                className="field-textarea"
                rows={mode === 'ARTICLE' ? 6 : 3}
                placeholder="What do you want to say?"
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              />

              {mode === 'DEAL' && (
                <div className="grid grid-cols-2 gap-2">
                  <input id="community-price" className="field-input" type="number" placeholder="Price"
                    value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                  <input id="community-was" className="field-input" type="number" placeholder="Was (optional)"
                    value={form.compareAtPrice} onChange={e => setForm(f => ({ ...f, compareAtPrice: e.target.value }))} />
                  <label htmlFor="community-ends" className="col-span-2 text-[9px] font-display font-extrabold uppercase tracking-widest text-slate-400">
                    Offer ends — required
                  </label>
                  <input id="community-ends" className="field-input col-span-2" type="datetime-local"
                    value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} />
                </div>
              )}

              {mode === 'MEET' && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="community-starts" className="text-[9px] font-display font-extrabold uppercase tracking-widest text-slate-400">When — required</label>
                  <input id="community-starts" className="field-input" type="datetime-local"
                    value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} />

                  {/* 216 — a meet-up is somewhere or online, and the two want
                      different fields. "Where" as one free-text line could not
                      be mapped, filtered, or read as "travel or click". */}
                  <span className="text-[9px] font-display font-extrabold uppercase tracking-widest text-slate-400">Where</span>
                  <div className="flex gap-1.5">
                    {(['IN_PERSON', 'ONLINE'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, venueMode: m }))}
                        className={`rounded-lg border px-3 py-1.5 text-[9px] font-display font-extrabold uppercase tracking-widest transition-colors ${
                          form.venueMode === m
                            ? 'bg-seafoam text-white border-seafoam'
                            : 'border-slate-200 dark:border-zinc-800 text-slate-500 hover:border-seafoam'
                        }`}
                      >
                        {m === 'IN_PERSON' ? 'In person' : 'Online'}
                      </button>
                    ))}
                  </div>
                  {form.venueMode === 'IN_PERSON' ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input id="community-country" className="field-input" placeholder="Country (e.g. KE)" maxLength={2}
                          value={form.venueCountry} onChange={e => setForm(f => ({ ...f, venueCountry: e.target.value.toUpperCase() }))} />
                        <input id="community-city" className="field-input" placeholder="City (e.g. Nairobi)"
                          value={form.venueCity} onChange={e => setForm(f => ({ ...f, venueCity: e.target.value }))} />
                      </div>
                      <input id="community-address" className="field-input" placeholder="Physical address — building, street, landmark"
                        value={form.venueAddress} onChange={e => setForm(f => ({ ...f, venueAddress: e.target.value }))} />
                    </>
                  ) : (
                    <input id="community-link" className="field-input" type="url" placeholder="Joining link (Zoom, Meet, Teams…)"
                      value={form.venueLink} onChange={e => setForm(f => ({ ...f, venueLink: e.target.value }))} />
                  )}
                </div>
              )}

              <input id="community-tags" className="field-input" placeholder="Tags, comma separated — these become topics"
                value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />

              {(mode === 'DEAL' || mode === 'MEET') && (
                <div className="pt-2.5 border-t border-dashed border-slate-200 dark:border-zinc-800 flex flex-col gap-2">
                  <span className="text-[9px] font-display font-extrabold uppercase tracking-widest text-slate-400">Who sees this</span>
                  <input id="community-aud-cities" className="field-input" placeholder="Towns and cities — Nairobi, Westlands, Kikuyu"
                    value={form.audienceCities} onChange={e => setForm(f => ({ ...f, audienceCities: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <input id="community-aud-countries" className="field-input" placeholder="Countries — KE, UG"
                      value={form.audienceCountries} onChange={e => setForm(f => ({ ...f, audienceCountries: e.target.value }))} />
                    <select id="community-aud-region" className="field-select"
                      value={form.audienceRegions} onChange={e => setForm(f => ({ ...f, audienceRegions: e.target.value }))}>
                      <option value="">Everywhere</option>
                      {['AFRICA', 'EUROPE', 'ASIA', 'MIDDLE_EAST', 'LATAM', 'NORTH_AMERICA', 'OCEANIA'].map(r => (
                        <option key={r} value={r}>{r.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <p className="text-[11px] font-semibold text-slate-400 leading-relaxed">{MODE_HINT[mode]}</p>

              <div className="flex items-center gap-2">
                <button
                  onClick={publish}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pine to-seafoam text-white text-[10px] font-display font-extrabold uppercase tracking-widest disabled:opacity-50"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : 'Publish'}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 rounded-xl text-[10px] font-display font-extrabold uppercase tracking-widest text-slate-400 hover:text-pine"
                >
                  <X size={13} className="inline mr-1" /> Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── the offer, never a wall: the feed below still reads normally (288) ── */}
      {!canPost && (
        <section className="rounded-2xl border border-pine/25 dark:border-seafoam/25 bg-gradient-to-br from-pine/[0.06] to-seafoam/[0.06] dark:from-pine/15 dark:to-seafoam/10 p-5">
          <p className="text-[9px] font-display font-extrabold uppercase tracking-widest text-pine dark:text-seafoam">
            Reading and replying are free · posting is the add-on
          </p>
          <h2 className="mt-1.5 text-lg font-display font-extrabold text-pine dark:text-zinc-100 leading-tight">
            You can read and reply to everything here. Community Access lets you start the conversation.
          </h2>
          <p className="mt-2 text-[13px] text-slate-600 dark:text-zinc-400 leading-relaxed max-w-2xl">
            Browse the whole feed, reply to anyone, follow whoever you like — all free, for as long
            as you like. Community Access is what adds your own articles, deals and meet-ups to it,
            published under your name to everyone in the room.
          </p>
          <button
            onClick={onGetAccess}
            className="mt-4 px-5 py-3 rounded-xl bg-gradient-to-r from-pine to-seafoam text-white text-xs font-display font-extrabold uppercase tracking-wider shadow-lg shadow-pine/25"
          >
            Get Community Access
          </button>
        </section>
      )}

      {/* ── tabs ── */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => onChangeView(t.key)}
            className={`rounded-xl border px-3.5 py-2 text-[9.5px] font-display font-extrabold uppercase tracking-widest transition-colors ${
              view === t.key
                ? 'bg-pine text-white border-pine dark:bg-seafoam dark:border-seafoam'
                : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-400 hover:border-seafoam hover:text-seafoam'
            }`}
          >
            {t.label}
          </button>
        ))}
        {view.startsWith('tag:') && (
          <span className="inline-flex items-center gap-2 rounded-xl border border-seafoam bg-seafoam/10 px-3.5 py-2 text-[9.5px] font-display font-extrabold uppercase tracking-widest text-seafoam">
            #{view.slice(4)}
            <button onClick={() => onChangeView('all')} className="font-black">×</button>
          </span>
        )}
      </div>

      {loading && <div className="py-16 text-center text-[11px] font-bold text-slate-400">Loading the feed…</div>}

      {!loading && posts.length === 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-10 text-center">
          <Megaphone className="mx-auto mb-3 text-slate-300" size={30} />
          {/* An empty Following tab is not an empty feed, and saying so is the
              only way the reader learns that following does anything. */}
          <p className="text-sm font-display font-extrabold text-pine dark:text-zinc-100">
            {emptyReason === 'NOT_FOLLOWING_ANYONE'
              ? "You're not following anyone yet."
              : view === 'saved' ? 'Nothing saved yet.' : 'Nothing here yet.'}
          </p>
          <p className="mt-1 text-[12px] font-semibold text-slate-400 max-w-md mx-auto leading-relaxed">
            {emptyReason === 'NOT_FOLLOWING_ANYONE'
              ? 'Follow a clinic, a supplier or a topic and this becomes your own feed. Suggestions are on the right.'
              : view === 'saved' ? 'The bookmark on any post keeps it here. Only you can see this.'
              : canPost ? 'Be the first — post an article, a deal, or a meet-up.'
              : 'Clinics and suppliers post here. Check back soon, or reply to something in For you.'}
          </p>
        </div>
      )}

      {posts.map(p => (
        <PostCard
          key={p.id}
          post={p}
          onChange={replace}
          onOpen={onOpenPost}
          onOpenAuthor={onOpenAuthor}
          onOpenTag={t => onChangeView(`tag:${t}`)}
          onOrder={onOrder}
          onRemove={removePost}
          mine={!!currentUserId && String(p.authorUserId) === String(currentUserId)}
        />
      ))}
    </div>
  );
};

export default CommunityFeed;
