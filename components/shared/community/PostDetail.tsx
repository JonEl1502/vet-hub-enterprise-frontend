import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Flag, Trash2, EyeOff, ThumbsUp, CornerDownRight } from 'lucide-react';
import { communityAPI, CommunityComment, CommunityPost, toast, dialog } from '../../../services';
import { formatDate } from '../../../services/utils/dateFormatter';
import PostCard from './PostCard';

/**
 * A post and its thread (297).
 *
 * ⚠️ REPLYING IS FREE TO EVERY SIGNED-IN USER — clients and farm owners
 * included. The add-on gates ORIGINATING a post, never answering one. A reader
 * who cannot reply is an audience, not a community, and this screen is where
 * that distinction is actually cashed.
 *
 * ⚠️ ONE LEVEL OF NESTING. The server flattens a reply-to-a-reply onto the
 * top-level comment; this renders the same shape. Arbitrary depth becomes
 * unreadable on a phone at about level three and unmoderatable shortly after.
 *
 * HIDDEN comments render as TOMBSTONES rather than disappearing: a reply that
 * answers a vanished message makes no sense, and a thread that silently loses
 * a post reads as a bug to everyone except the moderator who removed it.
 */

interface Props {
  post: CommunityPost;
  onBack: () => void;
  onChange: (post: CommunityPost) => void;
  onOpenAuthor: (post: CommunityPost) => void;
  onOpenTag: (tag: string) => void;
  onOrder?: (post: CommunityPost, items: CommunityPost['items']) => void;
  /** True when the signed-in user wrote the post — unlocks Hide on replies. */
  ownsPost: boolean;
}

const PostDetail: React.FC<Props> = ({ post, onBack, onChange, onOpenAuthor, onOpenTag, onOrder, ownsPost }) => {
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<CommunityComment | null>(null);
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await communityAPI.comments(post.id);
      setComments(res.data?.comments ?? []);
    } catch { setComments([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [post.id]);

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      await communityAPI.addComment(post.id, { body: text, parentId: replyTo?.id ?? null });
      setBody('');
      setReplyTo(null);
      onChange({ ...post, commentCount: post.commentCount + 1 });
      await load();
    } catch { /* toasted */ } finally { setSending(false); }
  };

  const helpful = async (c: CommunityComment) => {
    // Optimistic, then replaced by the server's number — never added on top of
    // the guess, or a slow network double-counts.
    setComments(list => list.map(x => x.id === c.id
      ? { ...x, viewerFoundHelpful: !x.viewerFoundHelpful, helpfulCount: x.helpfulCount + (x.viewerFoundHelpful ? -1 : 1) }
      : x));
    try {
      const res = await communityAPI.commentHelpful(c.id);
      if (res.data) {
        setComments(list => list.map(x => x.id === c.id
          ? { ...x, viewerFoundHelpful: res.data!.on, helpfulCount: res.data!.helpfulCount } : x));
      }
    } catch {
      setComments(list => list.map(x => x.id === c.id
        ? { ...x, viewerFoundHelpful: c.viewerFoundHelpful, helpfulCount: c.helpfulCount } : x));
    }
  };

  const takeDown = async (c: CommunityComment) => {
    const ok = await dialog.confirm({
      title: c.mine ? 'Delete your reply?' : 'Hide this reply on your post?',
      message: c.mine
        ? 'It stops showing in the thread. Nothing else changes.'
        : 'It stops showing to everyone. The reply stays on record, and the person is not told who hid it.',
      confirmLabel: c.mine ? 'Delete it' : 'Hide it',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await communityAPI.removeComment(c.id);
      onChange({ ...post, commentCount: Math.max(0, post.commentCount - 1) });
      await load();
    } catch { /* toasted */ }
  };

  const report = async (c: CommunityComment) => {
    const ok = await dialog.confirm({
      title: 'Report this reply?',
      message: 'A moderator will look at it. Your name is not shown to the author.',
      confirmLabel: 'Report it',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await communityAPI.report({ commentId: c.id });
      toast.success('Thanks — a moderator will look at this');
    } catch { /* toasted */ }
  };

  const tops = comments.filter(c => !c.parentId);
  const repliesOf = (id: string) => comments.filter(c => c.parentId === id);

  const Comment: React.FC<{ c: CommunityComment; nested?: boolean }> = ({ c, nested }) => (
    <div className={`flex items-start gap-3 py-3 border-t border-slate-100 dark:border-zinc-800 ${nested ? 'ml-9' : ''}`}>
      <span className="w-7 h-7 rounded-lg bg-seafoam/10 grid place-items-center text-[10px] font-black text-pine dark:text-seafoam shrink-0 overflow-hidden">
        {c.authorAvatar && c.authorAvatar.startsWith('http')
          ? <img src={c.authorAvatar} alt="" className="w-full h-full object-cover" />
          : c.authorName.charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-display font-bold text-pine dark:text-zinc-100">{c.authorName}</span>
          <span className="px-1.5 py-px rounded text-[8px] font-black uppercase tracking-widest border border-slate-200 dark:border-zinc-700 text-slate-400">
            {c.authorRole}
          </span>
          {String(c.authorUserId) === String(post.authorUserId) && (
            <span className="px-1.5 py-px rounded text-[8px] font-black uppercase tracking-widest bg-seafoam/10 text-seafoam border border-seafoam/25">Author</span>
          )}
          <span className="text-[10px] font-semibold text-slate-400">{formatDate(c.createdAt)}</span>
        </div>

        {c.hidden ? (
          <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] italic font-semibold text-slate-400">
            <EyeOff size={12} /> This reply was hidden by a moderator.
          </p>
        ) : (
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600 dark:text-zinc-400 whitespace-pre-line">{c.body}</p>
        )}

        {!c.hidden && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            <button
              onClick={() => helpful(c)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold ${
                c.viewerFoundHelpful ? 'text-seafoam bg-seafoam/10' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800/60'
              }`}
            >
              <ThumbsUp size={12} /> Helpful{c.helpfulCount > 0 ? ` · ${c.helpfulCount}` : ''}
            </button>
            {!nested && (
              <button
                onClick={() => setReplyTo(c)}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800/60"
              >
                <CornerDownRight size={12} /> Reply
              </button>
            )}
            {(c.mine || ownsPost) && (
              <button
                onClick={() => takeDown(c)}
                title={c.mine ? 'Delete your reply' : 'Hide on my post'}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-300 hover:text-rose-500"
              >
                {c.mine ? <Trash2 size={12} /> : <EyeOff size={12} />}
              </button>
            )}
            {!c.mine && (
              <button onClick={() => report(c)} title="Report" className="p-1 rounded-lg text-slate-300 hover:text-rose-500">
                <Flag size={11} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3.5 min-w-0">
      <button onClick={onBack} className="self-start inline-flex items-center gap-1.5 text-[9.5px] font-display font-extrabold uppercase tracking-widest text-slate-400 hover:text-seafoam">
        <ArrowLeft size={13} /> Back to the feed
      </button>

      <PostCard
        post={post}
        expanded
        onChange={onChange}
        onOpen={() => {}}
        onOpenAuthor={onOpenAuthor}
        onOpenTag={onOpenTag}
        onOrder={onOrder}
        mine={ownsPost}
      />

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <h4 className="text-[9px] font-display font-extrabold uppercase tracking-[0.14em] text-slate-400">
            {comments.length} {comments.length === 1 ? 'reply' : 'replies'}
          </h4>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-seafoam/10 px-2 py-1 text-[11px] font-bold text-seafoam">
            Free to reply — no add-on needed
          </span>
        </div>

        {loading ? (
          <p className="py-8 text-center text-[11px] font-bold text-slate-400">Loading the thread…</p>
        ) : tops.length === 0 ? (
          <p className="py-8 text-center text-[12px] font-semibold text-slate-400">
            No replies yet. Ask the first question — the author gets told.
          </p>
        ) : (
          <div className="flex flex-col">
            {tops.map(c => (
              <React.Fragment key={c.id}>
                <Comment c={c} />
                {repliesOf(c.id).map(r => <Comment key={r.id} c={r} nested />)}
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="pt-3 mt-1 border-t border-slate-100 dark:border-zinc-800">
          {replyTo && (
            <p className="mb-2 inline-flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-zinc-800/60 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
              <CornerDownRight size={12} /> Replying to {replyTo.authorName}
              <button onClick={() => setReplyTo(null)} className="font-black text-slate-400 hover:text-rose-500">×</button>
            </p>
          )}
          <div className="flex items-center gap-2.5">
            <input
              id="community-reply"
              className="field-input flex-1 !rounded-full"
              placeholder={replyTo ? `Reply to ${replyTo.authorName}…` : 'Write a reply…'}
              value={body}
              onChange={e => setBody(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button
              onClick={send}
              disabled={sending || !body.trim()}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-gradient-to-r from-pine to-seafoam text-white text-[10px] font-display font-extrabold uppercase tracking-widest disabled:opacity-40"
            >
              {sending ? <Loader2 size={13} className="animate-spin" /> : 'Reply'}
            </button>
          </div>
          <p className="mt-2 text-[10.5px] font-semibold text-slate-400 leading-relaxed">
            Every reply carries Report. The author of a post can hide a reply on their own post.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PostDetail;
