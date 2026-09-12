import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar, MapPin, Eye, Trash2, ShoppingCart, ThumbsUp, HandHeart,
  Bookmark, MessageCircle, Share2, Plus, Flag,
} from 'lucide-react';
import { communityAPI, CommunityPost, toast, dialog } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';
import { PACKS, packFor } from './packs';

/**
 * One post in the feed (297).
 *
 * ── The reaction row is TWO layers and only one of them counts ────────────
 *   · HELPFUL and THANKS are the signal layer. Helpful is what a profile
 *     totals and what an honest ranking sorts on, next to placement that was
 *     bought and is always labelled "Promoted".
 *   · The ANIMAL PACK is the warmth layer, for the recovery photos and the
 *     herd shots nobody wants to press "Helpful" on.
 *
 * ⚠️ They are rendered differently ON PURPOSE: the signal layer is icon +
 * label + count in the row, the warmth layer is a tally of pills ABOVE the
 * row. Two visual weights for two different meanings — if they looked alike,
 * readers would treat a dog and a Helpful as the same vote, which is exactly
 * what the server refuses to do when it counts them.
 *
 * ── Everything here is free ───────────────────────────────────────────────
 * Reacting, replying, saving and following need no add-on. The add-on gates
 * ORIGINATING a post. A reader who cannot reply is an audience, not a
 * community.
 */

const KIND_META: Record<string, { label: string; className: string }> = {
  ARTICLE: { label: 'Article', className: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/25' },
  DEAL: { label: 'Deal', className: 'bg-amber-500/10 text-amber-600 border-amber-500/25' },
  MEET: { label: 'Meet-up', className: 'bg-violet-500/10 text-violet-600 border-violet-500/25' },
};

interface Props {
  post: CommunityPost;
  /** Replaces the post in the parent's list — counts are optimistic locally. */
  onChange: (post: CommunityPost) => void;
  onOpen: (post: CommunityPost) => void;
  onOpenAuthor: (post: CommunityPost) => void;
  onOpenTag?: (tag: string) => void;
  onOrder?: (post: CommunityPost, items: CommunityPost['items']) => void;
  onRemove?: (post: CommunityPost) => void;
  /** True when the signed-in user wrote it — shows the take-down control. */
  mine?: boolean;
  /** Full body and no "read replies" link — used by the detail page. */
  expanded?: boolean;
}

const PostCard: React.FC<Props> = ({
  post, onChange, onOpen, onOpenAuthor, onOpenTag, onOrder, onRemove, mine, expanded,
}) => {
  const meta = KIND_META[post.kind] || KIND_META.ARTICLE;
  const [packOpen, setPackOpen] = useState(false);
  const packRef = useRef<HTMLDivElement | null>(null);
  const pack = PACKS[packFor(post.tags, post.title)];

  // A picker that stays open behind the next card is a picker that swallows
  // the next click. Close on anything outside it, and on Escape.
  useEffect(() => {
    if (!packOpen) return;
    const away = (e: MouseEvent) => {
      if (packRef.current && !packRef.current.contains(e.target as Node)) setPackOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPackOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [packOpen]);

  /**
   * ⚠️ OPTIMISTIC, then reconciled with the server's own numbers.
   *
   * The button must respond on the press — a reaction that waits for a round
   * trip feels broken and gets pressed twice, which is a toggle, which undoes
   * it. So the count moves immediately and is then REPLACED by what the server
   * returns, never incremented again on top of the guess.
   */
  const react = async (kind: 'HELPFUL' | 'THANKS' | 'EMOJI', emoji?: string) => {
    const key = kind === 'HELPFUL' ? 'viewerHelpful' : 'viewerThanks';
    const countKey = kind === 'HELPFUL' ? 'helpfulCount' : 'thanksCount';

    if (kind !== 'EMOJI') {
      const on = !(post as any)[key];
      onChange({ ...post, [key]: on, [countKey]: Math.max(0, (post as any)[countKey] + (on ? 1 : -1)) } as CommunityPost);
    }
    try {
      const res = await communityAPI.react(post.id, { kind, emoji });
      const d = res.data;
      if (!d) return;
      onChange({
        ...post,
        helpfulCount: d.helpfulCount,
        thanksCount: d.thanksCount,
        reactionCount: d.reactionCount,
        emojis: d.emojis,
        viewerHelpful: kind === 'HELPFUL' ? d.on : post.viewerHelpful,
        viewerThanks: kind === 'THANKS' ? d.on : post.viewerThanks,
        viewerEmojis: kind === 'EMOJI'
          ? (d.on
              ? [...post.viewerEmojis, String(emoji)]
              : post.viewerEmojis.filter((e) => e !== emoji))
          : post.viewerEmojis,
      });
    } catch {
      // Put the guess back. A counter that stays wrong after a failed write is
      // worse than one that never moved.
      if (kind !== 'EMOJI') onChange({ ...post });
    }
  };

  const save = async () => {
    const on = !post.viewerSaved;
    onChange({ ...post, viewerSaved: on });
    try {
      const res = await communityAPI.save(post.id);
      if (res.data) onChange({ ...post, viewerSaved: res.data.saved });
      toast.success(on ? 'Saved' : 'Removed from saved');
    } catch { onChange({ ...post, viewerSaved: !on }); }
  };

  const share = async () => {
    const url = `${window.location.origin}/app/community/${post.id}`;
    try {
      if (navigator.share) { await navigator.share({ title: post.title, url }); return; }
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch { /* the reader cancelled the share sheet — not an error */ }
  };

  const report = async () => {
    const ok = await dialog.confirm({
      title: 'Report this post?',
      message: 'A moderator will look at it. Your name is not shown to the author.',
      confirmLabel: 'Report it',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await communityAPI.report({ postId: post.id });
      toast.success('Thanks — a moderator will look at this');
    } catch { /* toasted by the API layer */ }
  };

  const authorRole = post.authorKind === 'PRACTITIONER'
    ? 'Practitioner'
    : post.authorKind.charAt(0) + post.authorKind.slice(1).toLowerCase();

  return (
    <article className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
      {/* ── who ── */}
      <div className="flex items-start gap-3 px-4 pt-4">
        <button
          onClick={() => onOpenAuthor(post)}
          className="w-10 h-10 rounded-xl bg-seafoam/10 grid place-items-center text-sm shrink-0 overflow-hidden font-black text-pine dark:text-seafoam"
          title={`See everything from ${post.authorName}`}
        >
          {post.authorLogo && post.authorLogo.startsWith('http')
            ? <img src={post.authorLogo} alt="" className="w-full h-full object-cover" />
            : post.authorName.charAt(0)}
        </button>
        <div className="min-w-0 flex-1">
          <button
            onClick={() => onOpenAuthor(post)}
            className="block text-[13px] font-black text-pine dark:text-zinc-100 truncate hover:text-seafoam text-left"
          >
            {post.authorName}
          </button>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
            {authorRole}{post.publishedAt ? ` · ${formatDate(post.publishedAt)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Placement is bought; the reader is always told. */}
          {post.isPromoted && (
            <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border border-emerald-500/25">
              Promoted
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${meta.className}`}>
            {meta.label}
          </span>
        </div>
      </div>

      {/* ── what ── */}
      <div className="px-4 pt-3">
        <button onClick={() => onOpen(post)} className="text-left w-full">
          <h3 className="text-[15px] font-black text-pine dark:text-zinc-100 leading-snug">{post.title}</h3>
        </button>
        {post.body && (
          <p className={`mt-1.5 text-[13px] text-slate-600 dark:text-zinc-400 leading-relaxed whitespace-pre-line ${expanded ? '' : 'line-clamp-4'}`}>
            {post.body}
          </p>
        )}
      </div>

      {post.mediaUrl && <img src={post.mediaUrl} alt="" className="w-full max-h-96 object-cover mt-3" />}

      {post.kind === 'DEAL' && post.price != null && (
        <div className="flex items-baseline gap-2.5 px-4 pt-3 flex-wrap">
          <span className="text-lg font-black text-pine dark:text-zinc-100">
            {post.currency || 'KES'} {post.price.toLocaleString()}
          </span>
          {post.compareAtPrice != null && post.compareAtPrice > post.price && (
            <span className="text-[12px] font-bold text-slate-400 line-through">{post.compareAtPrice.toLocaleString()}</span>
          )}
          {post.endsAt && (
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-600">ends {formatDate(post.endsAt)}</span>
          )}
        </div>
      )}

      {/* Products on the deal. Clicking one carries it — at the OFFER price,
          not the list price — into a pre-filled purchase order. */}
      {post.items.length > 0 && onOrder && (
        <div className="mx-4 mt-3 rounded-xl border border-slate-200 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800">
          {post.items.slice(0, 4).map(it => (
            <button
              key={it.id}
              type="button"
              onClick={() => onOrder(post, [it])}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
              title="Start a purchase order for this product"
            >
              <span className="min-w-0">
                <span className="block text-[12px] font-black text-pine dark:text-zinc-100 truncate">{it.name}</span>
                <span className="block text-[10px] font-bold text-slate-400">
                  {[it.sku, it.unit, it.quantity > 1 ? `min ${it.quantity}` : ''].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[12px] font-black text-pine dark:text-zinc-100">
                  {(it.currency || post.currency || 'KES')} {(it.dealPrice ?? it.listPrice ?? 0).toLocaleString()}
                </span>
                {it.dealPrice != null && it.listPrice != null && it.listPrice > it.dealPrice && (
                  <span className="block text-[10px] font-bold text-slate-400 line-through">{it.listPrice.toLocaleString()}</span>
                )}
              </span>
            </button>
          ))}
          {post.items.length > 4 && (
            <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400">+{post.items.length - 4} more in this deal</p>
          )}
          <button
            type="button"
            onClick={() => onOrder(post, post.items)}
            className="w-full px-3 py-2 text-[9px] font-black uppercase tracking-widest text-seafoam hover:bg-seafoam/5 flex items-center justify-center gap-1.5"
          >
            <ShoppingCart size={12} /> Order everything in this deal
          </button>
        </div>
      )}

      {post.kind === 'MEET' && (
        <div className="flex flex-wrap items-center gap-4 px-4 pt-3 text-[11px] font-bold text-slate-500 dark:text-zinc-400">
          {post.startsAt && <span className="inline-flex items-center gap-1.5"><Calendar size={12} /> {formatDate(post.startsAt)}</span>}
          {/* An ONLINE meet-up's "where" is a link you click, not a place you
              travel to — render it as one (216). */}
          {post.venueMode === 'ONLINE' && post.venueLink ? (
            <a href={post.venueLink} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-seafoam hover:underline">
              <MapPin size={12} /> Join online
            </a>
          ) : post.location ? (
            <span className="inline-flex items-center gap-1.5"><MapPin size={12} /> {post.location}</span>
          ) : null}
        </div>
      )}

      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {post.tags.slice(0, 5).map(t => (
            <button
              key={t}
              onClick={() => onOpenTag?.(t)}
              className="px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-seafoam"
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* ── warmth layer: the animal tally, above the row and visually unlike it ── */}
      {post.emojis.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3">
          {post.emojis.map(e => (
            <button
              key={e.emoji}
              onClick={() => react('EMOJI', e.emoji)}
              title={post.viewerEmojis.includes(e.emoji) ? 'Take yours back' : `React ${e.emoji}`}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold transition-colors ${
                post.viewerEmojis.includes(e.emoji)
                  ? 'border-seafoam/40 bg-seafoam/10 text-seafoam'
                  : 'border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 hover:border-seafoam/40'
              }`}
            >
              <span className="text-[13px] leading-none">{e.emoji}</span> {e.count}
            </button>
          ))}
        </div>
      )}

      {/* ── signal layer ── */}
      <div className="mt-3 px-2 py-1 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-0.5 flex-wrap">
        <button
          onClick={() => react('HELPFUL')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11.5px] font-bold transition-colors ${
            post.viewerHelpful ? 'text-seafoam bg-seafoam/10' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/60'
          }`}
        >
          <ThumbsUp size={14} /> Helpful {post.helpfulCount > 0 && <b className="font-black">{post.helpfulCount}</b>}
        </button>
        <button
          onClick={() => react('THANKS')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11.5px] font-bold transition-colors ${
            post.viewerThanks ? 'text-seafoam bg-seafoam/10' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/60'
          }`}
        >
          <HandHeart size={14} /> Thanks {post.thanksCount > 0 && <b className="font-black">{post.thanksCount}</b>}
        </button>

        <div className="relative" ref={packRef}>
          <button
            onClick={() => setPackOpen(v => !v)}
            title="React with an animal"
            aria-expanded={packOpen}
            className="inline-flex items-center px-2.5 py-2 rounded-lg text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800/60 hover:text-seafoam"
          >
            <Plus size={14} />
          </button>
          {packOpen && (
            <div className="absolute bottom-full left-0 mb-2 z-40 w-max max-w-[min(20rem,80vw)] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl p-2.5">
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5 px-1">
                {pack.label} — ordered for this post
              </p>
              <div className="flex flex-wrap gap-0.5">
                {pack.emojis.map(e => (
                  <button
                    key={e}
                    onClick={() => { react('EMOJI', e); setPackOpen(false); }}
                    className="text-xl leading-none px-1.5 py-1 rounded-lg hover:bg-seafoam/10 hover:-translate-y-0.5 transition-transform"
                  >
                    {e}
                  </button>
                ))}
              </div>
              <p className="mt-2 pt-1.5 border-t border-slate-100 dark:border-zinc-800 text-[10px] font-bold text-slate-400 px-1 leading-relaxed">
                Warmth only — animal reactions never affect ranking. Helpful does.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={() => onOpen(post)}
          className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11.5px] font-bold text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/60"
        >
          <MessageCircle size={14} /> {post.commentCount > 0 && <b className="font-black">{post.commentCount}</b>}
        </button>
        <button
          onClick={share}
          className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11.5px] font-bold text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/60"
        >
          <Share2 size={14} />
        </button>
        <button
          onClick={save}
          title={post.viewerSaved ? 'Remove from saved' : 'Save for later'}
          className={`inline-flex items-center px-2.5 py-2 rounded-lg transition-colors ${
            post.viewerSaved ? 'text-cyan-600 bg-cyan-500/10' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800/60'
          }`}
        >
          <Bookmark size={14} fill={post.viewerSaved ? 'currentColor' : 'none'} />
        </button>

        <span className="ml-auto inline-flex items-center gap-3 pr-2">
          {mine ? (
            onRemove && (
              <button onClick={() => onRemove(post)} title="Take down" className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500">
                <Trash2 size={14} />
              </button>
            )
          ) : (
            <button onClick={report} title="Report" className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500">
              <Flag size={13} />
            </button>
          )}
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
            <Eye size={12} /> {post.viewCount}
          </span>
        </span>
      </div>
    </article>
  );
};

export default PostCard;
