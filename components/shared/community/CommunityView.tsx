import React, { useEffect, useMemo, useState } from 'react';
import { Users, Star, Megaphone, Calendar, Tag, Plus, X, Loader2, MapPin, Eye, Trash2 } from 'lucide-react';
import PageHeader from '../common/PageHeader';
import { communityAPI, CommunityPost, CommunityKind, toast, dialog } from '../../../services';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDate } from '../../../services/utils/dateFormatter';

/**
 * Community — clinics, suppliers, practitioners, clients and farm owners in one
 * space (207).
 *
 * The model, as built:
 *   · READING IS PUBLIC. Every signed-in user sees this, free. Clients and farm
 *     owners are what makes the space worth reaching.
 *   · CLINICS AND SUPPLIERS PAY to post — adverts, columns/articles, and deals
 *     they can boost. The server refuses without the add-on; this view surfaces
 *     that refusal rather than hiding the button, so the offer is discoverable.
 *   · PRACTITIONERS post MEET-UPS, free.
 *   · RANKING IS EARNED. A boost buys placement and is labelled "Promoted".
 */

const KIND_TABS: Array<{ key: 'ALL' | CommunityKind; label: string; icon: any }> = [
  { key: 'ALL', label: 'Everything', icon: Users },
  { key: 'ARTICLE', label: 'Articles', icon: Star },
  { key: 'DEAL', label: 'Deals', icon: Tag },
  { key: 'MEET', label: 'Meet-ups', icon: Calendar },
];

const KIND_META: Record<CommunityKind, { label: string; className: string }> = {
  ARTICLE: { label: 'Article', className: 'bg-sky-500/10 text-sky-600 border-sky-500/20' },
  DEAL: { label: 'Deal', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  MEET: { label: 'Meet-up', className: 'bg-violet-500/10 text-violet-600 border-violet-500/20' },
};

const CommunityView: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'ALL' | CommunityKind>('ALL');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const role = String(user?.role || '');
  // A practitioner posts meet-ups; everyone else posts as their business. The
  // server decides entitlement — this only picks the right default form.
  const isPractitioner = role === 'FREELANCER';
  const canOpenComposer = role !== 'CLIENT';

  const [form, setForm] = useState({
    kind: (isPractitioner ? 'MEET' : 'ARTICLE') as CommunityKind,
    title: '', body: '', location: '', startsAt: '', endsAt: '',
    price: '', compareAtPrice: '', tags: '',
  });

  const load = async (kind = tab) => {
    setLoading(true);
    try {
      const res = await communityAPI.feed(kind === 'ALL' ? {} : { kind });
      setPosts(res.data?.posts || []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(tab); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);

  const submit = async () => {
    if (!form.title.trim()) { toast.error('Give it a title'); return; }
    setSaving(true);
    try {
      await communityAPI.create({
        kind: form.kind,
        ...(isPractitioner ? { authorKind: 'PRACTITIONER' as const } : {}),
        title: form.title.trim(),
        body: form.body.trim() || undefined,
        location: form.location.trim() || undefined,
        startsAt: form.startsAt || undefined,
        endsAt: form.endsAt || undefined,
        price: form.price ? Number(form.price) : undefined,
        compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      toast.success('Posted to Community');
      setComposerOpen(false);
      setForm({ ...form, title: '', body: '', location: '', startsAt: '', endsAt: '', price: '', compareAtPrice: '', tags: '' });
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

  const empty = !loading && posts.length === 0;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Users}
        title="Community"
        subtitle="Clinics, suppliers, practitioners, clients and farm owners — one space"
        actions={canOpenComposer ? (
          <button
            onClick={() => setComposerOpen(true)}
            className="compact-button bg-gradient-to-r from-pine to-seafoam text-white px-4 py-2.5 font-black uppercase tracking-wider text-xs shadow-lg shadow-pine/30"
          >
            <Plus size={14} className="inline mr-1" /> Post
          </button>
        ) : undefined}
      />

      <div className="flex flex-wrap items-center gap-2">
        {KIND_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
              tab === t.key
                ? 'bg-pine text-white border-pine dark:bg-seafoam dark:border-seafoam'
                : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-500 hover:border-seafoam hover:text-seafoam'
            }`}
          >
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="py-20 text-center text-[11px] font-bold text-slate-400">Loading the feed…</div>
      )}

      {empty && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-10 text-center">
          <Megaphone className="mx-auto mb-3 text-slate-300" size={32} />
          <p className="text-sm font-black text-pine dark:text-zinc-100">Nothing here yet.</p>
          <p className="mt-1 text-[11px] font-bold text-slate-400 max-w-md mx-auto leading-relaxed">
            {canOpenComposer
              ? 'Be the first — post an article, a deal, or a meet-up.'
              : 'Clinics and suppliers post articles, offers and events here. Check back soon.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {posts.map(p => {
          const meta = KIND_META[p.kind] || KIND_META.ARTICLE;
          const mine = String(p.authorUserId || '') === String((user as any)?.id || '');
          return (
            <article key={p.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-seafoam/10 grid place-items-center text-sm shrink-0 overflow-hidden">
                    {p.authorLogo && p.authorLogo.startsWith('http')
                      ? <img src={p.authorLogo} alt="" className="w-full h-full object-cover" />
                      : (p.authorLogo || p.authorName.charAt(0))}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-black text-pine dark:text-zinc-100 truncate">{p.authorName}</span>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      {p.authorKind === 'PRACTITIONER' ? 'Practitioner' : p.authorKind.toLowerCase()}
                      {p.publishedAt ? ` · ${formatDate(p.publishedAt)}` : ''}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Placement is bought; the reader is always told. */}
                  {p.isPromoted && (
                    <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      Promoted
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${meta.className}`}>
                    {meta.label}
                  </span>
                </div>
              </div>

              {p.mediaUrl && (
                <img src={p.mediaUrl} alt="" className="w-full h-40 object-cover rounded-xl" />
              )}

              <div className="min-w-0">
                <h3 className="text-sm font-black text-pine dark:text-zinc-100 leading-snug">{p.title}</h3>
                {p.body && <p className="mt-1 text-[11px] font-bold text-slate-500 dark:text-zinc-400 leading-relaxed line-clamp-3">{p.body}</p>}
              </div>

              {p.kind === 'DEAL' && p.price != null && (
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-black text-pine dark:text-zinc-100">{p.currency || 'KES'} {p.price.toLocaleString()}</span>
                  {p.compareAtPrice != null && p.compareAtPrice > p.price && (
                    <span className="text-[11px] font-bold text-slate-400 line-through">{p.compareAtPrice.toLocaleString()}</span>
                  )}
                  {p.endsAt && <span className="text-[9px] font-black uppercase tracking-widest text-amber-600">ends {formatDate(p.endsAt)}</span>}
                </div>
              )}

              {p.kind === 'MEET' && (
                <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-500">
                  {p.startsAt && <span className="inline-flex items-center gap-1"><Calendar size={11} /> {formatDate(p.startsAt)}</span>}
                  {p.location && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {p.location}</span>}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-zinc-800">
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400">
                  <Eye size={11} /> {p.viewCount}
                </span>
                <span className="flex items-center gap-1.5">
                  {p.tags.slice(0, 3).map(t => (
                    <span key={t} className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-500">{t}</span>
                  ))}
                  {mine && (
                    <button onClick={() => removePost(p)} title="Take down" className="p-1 rounded-lg text-slate-300 hover:text-rose-500">
                      <Trash2 size={13} />
                    </button>
                  )}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      {/* Composer */}
      {composerOpen && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !saving && setComposerOpen(false)}>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <p className="text-sm font-black uppercase tracking-tight text-pine dark:text-zinc-100">New post</p>
              <button onClick={() => setComposerOpen(false)} className="p-1 text-slate-400 hover:text-pine"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto">
              <div className="flex items-center gap-2">
                {(isPractitioner ? (['MEET'] as CommunityKind[]) : (['ARTICLE', 'DEAL', 'MEET'] as CommunityKind[])).map(k => (
                  <button
                    key={k}
                    onClick={() => setForm(f => ({ ...f, kind: k }))}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                      form.kind === k ? 'bg-pine text-white border-pine dark:bg-seafoam' : 'border-slate-200 dark:border-zinc-700 text-slate-500'
                    }`}
                  >
                    {KIND_META[k].label}
                  </button>
                ))}
              </div>
              {isPractitioner && (
                <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
                  Practitioners post meet-ups. Articles and deals are posted by a clinic or supplier.
                </p>
              )}

              <input className="field-input" placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              <textarea className="field-textarea" rows={4} placeholder="Write something…" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />

              {form.kind === 'DEAL' && (
                <div className="grid grid-cols-2 gap-2">
                  <input className="field-input" type="number" placeholder="Price" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                  <input className="field-input" type="number" placeholder="Was (optional)" value={form.compareAtPrice} onChange={e => setForm(f => ({ ...f, compareAtPrice: e.target.value }))} />
                  <label className="col-span-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Offer ends — required</label>
                  <input className="field-input col-span-2" type="datetime-local" value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} />
                </div>
              )}

              {form.kind === 'MEET' && (
                <div className="grid grid-cols-1 gap-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">When — required</label>
                  <input className="field-input" type="datetime-local" value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} />
                  <input className="field-input" placeholder="Where" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                </div>
              )}

              <input className="field-input" placeholder="Tags, comma separated" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
              <button onClick={() => setComposerOpen(false)} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500">Cancel</button>
              <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-xl bg-gradient-to-r from-pine to-seafoam text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                {saving ? <Loader2 size={13} className="animate-spin" /> : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityView;
