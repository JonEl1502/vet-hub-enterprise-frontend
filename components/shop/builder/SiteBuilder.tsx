import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown, ArrowUp, Copy, GripVertical, Home, Loader2, Lock, Plus, Trash2, Upload, X,
} from 'lucide-react';
import type {
  PublicShop, PublicShopProduct, ShopSite, SiteBlock, SitePage, BlockType,
} from '../../../services/modules/supplierShop.api';
import { toast, uploadsAPI } from '../../../services';
import { BLOCK_DEFS, BlockView, blockDef, type BlockCtx } from '../blocks';
import { ShopCtx } from '../ShopParts';

/**
 * The page builder (325): the owner's own pages, made by dragging blocks.
 *
 * User, 2026-11-13: "drag and drop where they can drag and drop components to
 * formulate their own page … their own small website inside VetHub Core."
 *
 *  · Left: the blocks. Drag one onto the page, or tap it to add at the end.
 *  · Middle: the page, drawn by the same BlockView customers see. Drag a
 *    block by its handle to move it; the arrows do the same on a phone.
 *  · Right: the selected block's settings.
 *
 * Everything stays in this screen until Save. The server rebuilds and checks
 * the document (shopSite.ts), so the editor can be generous.
 */

const uid = () => Math.random().toString(36).slice(2, 12);
const slugOf = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

const STARTER: SitePage = {
  id: uid(),
  slug: 'about',
  title: 'About us',
  inNav: true,
  blocks: [
    { id: uid(), type: 'hero', props: { ...blockDef('hero').defaults, title: 'About us', buttonLabel: 'See our products' } },
    { id: uid(), type: 'text', props: { ...blockDef('text').defaults } },
    { id: uid(), type: 'contact', props: { ...blockDef('contact').defaults } },
  ],
};

interface Props {
  initial: ShopSite | null;
  shop: PublicShop;
  products: PublicShopProduct[];
  popularIds: string[];
  accent: string;
  /** Whether the plan lets the owner save. */
  canSave: boolean;
  lockNote: string;
  onUpgrade: () => void;
  save: (site: ShopSite) => Promise<boolean>;
  onClose: () => void;
}

const FIELD = 'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[16px] sm:text-[13px] outline-none focus:border-slate-400 text-slate-900';
const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="block text-[11.5px] font-semibold text-slate-600 mb-1">{children}</span>
);

const ImageField: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const [busy, setBusy] = useState(false);
  return (
    <div>
      {value ? <img src={value} alt="" className="w-full h-28 object-cover rounded-lg border border-slate-200" /> : null}
      <div className="mt-1.5 flex gap-2">
        <label className="h-9 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} {value ? 'Replace' : 'Upload photo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              try {
                const r = await uploadsAPI.upload(f, 'misc');
                onChange(r.publicUrl);
              } catch (err: any) {
                toast.error(err?.message || 'Could not upload the photo');
              } finally {
                setBusy(false);
                e.target.value = '';
              }
            }}
          />
        </label>
        {value && <button onClick={() => onChange('')} className="h-9 px-3 rounded-lg border border-slate-200 text-[12px] text-slate-600">Remove</button>}
      </div>
    </div>
  );
};

/** The settings of one block. */
const Inspector: React.FC<{
  block: SiteBlock;
  categories: string[];
  pages: SitePage[];
  onChange: (props: Record<string, any>) => void;
}> = ({ block, categories, pages, onChange }) => {
  const p = block.props;
  const set = (k: string, v: any) => onChange({ ...p, [k]: v });
  const text = (k: string, label: string, max = 140) => (
    <label className="block"><Label>{label}</Label><input value={p[k] ?? ''} maxLength={max} onChange={(e) => set(k, e.target.value)} className={FIELD} /></label>
  );
  const area = (k: string, label: string, max = 4000, rows = 4) => (
    <label className="block"><Label>{label}</Label><textarea value={p[k] ?? ''} maxLength={max} rows={rows} onChange={(e) => set(k, e.target.value)} className={`${FIELD} resize-y`} /></label>
  );
  const choice = (k: string, label: string, opts: [string, string][]) => (
    <div><Label>{label}</Label>
      <div className="flex gap-1.5">
        {opts.map(([v, l]) => (
          <button key={v} onClick={() => set(k, v)} className={`h-8 px-3 rounded-lg text-[12px] font-semibold border ${p[k] === v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>{l}</button>
        ))}
      </div>
    </div>
  );
  const linkField = (k: string, label: string) => (
    <label className="block"><Label>{label}</Label>
      <select value={pages.some((pg) => pg.slug === p[k]) || p[k] === 'products' || !p[k] ? (p[k] ?? '') : '__url'} onChange={(e) => set(k, e.target.value === '__url' ? 'https://' : e.target.value)} className={FIELD}>
        <option value="">No link</option>
        <option value="products">Your products</option>
        {pages.map((pg) => <option key={pg.id} value={pg.slug}>{pg.title}</option>)}
        <option value="__url">A web address…</option>
      </select>
      {p[k] && !pages.some((pg) => pg.slug === p[k]) && p[k] !== 'products' && (
        <input value={p[k]} onChange={(e) => set(k, e.target.value)} className={`${FIELD} mt-1.5`} placeholder="https://…" />
      )}
    </label>
  );
  const list = (fields: [string, string, boolean][], blank: Record<string, string>, addLabel: string) => (
    <div className="space-y-2.5">
      {(p.items ?? []).map((it: any, i: number) => (
        <div key={i} className="rounded-lg border border-slate-200 p-2.5 space-y-1.5 bg-slate-50">
          {fields.map(([k, label, multi]) =>
            multi ? (
              <textarea key={k} value={it[k] ?? ''} rows={2} placeholder={label} onChange={(e) => set('items', p.items.map((x: any, j: number) => (j === i ? { ...x, [k]: e.target.value } : x)))} className={`${FIELD} resize-y`} />
            ) : (
              <input key={k} value={it[k] ?? ''} placeholder={label} onChange={(e) => set('items', p.items.map((x: any, j: number) => (j === i ? { ...x, [k]: e.target.value } : x)))} className={FIELD} />
            ),
          )}
          <button onClick={() => set('items', p.items.filter((_: any, j: number) => j !== i))} className="text-[11.5px] font-semibold text-rose-600">Remove</button>
        </div>
      ))}
      {(p.items ?? []).length < 20 && (
        <button onClick={() => set('items', [...(p.items ?? []), blank])} className="h-8 px-3 rounded-lg border border-dashed border-slate-300 text-[12px] font-semibold text-slate-600">+ {addLabel}</button>
      )}
    </div>
  );

  switch (block.type) {
    case 'hero':
      return (
        <div className="space-y-3">
          {text('eyebrow', 'Small line above (optional)', 60)}
          {text('title', 'Headline')}
          {area('body', 'Intro', 600, 3)}
          <div><Label>Background photo (optional)</Label><ImageField value={p.image ?? ''} onChange={(v) => set('image', v)} /></div>
          {text('buttonLabel', 'Button text', 40)}
          {linkField('buttonLink', 'Button goes to')}
          {choice('align', 'Text', [['left', 'Left'], ['center', 'Centre']])}
          {!p.image && (
            <label className="flex items-center gap-2 text-[13px] text-slate-700"><input type="checkbox" checked={!!p.dark} onChange={(e) => set('dark', e.target.checked)} className="w-4 h-4" /> Dark background</label>
          )}
        </div>
      );
    case 'text':
      return <div className="space-y-3">{text('title', 'Heading')}{area('body', 'Text', 4000, 8)}{choice('align', 'Align', [['left', 'Left'], ['center', 'Centre']])}</div>;
    case 'image':
      return (
        <div className="space-y-3">
          <div><Label>Photo</Label><ImageField value={p.image ?? ''} onChange={(v) => set('image', v)} /></div>
          {text('caption', 'Caption (optional)', 200)}
          {linkField('link', 'Tapping it goes to')}
          {choice('height', 'Height', [['short', 'Short'], ['tall', 'Tall']])}
        </div>
      );
    case 'offers':
    case 'popular':
      return (
        <div className="space-y-3">
          {text('title', 'Heading', 80)}
          <label className="block"><Label>How many</Label><input type="number" min={2} max={12} value={p.limit ?? 4} onChange={(e) => set('limit', Number(e.target.value))} className={FIELD} /></label>
        </div>
      );
    case 'products':
      return (
        <div className="space-y-3">
          {text('title', 'Heading', 80)}
          <label className="block"><Label>Which products</Label>
            <select value={p.category ?? ''} onChange={(e) => set('category', e.target.value)} className={FIELD}>
              <option value="">All products</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block"><Label>How many</Label><input type="number" min={2} max={48} value={p.limit ?? 8} onChange={(e) => set('limit', Number(e.target.value))} className={FIELD} /></label>
        </div>
      );
    case 'categories':
      return <div className="space-y-3">{text('title', 'Heading', 80)}<p className="text-[12px] text-slate-500">Shows every category you sell, with a photo from it.</p></div>;
    case 'contact':
      return (
        <div className="space-y-3">
          {text('title', 'Heading', 80)}
          <label className="flex items-center gap-2 text-[13px] text-slate-700"><input type="checkbox" checked={!!p.showMap} onChange={(e) => set('showMap', e.target.checked)} className="w-4 h-4" /> Show a map of your address</label>
          <p className="text-[12px] text-slate-500">Hours, branches and phone come from Shop page settings.</p>
        </div>
      );
    case 'faq':
      return <div className="space-y-3">{text('title', 'Heading', 80)}{list([['q', 'Question', false], ['a', 'Answer', true]], { q: '', a: '' }, 'Add a question')}</div>;
    case 'quotes':
      return <div className="space-y-3">{text('title', 'Heading', 80)}{list([['text', 'What they said', true], ['name', 'Name', false]], { text: '', name: '' }, 'Add a quote')}</div>;
    case 'sendList':
      return <div className="space-y-3">{choice('kind', 'Asks for', [['list', 'A shopping list'], ['prescription', 'A prescription']])}</div>;
    case 'divider':
      return choice('size', 'Space', [['small', 'Small'], ['large', 'Large']]);
    default:
      return null;
  }
};

const SiteBuilder: React.FC<Props> = ({ initial, shop, products, popularIds, accent, canSave, lockNote, onUpgrade, save, onClose }) => {
  const [site, setSite] = useState<ShopSite>(() =>
    initial?.pages?.length ? JSON.parse(JSON.stringify(initial)) : { pages: [STARTER], home: null },
  );
  const [pageId, setPageId] = useState(site.pages[0]?.id ?? '');
  const [selected, setSelected] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(!initial?.pages?.length);
  const [saving, setSaving] = useState(false);

  const page = site.pages.find((p) => p.id === pageId) ?? site.pages[0];
  const block = page?.blocks.find((b) => b.id === selected) ?? null;

  // Leaving with unsaved work asks first.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const update = (fn: (s: ShopSite) => ShopSite) => { setSite((s) => fn(JSON.parse(JSON.stringify(s)))); setDirty(true); };
  const updatePage = (fn: (p: SitePage) => void) => update((s) => { const p = s.pages.find((x) => x.id === page.id); if (p) fn(p); return s; });

  const addBlock = (type: BlockType, at?: number) => {
    const b: SiteBlock = { id: uid(), type, props: JSON.parse(JSON.stringify(blockDef(type).defaults)) };
    updatePage((p) => { p.blocks.splice(at ?? p.blocks.length, 0, b); });
    setSelected(b.id);
  };
  const moveBlock = (id: string, to: number) =>
    updatePage((p) => {
      const from = p.blocks.findIndex((b) => b.id === id);
      if (from < 0) return;
      const [b] = p.blocks.splice(from, 1);
      p.blocks.splice(to > from ? to - 1 : to, 0, b);
    });

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products]);
  const ctx: BlockCtx = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return {
      shop, products, categories, accent,
      offers: products.filter((p) => p.offerPrice != null),
      popular: popularIds.map((i) => byId.get(i)).filter(Boolean) as PublicShopProduct[],
      qtyOf: () => 0, setQty: () => {}, open: () => {}, go: () => {},
    };
  }, [shop, products, popularIds, categories, accent]);

  const doSave = async () => {
    setSaving(true);
    const ok = await save(site);
    setSaving(false);
    if (ok) setDirty(false);
  };
  const close = () => {
    if (dirty && !window.confirm('You have changes that are not saved. Close anyway?')) return;
    onClose();
  };

  const onDrop = (e: React.DragEvent, at: number) => {
    e.preventDefault();
    const t = e.dataTransfer.getData('vh/block-type') as BlockType;
    const id = e.dataTransfer.getData('vh/block-id');
    if (t) addBlock(t, at);
    else if (id) moveBlock(id, at);
    setDropAt(null);
  };
  const Drop: React.FC<{ at: number }> = ({ at }) => (
    <div
      onDragOver={(e) => { e.preventDefault(); setDropAt(at); }}
      onDragLeave={() => setDropAt((d) => (d === at ? null : d))}
      onDrop={(e) => onDrop(e, at)}
      className={`transition-all rounded-xl ${dropAt === at ? 'h-14 my-2 border-2 border-dashed bg-white' : 'h-3'}`}
      style={dropAt === at ? { borderColor: accent } : undefined}
    />
  );

  // On <body>: the settings screen sits inside a scrolling, transformed
  // container that would clip a fixed overlay and show the app above it.
  return createPortal(
    <ShopCtx.Provider value={shop}>
    <div className="fixed inset-0 z-[400] bg-slate-100 text-slate-900 flex flex-col" style={{ height: '100dvh' }}>
      {/* Top bar: pages and save. */}
      <header className="bg-white border-b border-slate-200 px-3 sm:px-4 h-14 flex items-center gap-2 shrink-0">
        <p className="text-[14px] font-semibold hidden sm:block mr-2">Page builder</p>
        <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {site.pages.map((p) => (
            <button
              key={p.id}
              onClick={() => { setPageId(p.id); setSelected(null); }}
              className={`h-9 px-3 rounded-lg text-[13px] whitespace-nowrap inline-flex items-center gap-1.5 ${p.id === page?.id ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {site.home === p.id && <Home size={12} />} {p.title}
            </button>
          ))}
          {site.pages.length < 10 && (
            <button
              onClick={() => {
                const n = site.pages.length + 1;
                const pg: SitePage = { id: uid(), slug: `page-${n}`, title: `Page ${n}`, inNav: true, blocks: [{ id: uid(), type: 'text', props: { ...blockDef('text').defaults, title: `Page ${n}` } }] };
                update((s) => { s.pages.push(pg); return s; });
                setPageId(pg.id);
                setSelected(null);
              }}
              className="h-9 px-3 rounded-lg text-[13px] text-slate-600 hover:bg-slate-100 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Plus size={14} /> Page
            </button>
          )}
        </div>
        {canSave ? (
          <button onClick={doSave} disabled={saving || !dirty} className="h-9 px-4 rounded-lg text-white text-[13px] font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform" style={{ background: accent }}>
            {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        ) : (
          <button onClick={onUpgrade} title={lockNote} className="h-9 px-3 rounded-lg bg-amber-500 text-white text-[13px] font-semibold inline-flex items-center gap-1.5">
            <Lock size={13} /> Upgrade to publish
          </button>
        )}
        <button onClick={close} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center" aria-label="Close the page builder"><X size={18} /></button>
      </header>
      {!canSave && (
        <p className="bg-amber-50 border-b border-amber-200 text-amber-900 text-[12.5px] font-semibold px-4 py-2 shrink-0">
          Try it freely. Publishing your own pages {lockNote.charAt(0).toLowerCase() + lockNote.slice(1)}.
        </p>
      )}

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Blocks */}
        <aside className="lg:w-60 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-3 overflow-x-auto lg:overflow-y-auto overscroll-contain">
          <p className="hidden lg:block text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400 mb-2 px-1">Drag a block onto the page</p>
          <div className="flex lg:flex-col gap-2">
            {BLOCK_DEFS.map((d) => (
              <button
                key={d.type}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData('vh/block-type', d.type); e.dataTransfer.effectAllowed = 'copy'; }}
                onDragEnd={() => setDropAt(null)}
                onClick={() => addBlock(d.type)}
                className="shrink-0 lg:w-full text-left rounded-xl border border-slate-200 bg-white hover:border-slate-400 px-3 py-2.5 flex items-start gap-2.5 cursor-grab active:cursor-grabbing active:scale-[0.98] transition"
              >
                <d.icon size={16} className="mt-0.5 shrink-0" style={{ color: accent }} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold whitespace-nowrap lg:whitespace-normal">{d.label}</span>
                  <span className="hidden lg:block text-[11px] text-slate-500 leading-snug">{d.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Page */}
        <main className="flex-1 min-w-0 overflow-y-auto overscroll-contain" onClick={() => setSelected(null)}>
          {page && (
            <div className="max-w-5xl mx-auto p-3 sm:p-6">
              {/* Page settings */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-4 flex flex-wrap items-end gap-3" onClick={(e) => e.stopPropagation()}>
                <label className="block"><Label>Page name</Label>
                  <input value={page.title} maxLength={60} onChange={(e) => updatePage((p) => { const keep = p.slug === slugOf(p.title); p.title = e.target.value; if (keep) p.slug = slugOf(e.target.value) || p.slug; })} className={`${FIELD} w-44`} />
                </label>
                <label className="block"><Label>Address</Label>
                  <div className="flex items-center">
                    <span className="text-[12px] text-slate-400 mr-1">/shop/{shop.slug}/</span>
                    <input value={page.slug} maxLength={40} onChange={(e) => updatePage((p) => { p.slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'); })} className={`${FIELD} w-32`} />
                  </div>
                </label>
                <label className="flex items-center gap-2 text-[13px] text-slate-700 h-9">
                  <input type="checkbox" checked={page.inNav} onChange={(e) => updatePage((p) => { p.inNav = e.target.checked; })} className="w-4 h-4" /> In the menu
                </label>
                <label className="flex items-center gap-2 text-[13px] text-slate-700 h-9">
                  <input type="checkbox" checked={site.home === page.id} onChange={(e) => update((s) => { s.home = e.target.checked ? page.id : null; return s; })} className="w-4 h-4" /> Home page
                </label>
                <button
                  onClick={() => {
                    if (!window.confirm(`Delete the page "${page.title}"?`)) return;
                    update((s) => { s.pages = s.pages.filter((p) => p.id !== page.id); if (s.home === page.id) s.home = null; return s; });
                    setPageId(site.pages.find((p) => p.id !== page.id)?.id ?? '');
                  }}
                  className="h-9 px-3 rounded-lg text-[12.5px] font-semibold text-rose-600 hover:bg-rose-50 ml-auto inline-flex items-center gap-1.5"
                >
                  <Trash2 size={14} /> Delete page
                </button>
              </div>
              {site.home === page.id && (
                <p className="text-[12px] text-slate-500 mb-3 px-1">This page opens first at /shop/{shop.slug}. Your products move to /shop/{shop.slug}/products, under Shop in the menu.</p>
              )}

              <div className="rounded-3xl bg-[#f6f7f6] border border-slate-200 p-3 sm:p-6">
                <Drop at={0} />
                {page.blocks.map((b, i) => (
                  <React.Fragment key={b.id}>
                    <div
                      onClick={(e) => { e.stopPropagation(); setSelected(b.id); }}
                      className={`group relative rounded-2xl transition-shadow ${selected === b.id ? 'ring-2 ring-offset-4 ring-offset-[#f6f7f6]' : 'hover:ring-1 hover:ring-slate-300 hover:ring-offset-4 hover:ring-offset-[#f6f7f6]'}`}
                      style={selected === b.id ? ({ ['--tw-ring-color' as any]: accent } as React.CSSProperties) : undefined}
                    >
                      {/* The block, exactly as customers see it. Clicks select it rather than follow links. */}
                      <div className="pointer-events-none select-none"><BlockView block={b} ctx={ctx} /></div>
                      <div className={`absolute -top-3 right-2 flex items-center gap-0.5 rounded-lg bg-white shadow-md border border-slate-200 p-0.5 ${selected === b.id ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        <span
                          draggable
                          onDragStart={(e) => { e.dataTransfer.setData('vh/block-id', b.id); e.dataTransfer.effectAllowed = 'move'; }}
                          onDragEnd={() => setDropAt(null)}
                          className="w-8 h-8 rounded-md flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-500 hover:bg-slate-100"
                          title="Drag to move"
                        >
                          <GripVertical size={15} />
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 px-1.5">{blockDef(b.type).label}</span>
                        <button onClick={(e) => { e.stopPropagation(); if (i > 0) moveBlock(b.id, i - 1); }} disabled={i === 0} className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Move up"><ArrowUp size={14} /></button>
                        <button onClick={(e) => { e.stopPropagation(); if (i < page.blocks.length - 1) moveBlock(b.id, i + 2); }} disabled={i === page.blocks.length - 1} className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Move down"><ArrowDown size={14} /></button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const copy = { ...JSON.parse(JSON.stringify(b)), id: uid() };
                            updatePage((p) => { p.blocks.splice(i + 1, 0, copy); });
                            setSelected(copy.id);
                          }}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100"
                          aria-label="Duplicate"
                        >
                          <Copy size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); updatePage((p) => { p.blocks = p.blocks.filter((x) => x.id !== b.id); }); setSelected(null); }} className="w-8 h-8 rounded-md flex items-center justify-center text-rose-600 hover:bg-rose-50" aria-label="Delete block"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <Drop at={i + 1} />
                  </React.Fragment>
                ))}
                {page.blocks.length === 0 && (
                  <p className="py-16 text-center text-[14px] text-slate-500">Drag a block here, or tap one on the left.</p>
                )}
              </div>
            </div>
          )}
          {!page && <p className="py-24 text-center text-slate-500">Add a page to start.</p>}
        </main>

        {/* Settings of the selected block */}
        <aside
          className={`lg:w-80 shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto overscroll-contain ${block ? 'max-h-[45dvh] lg:max-h-none' : 'hidden lg:block'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {block ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[14px] font-semibold">{blockDef(block.type).label}</p>
                <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center lg:hidden" aria-label="Done"><X size={16} /></button>
              </div>
              <Inspector
                block={block}
                categories={categories}
                pages={site.pages}
                onChange={(props) => updatePage((p) => { const b = p.blocks.find((x) => x.id === block.id); if (b) b.props = props; })}
              />
            </div>
          ) : (
            <p className="p-5 text-[13px] text-slate-500">Select a block on the page to change it.</p>
          )}
        </aside>
      </div>
    </div>
    </ShopCtx.Provider>,
    document.body,
  );
};

export default SiteBuilder;
