import React, { useEffect, useState } from 'react';
import {
  Check, Copy, ExternalLink, Image as ImageIcon, Loader2, Lock, MessageCircle, Palette, Store,
} from 'lucide-react';
import { supplierShopAPI, type ShopHours, type ShopSettings, type ShopTemplate } from '../../../services/modules/supplierShop.api';
import { subscriptionPackagesAPI } from '../../../services/modules/subscriptionPackages.api';
import SiteBuilder from '../../shop/builder/SiteBuilder';
import type { PublicShop, PublicShopProduct, ShopSite } from '../../../services/modules/supplierShop.api';
import { toast, uploadsAPI } from '../../../services';

/**
 * Shop page settings: the owner's side of vethubcore.com/shop/<slug>.
 *
 * Every plan gets the page and the Market template. The other two templates,
 * the brand colour and the cover photo are Supplier Pro, and they are SHOWN
 * with their price and a preview, never hidden or left to fail (the "sell the
 * lock" rule). The server enforces the same line.
 */

interface Props {
  setView: (view: string) => void;
}

/**
 * What differs between an agrovet's shop page and a clinic's pet shop (324).
 * One screen, two configurations, so they can never drift apart.
 */
export interface ShopSettingsConfig {
  kind: 'supplier' | 'clinic';
  load: () => Promise<ShopSettings | undefined>;
  save: (patch: Record<string, any>) => Promise<ShopSettings | undefined>;
  /** Where Upgrade / See plans goes. */
  billingView: string;
  /** The feature key whose cheapest plan prices the locked extras. */
  proKey: string;
  /** What to call that plan when its price cannot be read. */
  proName: string;
  /** Clinics: the key that opens the page at all, and its name. */
  baseKey?: string;
  baseName?: string;
  /** 325 — save the page builder's pages. */
  saveSite: (site: ShopSite) => Promise<ShopSettings | undefined>;
  /** The "What shows" card. Suppliers link to Products; clinics get a picker. */
  productsCard: React.ReactNode;
}

const TEMPLATES: { id: ShopTemplate; name: string; blurb: string }[] = [
  { id: 'market', name: 'Market', blurb: 'Bright and busy, like your till. Big photos, quick Add buttons.' },
  { id: 'vetshop', name: 'Vet Shop', blurb: 'Search first, with a box for vet prescriptions. Clean and calm.' },
  { id: 'boutique', name: 'Boutique', blurb: 'Calm and elegant. Cream paper, large photos, room to breathe.' },
  { id: 'bold', name: 'Bold', blurb: 'Your colour and cover photo up top, products in aisles by category.' },
  { id: 'counter', name: 'Counter', blurb: 'A trade price list: departments down the side, quick rows, "send your list" up top.' },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://vethubcore.com';
const displayHost = (o: string) => o.replace(/^https?:\/\//, '');

/** A small drawing of each template, so the choice is visual. */
const Mini: React.FC<{ id: ShopTemplate; accent: string }> = ({ id, accent }) => {
  if (id === 'market') {
    return (
      <div className="h-28 rounded-xl overflow-hidden bg-[#f3f5f4] border border-slate-200">
        <div className="h-9" style={{ background: accent }} />
        <div className="mx-2 -mt-3 h-4 rounded-md bg-white shadow-sm" />
        <div className="grid grid-cols-4 gap-1.5 p-2">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-6 rounded-md bg-white border border-slate-100" />)}
        </div>
      </div>
    );
  }
  if (id === 'boutique') {
    return (
      <div className="h-28 rounded-xl overflow-hidden bg-[#faf7f2] border border-[#e8e1d4] flex flex-col items-center pt-3">
        <div className="h-1.5 w-10 rounded-full" style={{ background: accent }} />
        <div className="h-3 w-24 rounded bg-[#1d2a22]/80 mt-1.5" />
        <div className="grid grid-cols-3 gap-2 px-3 mt-3 w-full">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-white border border-[#ece5d8]" />)}
        </div>
      </div>
    );
  }
  if (id === 'counter') {
    return (
      <div className="h-28 rounded-xl overflow-hidden bg-[#f4f4f5] border border-slate-200">
        <div className="h-9 bg-[#1C1F24] px-2 pt-2"><div className="h-2 w-16 rounded bg-white/80" /></div>
        <div className="flex gap-1.5 p-2">
          <div className="w-8 space-y-1">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-2 rounded bg-slate-300" />)}</div>
          <div className="flex-1 space-y-1">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-3.5 rounded bg-white border border-slate-200 flex items-center justify-end pr-1"><span className="h-1.5 w-3 rounded" style={{ background: accent }} /></div>)}</div>
        </div>
      </div>
    );
  }
  if (id === 'vetshop') {
    return (
      <div className="h-28 rounded-xl overflow-hidden bg-white border border-slate-200 p-2">
        <div className="rounded-lg p-2" style={{ background: `${accent}14` }}>
          <div className="h-2 w-20 rounded bg-slate-700" />
          <div className="h-3 rounded bg-white mt-1.5 border border-slate-200" />
        </div>
        <div className="grid grid-cols-4 gap-1.5 mt-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-7 rounded-md bg-slate-50 border border-slate-200" />)}</div>
      </div>
    );
  }
  return (
    <div className="h-28 rounded-xl overflow-hidden bg-[#0f1512] border border-slate-800 relative">
      <div className="absolute inset-x-0 top-0 h-14" style={{ background: `radial-gradient(10rem 4rem at 80% 0%, ${accent}, transparent 70%)` }} />
      <div className="relative px-3 pt-4">
        <div className="h-3.5 w-20 rounded bg-white/90" />
        <div className="h-2 w-12 rounded mt-1.5" style={{ background: accent }} />
      </div>
      <div className="relative grid grid-cols-4 gap-1.5 px-3 mt-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 rounded-md bg-white/10" />)}
      </div>
    </div>
  );
};

const Card: React.FC<{ title: string; hint?: string; children: React.ReactNode; right?: React.ReactNode }> = ({ title, hint, children, right }) => (
  <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5">
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h2 className="text-sm font-black text-pine dark:text-zinc-100">{title}</h2>
        {hint && <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{hint}</p>}
      </div>
      {right}
    </div>
    {children}
  </section>
);

const INPUT = 'w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-pine dark:text-zinc-100 font-semibold outline-none focus:ring-2 focus:ring-seafoam/20 text-sm';

export const ShopSettingsView: React.FC<Props & { cfg: ShopSettingsConfig }> = ({ setView, cfg }) => {
  const [s, setS] = useState<ShopSettings | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [color, setColor] = useState('#1c7a5b');
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [proPrice, setProPrice] = useState<string | null>(null);
  const [basePrice, setBasePrice] = useState<string | null>(null);
  // 325 — the page builder and the data it previews with.
  const [building, setBuilding] = useState(false);
  const [preview, setPreview] = useState<{ shop: PublicShop; products: PublicShopProduct[]; popular: string[] } | null>(null);
  const [headline, setHeadline] = useState('');
  const [intro, setIntro] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [pickup, setPickup] = useState(true);
  const [hoursOn, setHoursOn] = useState(false);
  const [hours, setHours] = useState<ShopHours>({ days: [1, 2, 3, 4, 5, 6], open: '08:00', close: '18:00' });

  const load = (next: ShopSettings) => {
    setS(next);
    setSlug(next.slug);
    setTagline(next.tagline ?? '');
    setWhatsapp(next.whatsapp ?? '');
    setColor(next.primaryColor || '#1c7a5b');
    setHeadline(next.headline ?? '');
    setIntro(next.intro ?? '');
    setDeliveryNote(next.deliveryNote ?? '');
    setPickup(next.pickup ?? true);
    setHoursOn(!!next.hours);
    if (next.hours) setHours(next.hours);
  };

  useEffect(() => {
    cfg.load().then((d) => d && load(d)).catch(() => {});
    subscriptionPackagesAPI
      .list({ silent: true, showError: false })
      .then((r) => {
        const cheapest = (key: string) => {
          const plans = (r.data?.packages ?? []).filter((p) => (p.featureKeys ?? []).includes(key) && Number(p.price) > 0);
          plans.sort((a, b) => Number(a.price) - Number(b.price));
          const p = plans.find((x) => x.currency === 'KES') ?? plans[0];
          return p ? `${p.name} · ${p.currency} ${Number(p.price).toLocaleString()}` : null;
        };
        setProPrice(cheapest(cfg.proKey));
        if (cfg.baseKey) setBasePrice(cheapest(cfg.baseKey));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (what: string, patch: Record<string, any>, ok = 'Saved') => {
    setSaving(what);
    try {
      const d = await cfg.save(patch);
      if (d) load(d);
      toast.success(ok);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save');
    } finally {
      setSaving(null);
    }
  };

  if (!s) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const url = `${ORIGIN}/shop/${s.slug}`;
  const accentPreview = s.pro && s.primaryColor ? s.primaryColor : '#1c7a5b';
  const lockNote = proPrice ? `Comes with ${proPrice}` : `Comes with ${cfg.proName}`;
  const free = s.freeTemplate ?? 'market';
  const isPro = (id: ShopTemplate) => id !== free;
  const baseLocked = cfg.kind === 'clinic' && s.base === false;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy. Select the link and copy it.');
    }
  };

  const shareText = encodeURIComponent(`Shop with ${s.name} online: ${url}`);

  const openBuilder = async () => {
    // The builder previews with the real catalogue when the page is public;
    // a page that is switched off previews with the shop's details only.
    let data = preview;
    if (!data) {
      try {
        const r = await supplierShopAPI.getPublic(s.slug);
        if (r.data?.shop) data = { shop: r.data.shop, products: r.data.products ?? [], popular: r.data.popular ?? [] };
      } catch { /* switched off or not public yet */ }
      if (!data) {
        data = {
          shop: {
            kind: cfg.kind, slug: s.slug, name: s.name, logoUrl: s.logoUrl, tagline: s.tagline, template: s.template,
            color: s.primaryColor, coverUrl: s.coverUrl, currency: 'KES', whatsapp: s.whatsapp || s.fallbackPhone,
            phone: s.fallbackPhone, address: null, headline: s.headline, intro: s.intro, hours: s.hours,
            deliveryNote: s.deliveryNote, pickup: s.pickup, branches: [],
          },
          products: [],
          popular: [],
        };
      }
      setPreview(data);
    }
    setBuilding(true);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Shop page</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">Your products on the web. Customers fill a basket and send you the order on WhatsApp.</p>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pine text-white text-xs font-black uppercase tracking-widest hover:opacity-90">
          <ExternalLink size={14} /> Open my shop
        </a>
      </header>

      {baseLocked && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-5 py-4">
          <div>
            <p className="text-sm font-black text-amber-900 dark:text-amber-200">Your shop page is ready to switch on</p>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
              It comes with {basePrice ?? cfg.baseName}. Set it up below; it goes live when you switch it on.
            </p>
          </div>
          <button onClick={() => setView(cfg.billingView)} className="px-4 py-2 rounded-xl bg-amber-500 text-white text-[11px] font-black uppercase tracking-widest">See plans</button>
        </div>
      )}

      {/* The link: the thing they will share. */}
      <section className="rounded-2xl p-5 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${accentPreview}, ${accentPreview}cc)` }}>
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-widest text-white/70">Your shop's address</p>
            <p className="text-lg sm:text-xl font-black mt-1 break-all">{displayHost(ORIGIN)}/shop/{s.slug}</p>
            <p className="text-xs text-white/75 mt-1">
              {s.productCount} product{s.productCount === 1 ? '' : 's'} on show · {s.enabled ? 'Live' : 'Switched off'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={copy} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-xs font-black uppercase tracking-widest" style={{ color: accentPreview }}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy link'}
            </button>
            <a href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] text-white text-xs font-black uppercase tracking-widest">
              <MessageCircle size={14} /> Share
            </a>
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-[1fr_20rem] gap-5 items-start">
        <div className="space-y-5">
          <Card title="Template" hint="How your shop looks. Preview any of them before you choose.">
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {TEMPLATES.map((t) => {
                const on = s.template === t.id;
                const locked = isPro(t.id) && !s.pro;
                return (
                  <div key={t.id} className={`rounded-2xl border-2 p-3 transition-colors ${on ? 'border-pine dark:border-seafoam' : 'border-slate-200 dark:border-zinc-800'}`}>
                    <Mini id={t.id} accent={accentPreview} />
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-pine dark:text-zinc-100">{t.name}</p>
                      {isPro(t.id) ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider">
                          {locked && <Lock size={10} />} Pro
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">Every plan</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 min-h-[2.5rem]">{t.blurb}</p>
                    {locked && <p className="text-[11px] font-bold text-amber-700 mt-1">{lockNote}</p>}
                    <div className="mt-3 flex gap-2">
                      <a href={`${url}?template=${t.id}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-center px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300 hover:border-seafoam">
                        Preview
                      </a>
                      {on ? (
                        <span className="flex-1 text-center px-3 py-2 rounded-xl bg-pine/10 dark:bg-seafoam/10 text-pine dark:text-seafoam text-[11px] font-black uppercase tracking-widest">In use</span>
                      ) : locked ? (
                        <button onClick={() => setView(cfg.billingView)} className="flex-1 px-3 py-2 rounded-xl bg-amber-500 text-white text-[11px] font-black uppercase tracking-widest hover:bg-amber-600">
                          Upgrade
                        </button>
                      ) : (
                        <button onClick={() => save('template', { template: t.id }, `${t.name} template is live`)} disabled={!!saving} className="flex-1 px-3 py-2 rounded-xl bg-pine text-white text-[11px] font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-60">
                          {saving === 'template' ? '…' : 'Use this'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Shop details" hint="What customers see at the top of your page.">
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">Tagline</span>
                <input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={160} className={`${INPUT} mt-1.5`} placeholder="e.g. Feeds, seeds and animal health for every farmer" />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">WhatsApp number for orders</span>
                <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={`${INPUT} mt-1.5`} placeholder={s.fallbackPhone ? `Leave blank to use ${s.fallbackPhone}` : '+254 712 345 678'} inputMode="tel" />
                <span className="text-[11px] text-slate-400 mt-1 block">Orders from the basket arrive here, typed out with items and total.</span>
              </label>
              <button onClick={() => save('details', { tagline, whatsapp })} disabled={!!saving} className="px-5 py-2.5 rounded-xl bg-pine text-white text-xs font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-60">
                {saving === 'details' ? 'Saving…' : 'Save details'}
              </button>
            </div>
          </Card>

          <Card title="Top of the page" hint="A headline and the practical facts customers check before they order or visit.">
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">Headline</span>
                <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={160} className={`${INPUT} mt-1.5`} placeholder="e.g. Feeds, seeds and animal health. Fair prices for farmers." />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">Short intro</span>
                <textarea value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={600} rows={3} className={`${INPUT} mt-1.5 resize-none`} placeholder="Who you are, where you are, what you are good at. Two or three sentences." />
              </label>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">Delivery</span>
                  <input value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} maxLength={160} className={`${INPUT} mt-1.5`} placeholder="e.g. Delivery within 10 km · KES 200" />
                </label>
                <label className="flex items-center gap-3 sm:pt-6 cursor-pointer select-none">
                  <input type="checkbox" checked={pickup} onChange={(e) => setPickup(e.target.checked)} className="w-5 h-5 accent-pine" />
                  <span className="text-sm font-semibold text-pine dark:text-zinc-100">Customers can collect in store</span>
                </label>
              </div>
              <div>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input type="checkbox" checked={hoursOn} onChange={(e) => setHoursOn(e.target.checked)} className="w-5 h-5 accent-pine" />
                  <span className="text-sm font-semibold text-pine dark:text-zinc-100">Show opening hours ("Open now · closes 6pm")</span>
                </label>
                {hoursOn && (
                  <div className="mt-3 rounded-xl border border-slate-200 dark:border-zinc-700 p-3 space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS.map((d, i) => {
                        const on = hours.days.includes(i);
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setHours({ ...hours, days: on ? hours.days.filter((x) => x !== i) : [...hours.days, i].sort() })}
                            className={`w-12 h-9 rounded-lg text-xs font-bold border transition-colors ${on ? 'bg-pine text-white border-pine' : 'bg-white dark:bg-zinc-900 text-slate-500 border-slate-200 dark:border-zinc-700'}`}
                          >
                            {d}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-xs font-bold text-slate-500">Opens</span>
                      <input type="time" value={hours.open} onChange={(e) => setHours({ ...hours, open: e.target.value })} className={`${INPUT} w-32`} />
                      <span className="text-xs font-bold text-slate-500">closes</span>
                      <input type="time" value={hours.close} onChange={(e) => setHours({ ...hours, close: e.target.value })} className={`${INPUT} w-32`} />
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => save('hero', { headline, intro, deliveryNote, pickup, hours: hoursOn ? hours : null }, 'Saved')}
                disabled={!!saving}
                className="px-5 py-2.5 rounded-xl bg-pine text-white text-xs font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-60"
              >
                {saving === 'hero' ? 'Saving…' : 'Save'}
              </button>
            </div>
          </Card>

          <Card
            title="Your own pages"
            hint="Build an About us, Services or Contact page from blocks you drag into place. Any of them can be your home page."
            right={!s.pro ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider"><Lock size={10} /> Pro</span> : undefined}
          >
            {s.site?.pages?.length ? (
              <ul className="divide-y divide-slate-100 dark:divide-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 mb-3">
                {s.site.pages.map((pg) => (
                  <li key={pg.id} className="px-3 py-2.5 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-pine dark:text-zinc-100">
                      {pg.title}{s.site?.home === pg.id && <span className="ml-2 text-[10px] font-bold text-emerald-600">HOME</span>}
                    </span>
                    <a href={`${url}${s.site?.home === pg.id ? '' : `/${pg.slug}`}`} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 underline underline-offset-2">
                      /{pg.slug}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">No pages yet. The builder starts you with an About us page.</p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={openBuilder} className="px-5 py-2.5 rounded-xl bg-pine text-white text-xs font-black uppercase tracking-widest hover:opacity-90">
                Open the page builder
              </button>
              {!s.pro && <span className="text-[11px] font-bold text-amber-700">{lockNote}. Try the builder now; publishing needs it.</span>}
            </div>
          </Card>

          <Card
            title="Brand colour and cover photo"
            hint="Make the page yours. The Market template uses VetHubCore green unless you have Pro."
            right={!s.pro ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider"><Lock size={10} /> Pro</span> : undefined}
          >
            <div className={`grid sm:grid-cols-2 gap-4 ${!s.pro ? 'opacity-60 pointer-events-none select-none' : ''}`}>
              {cfg.kind === 'clinic' ? (
                <div>
                  <span className="text-xs font-bold text-slate-600 dark:text-zinc-300 inline-flex items-center gap-1.5"><Palette size={13} /> Brand colour</span>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="w-11 h-11 rounded-xl border border-slate-200" style={{ background: s.primaryColor || '#438883' }} />
                    <p className="text-xs text-slate-500 dark:text-zinc-400">Your clinic's own colour, from Settings → Branding. The shop page uses it too.</p>
                  </div>
                </div>
              ) : (
              <div>
                <span className="text-xs font-bold text-slate-600 dark:text-zinc-300 inline-flex items-center gap-1.5"><Palette size={13} /> Brand colour</span>
                <div className="mt-1.5 flex gap-2">
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-11 rounded-xl border border-slate-200 bg-white p-1" aria-label="Brand colour" />
                  <input value={color} onChange={(e) => setColor(e.target.value)} className={INPUT} />
                </div>
                <button onClick={() => save('color', { primaryColor: color }, 'Colour saved')} disabled={!!saving} className="mt-2 px-4 py-2 rounded-xl bg-pine text-white text-[11px] font-black uppercase tracking-widest disabled:opacity-60">
                  {saving === 'color' ? 'Saving…' : 'Save colour'}
                </button>
              </div>
              )}
              <div>
                <span className="text-xs font-bold text-slate-600 dark:text-zinc-300 inline-flex items-center gap-1.5"><ImageIcon size={13} /> Cover photo (Bold template)</span>
                <div className="mt-1.5 h-24 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 overflow-hidden flex items-center justify-center bg-slate-50 dark:bg-zinc-800">
                  {s.coverUrl ? <img src={s.coverUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-xs text-slate-400">A wide photo of your shop or farm</span>}
                </div>
                <div className="mt-2 flex gap-2">
                  <label className="px-4 py-2 rounded-xl bg-pine text-white text-[11px] font-black uppercase tracking-widest cursor-pointer">
                    {uploading ? 'Uploading…' : s.coverUrl ? 'Replace' : 'Upload'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        try {
                          const r = await uploadsAPI.upload(file, 'misc');
                          await save('cover', { coverUrl: r.publicUrl }, 'Cover photo saved');
                        } catch (err: any) {
                          toast.error(err?.message || 'Could not upload the photo');
                        } finally {
                          setUploading(false);
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                  {s.coverUrl && (
                    <button onClick={() => save('cover', { coverUrl: null }, 'Cover photo removed')} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-[11px] font-black uppercase tracking-widest text-slate-500">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
            {!s.pro && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">{lockNote}, with the {TEMPLATES.filter((t) => isPro(t.id)).map((t) => t.name).join(', ')} templates.</p>
                <button onClick={() => setView(cfg.billingView)} className="px-4 py-2 rounded-xl bg-amber-500 text-white text-[11px] font-black uppercase tracking-widest">See plans</button>
              </div>
            )}
          </Card>
          {cfg.kind === 'clinic' && cfg.productsCard}
        </div>

        <div className="space-y-5">
          <Card title="Page address" hint="Short and easy to say over the phone.">
            <div className="flex items-stretch rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden">
              <span className="px-3 flex items-center bg-slate-100 dark:bg-zinc-800 text-[11px] font-bold text-slate-500 whitespace-nowrap">/shop/</span>
              <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} className="flex-1 min-w-0 px-3 py-2.5 bg-white dark:bg-zinc-900 text-sm font-semibold text-pine dark:text-zinc-100 outline-none" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">Changing it breaks links you have already shared.</p>
            <button onClick={() => save('slug', { slug }, 'Address saved')} disabled={!!saving || slug === s.slug} className="mt-3 w-full px-4 py-2.5 rounded-xl bg-pine text-white text-xs font-black uppercase tracking-widest disabled:opacity-50">
              {saving === 'slug' ? 'Saving…' : 'Save address'}
            </button>
          </Card>

          <Card title="On or off" hint="Switch the page off without losing your settings.">
            {baseLocked && !s.enabled ? (
              <button onClick={() => setView(cfg.billingView)} className="w-full px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-amber-500 text-white">
                See plans to switch it on
              </button>
            ) : (
            <button
              onClick={() => save('enabled', { enabled: !s.enabled }, s.enabled ? 'Shop page switched off' : 'Shop page is live')}
              disabled={!!saving}
              className={`w-full px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest ${s.enabled ? 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300' : 'bg-pine text-white'}`}
            >
              {s.enabled ? 'Switch the page off' : 'Switch the page on'}
            </button>
            )}
          </Card>

          {cfg.kind === 'supplier' && cfg.productsCard}
        </div>
      </div>
      {building && preview && (
        <SiteBuilder
          initial={s.site ?? null}
          shop={preview.shop}
          products={preview.products}
          popularIds={preview.popular}
          accent={accentPreview}
          canSave={s.pro}
          lockNote={lockNote}
          onUpgrade={() => { setBuilding(false); setView(cfg.billingView); }}
          save={async (site) => {
            try {
              const d = await cfg.saveSite(site);
              if (d) load(d);
              toast.success('Pages saved. They are live on your shop.');
              return true;
            } catch (e: any) {
              toast.error(e?.message || 'Could not save the pages');
              return false;
            }
          }}
          onClose={() => setBuilding(false)}
        />
      )}
    </div>
  );
};

/** The agrovet / supplier configuration. */
const SupplierShopSettings: React.FC<Props> = ({ setView }) => (
  <ShopSettingsView
    setView={setView}
    cfg={{
      kind: 'supplier',
      load: () => supplierShopAPI.getSettings().then((r) => r.data),
      save: (patch) => supplierShopAPI.updateSettings(patch).then((r) => r.data),
      saveSite: (site) => supplierShopAPI.saveSite(site).then((r) => r.data),
      billingView: 'supplier-billing',
      proKey: 'supplier:shop-pro',
      proName: 'Supplier Pro',
      productsCard: (
                  <Card title="What shows" hint="Every product you have marked available, with its photo, price and whether it is in stock.">
                    <p className="text-xs text-slate-500 dark:text-zinc-400">Customers never see your buying prices or exact stock counts.</p>
                    <button onClick={() => setView('supplier-products')} className="mt-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-pine dark:text-seafoam">
                      <Store size={14} /> Manage products
                    </button>
                  </Card>
      ),
    }}
  />
);

export default SupplierShopSettings;
