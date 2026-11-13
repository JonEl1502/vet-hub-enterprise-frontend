import React, { useState } from 'react';
import {
  ChevronDown, Clock, FileText, Grid3x3, Heading, Image as ImageIcon, LayoutGrid, MapPin, MessageCircle,
  Minus, Phone, Quote, Sparkles, Star, Tag, Type, type LucideIcon,
} from 'lucide-react';
import type { BlockType, PublicShop, PublicShopProduct, SiteBlock } from '../../services/modules/supplierShop.api';
import { whatsappNumber } from './useShopBasket';
import { AddControl, InfoChips, OffBadge, PriceTag, ProductArt, PromoLines, SendListCard, hoursLine } from './ShopParts';

/**
 * The page builder's blocks (325): what each one is called, what it starts
 * with, and how it draws. The live page and the editor's canvas both render
 * through BlockView, so what the owner sees while editing is what customers
 * get.
 *
 * Text is rendered as text, never as HTML. Links go through `hrefFor`, which
 * only passes https, tel:, wa.me and the shop's own pages (the server already
 * refuses anything else; this is the second lock).
 */

export interface BlockCtx {
  shop: PublicShop;
  products: PublicShopProduct[];
  offers: PublicShopProduct[];
  popular: PublicShopProduct[];
  categories: string[];
  accent: string;
  qtyOf: (id: string) => number;
  setQty: (id: string, q: number) => void;
  open: (p: PublicShopProduct) => void;
  /** Go to one of the shop's pages ("products", "about") or a category of products. */
  go: (to: string, category?: string) => void;
}

export interface BlockDef {
  type: BlockType;
  label: string;
  hint: string;
  icon: LucideIcon;
  defaults: Record<string, any>;
}

export const BLOCK_DEFS: BlockDef[] = [
  { type: 'hero', label: 'Hero', hint: 'Big headline, short intro, photo and a button', icon: Sparkles,
    defaults: { eyebrow: '', title: 'Welcome to our shop', body: 'Tell customers what you sell and why they should buy from you.', image: '', buttonLabel: 'Shop now', buttonLink: 'products', align: 'left', dark: false } },
  { type: 'text', label: 'Text', hint: 'A heading and a paragraph', icon: Type,
    defaults: { title: 'About us', body: 'Write a few sentences about your business, your team and what you are good at.', align: 'left' } },
  { type: 'image', label: 'Image banner', hint: 'A wide photo with a caption', icon: ImageIcon,
    defaults: { image: '', caption: '', link: '', height: 'short' } },
  { type: 'offers', label: 'Offers', hint: 'Products on offer, with the % off', icon: Tag,
    defaults: { title: 'On offer', limit: 4 } },
  { type: 'popular', label: 'Popular', hint: 'Your best sellers from the till', icon: Star,
    defaults: { title: 'Popular', limit: 4 } },
  { type: 'products', label: 'Products', hint: 'A grid of products, all or one category', icon: LayoutGrid,
    defaults: { title: 'Our products', category: '', limit: 8 } },
  { type: 'categories', label: 'Categories', hint: 'Tiles that open each category', icon: Grid3x3,
    defaults: { title: 'Shop by category' } },
  { type: 'contact', label: 'Hours and location', hint: 'Opening hours, branches, phone and WhatsApp', icon: MapPin,
    defaults: { title: 'Visit us', showMap: true } },
  { type: 'faq', label: 'Questions', hint: 'Questions customers ask, with your answers', icon: ChevronDown,
    defaults: { title: 'Questions', items: [{ q: 'Do you deliver?', a: 'Yes. Tell us where on WhatsApp and we will give you the price.' }] } },
  { type: 'quotes', label: 'Customer quotes', hint: 'What customers say about you', icon: Quote,
    defaults: { title: 'What customers say', items: [{ text: 'Always have what I need, and good advice.', name: 'A happy customer' }] } },
  { type: 'sendList', label: 'Send your list', hint: 'WhatsApp a list or a prescription', icon: FileText,
    defaults: { kind: 'list' } },
  { type: 'divider', label: 'Space', hint: 'Breathing room between blocks', icon: Minus,
    defaults: { size: 'small' } },
];
export const blockDef = (t: BlockType) => BLOCK_DEFS.find((d) => d.type === t)!;

/** Links the owner typed: https, tel:, wa.me, or one of the shop's pages. */
const hrefFor = (raw: string): { href?: string; page?: string } => {
  const s = String(raw || '').trim();
  if (!s) return {};
  if (/^https:\/\//i.test(s) || /^tel:/i.test(s)) return { href: s };
  if (/^[a-z0-9-]{1,40}$/i.test(s)) return { page: s.toLowerCase() };
  return {};
};

const Head: React.FC<{ title?: string; ctx: BlockCtx; more?: () => void }> = ({ title, ctx, more }) =>
  title ? (
    <div className="flex items-end justify-between gap-3 mb-4">
      <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-slate-900">{title}</h2>
      {more && <button onClick={more} className="text-[13px] font-semibold shrink-0" style={{ color: ctx.accent }}>See all</button>}
    </div>
  ) : null;

const Card: React.FC<{ p: PublicShopProduct; ctx: BlockCtx }> = ({ p, ctx }) => (
  <article onClick={() => ctx.open(p)} className="relative bg-white rounded-3xl overflow-hidden border border-slate-200/70 hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col shadow-[0_2px_8px_rgb(15_23_42/0.04)]">
    <OffBadge p={p} />
    <ProductArt p={p} className="aspect-[5/4]" tint={ctx.accent} />
    <div className="p-3.5 pt-2 flex flex-col flex-1">
      <h3 className="text-[14px] font-semibold leading-snug line-clamp-2 text-slate-900">{p.name}</h3>
      {p.maker && <p className="text-[11.5px] text-slate-400 truncate mt-0.5">{p.maker}</p>}
      <PromoLines p={p} />
      <div className="mt-auto pt-3 flex flex-col gap-2">
        <PriceTag p={p} />
        <div className="flex justify-end"><AddControl p={p} qty={ctx.qtyOf(p.id)} accent={ctx.accent} onSet={(q) => ctx.setQty(p.id, q)} size="sm" /></div>
      </div>
    </div>
  </article>
);

const Grid: React.FC<{ items: PublicShopProduct[]; ctx: BlockCtx; empty: string }> = ({ items, ctx, empty }) =>
  items.length ? (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {items.map((p) => <Card key={p.id} p={p} ctx={ctx} />)}
    </div>
  ) : (
    <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-[13px] text-slate-500">{empty}</p>
  );

const Faq: React.FC<{ items: { q: string; a: string }[]; accent: string }> = ({ items, accent }) => {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-slate-200 rounded-3xl border border-slate-200 bg-white overflow-hidden">
      {items.map((it, i) => (
        <div key={i}>
          <button onClick={() => setOpen(open === i ? null : i)} className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left">
            <span className="text-[15px] font-semibold text-slate-900">{it.q}</span>
            <ChevronDown size={18} className={`shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} style={{ color: accent }} />
          </button>
          {open === i && it.a && <p className="px-5 pb-4 -mt-1 text-[14px] text-slate-600 leading-relaxed whitespace-pre-line">{it.a}</p>}
        </div>
      ))}
    </div>
  );
};

export const BlockView: React.FC<{ block: SiteBlock; ctx: BlockCtx }> = ({ block, ctx }) => {
  const p = block.props ?? {};
  const { shop, accent } = ctx;
  switch (block.type) {
    case 'hero': {
      const link = hrefFor(p.buttonLink);
      const center = p.align === 'center';
      const dark = !!p.dark || !!p.image;
      return (
        <section
          className={`relative overflow-hidden rounded-[1.75rem] ${p.image ? 'min-h-[18rem] sm:min-h-[22rem] flex items-end' : ''}`}
          style={p.image ? undefined : { background: dark ? '#0f1512' : `${accent}10` }}
        >
          {p.image && (
            <>
              <img src={p.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/5" />
            </>
          )}
          <div className={`relative w-full p-6 sm:p-10 ${center ? 'text-center' : ''}`}>
            {p.eyebrow && <p className="text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: dark ? '#ffffffcc' : accent }}>{p.eyebrow}</p>}
            {p.title && <h1 className={`text-[30px] sm:text-[44px] font-bold leading-[1.05] tracking-tight mt-2 ${center ? 'mx-auto' : ''} max-w-3xl`} style={{ color: dark ? '#fff' : '#0f172a' }}>{p.title}</h1>}
            {p.body && <p className={`text-[15px] sm:text-[17px] mt-3 max-w-2xl leading-relaxed whitespace-pre-line ${center ? 'mx-auto' : ''}`} style={{ color: dark ? '#ffffffd9' : '#475569' }}>{p.body}</p>}
            {p.buttonLabel && (link.href || link.page) && (
              link.href ? (
                <a href={link.href} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex h-12 px-6 rounded-xl items-center text-[15px] font-semibold text-white active:scale-[0.98] transition-transform" style={{ background: accent }}>{p.buttonLabel}</a>
              ) : (
                <button onClick={() => ctx.go(link.page!)} className="mt-6 inline-flex h-12 px-6 rounded-xl items-center text-[15px] font-semibold text-white active:scale-[0.98] transition-transform" style={{ background: accent }}>{p.buttonLabel}</button>
              )
            )}
          </div>
        </section>
      );
    }
    case 'text':
      return (
        <section className={`max-w-3xl ${p.align === 'center' ? 'mx-auto text-center' : ''}`}>
          {p.title && <h2 className="text-[24px] sm:text-[30px] font-bold tracking-tight text-slate-900">{p.title}</h2>}
          {p.body && <p className="text-[15px] sm:text-[16px] text-slate-600 mt-3 leading-relaxed whitespace-pre-line">{p.body}</p>}
        </section>
      );
    case 'image': {
      const link = hrefFor(p.link);
      const img = p.image ? (
        <img src={p.image} alt={p.caption || ''} className={`w-full ${p.height === 'tall' ? 'h-[22rem] sm:h-[30rem]' : 'h-56 sm:h-72'} object-cover rounded-[1.75rem]`} />
      ) : (
        <div className={`w-full ${p.height === 'tall' ? 'h-[22rem]' : 'h-56'} rounded-[1.75rem] bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-[13px]`}>
          <ImageIcon size={20} className="mr-2" /> Add a photo
        </div>
      );
      return (
        <figure>
          {link.href ? <a href={link.href} target="_blank" rel="noopener noreferrer">{img}</a> : link.page ? <button className="block w-full" onClick={() => ctx.go(link.page!)}>{img}</button> : img}
          {p.caption && <figcaption className="text-[13px] text-slate-500 mt-2 text-center">{p.caption}</figcaption>}
        </figure>
      );
    }
    case 'offers':
      return (
        <section>
          <Head title={p.title} ctx={ctx} more={ctx.offers.length > p.limit ? () => ctx.go('products') : undefined} />
          <Grid items={ctx.offers.slice(0, p.limit || 4)} ctx={ctx} empty="Put products on offer (an offer price below the normal price) and they appear here." />
        </section>
      );
    case 'popular':
      return (
        <section>
          <Head title={p.title} ctx={ctx} more={() => ctx.go('products')} />
          <Grid items={ctx.popular.slice(0, p.limit || 4)} ctx={ctx} empty="Your best sellers from the till appear here once you have sales." />
        </section>
      );
    case 'products': {
      const items = (p.category ? ctx.products.filter((x) => x.category === p.category) : ctx.products).slice(0, p.limit || 8);
      return (
        <section>
          <Head title={p.title} ctx={ctx} more={() => ctx.go('products', p.category || undefined)} />
          <Grid items={items} ctx={ctx} empty="No products to show yet." />
        </section>
      );
    }
    case 'categories': {
      const counts = ctx.products.reduce<Record<string, number>>((m, x) => ((m[x.category] = (m[x.category] ?? 0) + 1), m), {});
      return (
        <section>
          <Head title={p.title} ctx={ctx} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {ctx.categories.map((c) => {
              const pic = ctx.products.find((x) => x.category === c && x.imageUrl);
              return (
                <button key={c} onClick={() => ctx.go('products', c)} className="group relative rounded-3xl overflow-hidden border border-slate-200 bg-white text-left active:scale-[0.98] transition-transform">
                  <div className="aspect-[4/3] bg-white flex items-center justify-center">
                    {pic ? <img src={pic.imageUrl!} alt="" className="w-full h-full object-contain p-[10%]" /> : <Heading size={28} style={{ color: accent }} />}
                  </div>
                  <div className="px-4 py-3 border-t border-slate-100">
                    <p className="text-[15px] font-semibold text-slate-900">{c}</p>
                    <p className="text-[12px] text-slate-500">{counts[c]} item{counts[c] === 1 ? '' : 's'}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      );
    }
    case 'contact': {
      const wa = whatsappNumber(shop.whatsapp, shop.currency);
      const first = shop.branches.find((b) => b.address)?.address || shop.address;
      return (
        <section>
          <Head title={p.title} ctx={ctx} />
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3">
              {hoursLine(shop.hours) && <p className="text-[14px] text-slate-700 flex items-center gap-2"><Clock size={16} style={{ color: accent }} /> {hoursLine(shop.hours)}</p>}
              <InfoChips shop={shop} accent={accent} />
              {shop.branches.map((b) => (
                <div key={b.id}>
                  <p className="text-[14px] font-semibold flex items-center gap-2 text-slate-900"><MapPin size={15} style={{ color: accent }} /> {b.name}</p>
                  {b.address && <p className="text-[13px] text-slate-500 pl-6">{b.address}</p>}
                  {b.phone && <a href={`tel:${b.phone.replace(/\s+/g, '')}`} className="text-[13px] text-slate-500 pl-6 underline underline-offset-2">{b.phone}</a>}
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-1">
                {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="h-10 px-4 rounded-xl inline-flex items-center gap-1.5 text-[13px] font-semibold text-white" style={{ background: '#25D366' }}><MessageCircle size={15} /> WhatsApp</a>}
                {shop.phone && <a href={`tel:${shop.phone.replace(/\s+/g, '')}`} className="h-10 px-4 rounded-xl inline-flex items-center gap-1.5 text-[13px] font-semibold bg-slate-100 text-slate-700"><Phone size={15} /> Call</a>}
              </div>
            </div>
            {p.showMap && first && (
              <iframe
                title="Map"
                className="w-full min-h-[16rem] rounded-3xl border border-slate-200"
                loading="lazy"
                referrerPolicy="no-referrer"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(`${first}`)}&output=embed`}
              />
            )}
          </div>
        </section>
      );
    }
    case 'faq':
      return (
        <section className="max-w-3xl">
          <Head title={p.title} ctx={ctx} />
          {p.items?.length ? <Faq items={p.items} accent={accent} /> : <p className="text-[13px] text-slate-500">Add a question.</p>}
        </section>
      );
    case 'quotes':
      return (
        <section>
          <Head title={p.title} ctx={ctx} />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(p.items ?? []).map((q: any, i: number) => (
              <figure key={i} className="rounded-3xl border border-slate-200 bg-white p-5">
                <Quote size={20} style={{ color: accent }} />
                <blockquote className="text-[15px] text-slate-700 mt-2 leading-relaxed whitespace-pre-line">{q.text}</blockquote>
                {q.name && <figcaption className="text-[13px] font-semibold text-slate-900 mt-3">{q.name}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      );
    case 'sendList':
      return <SendListCard shop={shop} accent={accent} kind={p.kind === 'prescription' ? 'prescription' : 'list'} className="max-w-xl" />;
    case 'divider':
      return <div className={p.size === 'large' ? 'h-16' : 'h-6'} aria-hidden />;
    default:
      return null;
  }
};

/** A page of blocks. */
export const BlockStack: React.FC<{ blocks: SiteBlock[]; ctx: BlockCtx }> = ({ blocks, ctx }) => (
  <div className="space-y-10">
    {blocks.map((b) => <BlockView key={b.id} block={b} ctx={ctx} />)}
  </div>
);
