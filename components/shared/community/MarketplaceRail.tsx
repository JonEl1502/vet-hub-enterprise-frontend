import React, { useEffect, useRef, useState } from 'react';

/**
 * The marketplace column (297) — paid placement, in its own column.
 *
 * ── Two rules it will not break ───────────────────────────────────────────
 *  1. EVERY UNIT IS LABELLED. The hero says "Promoted", each tile says "Ad".
 *     It is the same rule the feed already follows for boosted posts, and it
 *     matters more here: the moment an advert can pass for organic content,
 *     the organic content stops being trusted too.
 *  2. EVERY SLOT SHOWS ITS CLOCK. A rotating slot that flips with no warning
 *     steals whatever the reader was mid-way through. The countdown also does
 *     the job a classified needs doing — it makes the listing feel finite.
 *
 * ⚠️ THE TIMERS ARE ALL DIFFERENT LENGTHS AND START STAGGERED. Slots ticking
 * in unison read as the page reloading, and a reader loses every tile at once.
 *
 * ⚠️ Rows are SIZED (`gridAutoRows`), not derived from content. A tile that
 * fails to lay out then holds its slot instead of folding the whole block to
 * zero height — which is indistinguishable from markup that never rendered.
 *
 * ── Seeded, for now ──────────────────────────────────────────────────────
 * The listings below are SEED DATA. Classifieds are a second product with
 * their own entity — a seller, a lifecycle, photos, an inbox, moderation —
 * and none of that is built yet. This renders the real column at the real
 * size so the layout is honest, and swaps to the API the day that model lands.
 */

export interface Listing {
  id: string;
  category: string;
  title: string;
  price: string;
  /** PRODUCT goes to a pre-filled purchase order; CLASSIFIED to a seller. */
  kind: 'PRODUCT' | 'CLASSIFIED';
  gradient: string;
}

interface Slot {
  category: string;
  /** Seconds on this slot's clock. Deliberately unique per slot. */
  secs: number;
  items: Listing[];
}

const HERO = [
  {
    category: 'Featured supplier',
    title: 'Agrovet Direct — dewormer week',
    sub: 'Free delivery in Nairobi & Kiambu over KES 20,000',
    cta: 'See the deal',
    kind: 'PRODUCT' as const,
    gradient: 'radial-gradient(120% 90% at 80% 10%,#F2A41C 0%,transparent 55%),linear-gradient(140deg,#9A4E0E 0%,#2A1A11 100%)',
  },
  {
    category: 'Equipment',
    title: 'Refurbished portable ultrasound',
    sub: 'Bovine + small animal probes · 12-month warranty · Nairobi',
    cta: 'View listing',
    kind: 'CLASSIFIED' as const,
    gradient: 'radial-gradient(110% 80% at 15% 15%,#2EA1B8 0%,transparent 58%),linear-gradient(150deg,#144E35 0%,#0B1F18 100%)',
  },
  {
    category: 'Pets for sale',
    title: 'German Shepherd puppies — 9 weeks',
    sub: 'Vaccinated, dewormed, KVB-registered breeder · Karen',
    cta: 'Contact seller',
    kind: 'CLASSIFIED' as const,
    gradient: 'radial-gradient(120% 90% at 75% 20%,#CFE6D8 0%,transparent 52%),linear-gradient(145deg,#1C7A5B 0%,#144E35 60%,#2A1A11 100%)',
  },
  {
    category: 'Livestock',
    title: 'In-calf Friesian heifers — 14 available',
    sub: 'Confirmed pregnant, full health records · Naivasha',
    cta: 'View herd',
    kind: 'CLASSIFIED' as const,
    gradient: 'radial-gradient(100% 90% at 20% 80%,#6D5BD0 0%,transparent 55%),linear-gradient(140deg,#1C7A5B 0%,#12100C 100%)',
  },
];

const l = (id: string, category: string, title: string, price: string, kind: Listing['kind'], gradient: string): Listing =>
  ({ id, category, title, price, kind, gradient });

const BLOCKS: Array<{ heading: string; slots: Slot[] }> = [
  {
    heading: 'Near you',
    slots: [
      { category: 'Pets for sale', secs: 24, items: [
        l('p1', 'Pets for sale', 'German Shepherd puppies, 9 wks', 'KES 35,000', 'CLASSIFIED', 'linear-gradient(140deg,#1C7A5B,#144E35)'),
        l('p2', 'Pets for sale', 'Persian kittens — vaccinated', 'KES 18,000', 'CLASSIFIED', 'linear-gradient(140deg,#2EA1B8,#144E35)'),
        l('p3', 'Pets for sale', 'Rescue mixed breed, 1 yr', 'Rehoming', 'CLASSIFIED', 'linear-gradient(140deg,#6D5BD0,#1C7A5B)'),
      ]},
      { category: 'Livestock', secs: 31, items: [
        l('v1', 'Livestock', 'In-calf Friesian heifer', 'KES 145,000', 'CLASSIFIED', 'linear-gradient(140deg,#9A4E0E,#2A1A11)'),
        l('v2', 'Livestock', 'Point-of-lay layers, 500 birds', 'KES 620 ea', 'CLASSIFIED', 'linear-gradient(140deg,#F2A41C,#9A4E0E)'),
        l('v3', 'Livestock', 'Galla goats — 12 does', 'KES 14,500 ea', 'CLASSIFIED', 'linear-gradient(140deg,#1C7A5B,#0B1F18)'),
      ]},
      { category: 'Agrovet deals', secs: 17, items: [
        l('a1', 'Agrovet deals', 'Ivermectin 1% — 50 ml vial', 'KES 1,450', 'PRODUCT', 'linear-gradient(140deg,#2EA1B8,#1C7A5B)'),
        l('a2', 'Agrovet deals', 'Albendazole 10% oral, 1 L', 'KES 2,100', 'PRODUCT', 'linear-gradient(140deg,#144E35,#2A1A11)'),
        l('a3', 'Agrovet deals', 'Rabies vaccine, 10-dose', 'KES 3,900', 'PRODUCT', 'linear-gradient(140deg,#6D5BD0,#144E35)'),
      ]},
      { category: 'Equipment', secs: 45, items: [
        l('e1', 'Equipment', 'Portable ultrasound, refurbished', 'KES 310,000', 'CLASSIFIED', 'linear-gradient(140deg,#2EA1B8,#12100C)'),
        l('e2', 'Equipment', 'Autoclave 18 L — ex-demo', 'KES 96,000', 'CLASSIFIED', 'linear-gradient(140deg,#9A4E0E,#2A1A11)'),
        l('e3', 'Equipment', 'Digital cattle crush scale', 'KES 74,000', 'CLASSIFIED', 'linear-gradient(140deg,#1C7A5B,#144E35)'),
      ]},
      { category: 'Feed & supplies', secs: 38, items: [
        l('f1', 'Feed & supplies', 'Layers mash 70 kg — bulk', 'KES 3,250', 'PRODUCT', 'linear-gradient(140deg,#F2A41C,#9A4E0E)'),
        l('f2', 'Feed & supplies', 'Dairy meal, 70 kg', 'KES 2,980', 'PRODUCT', 'linear-gradient(140deg,#1C7A5B,#0B1F18)'),
        l('f3', 'Feed & supplies', 'Puppy starter, 15 kg', 'KES 5,400', 'PRODUCT', 'linear-gradient(140deg,#6D5BD0,#144E35)'),
      ]},
      { category: 'Services', secs: 52, items: [
        l('s1', 'Services', 'Mobile farm vet — Kiambu', 'From 2,500', 'CLASSIFIED', 'linear-gradient(140deg,#144E35,#2EA1B8)'),
        l('s2', 'Services', 'AI technician, dairy herds', 'From 1,800', 'CLASSIFIED', 'linear-gradient(140deg,#2A1A11,#9A4E0E)'),
        l('s3', 'Services', 'Pet grooming, Westlands', 'From 1,200', 'CLASSIFIED', 'linear-gradient(140deg,#1C7A5B,#6D5BD0)'),
      ]},
    ],
  },
  {
    heading: 'Livestock & farm',
    slots: [
      { category: 'Working dogs', secs: 18, items: [
        l('w1', 'Working dogs', 'Trained GSD, 14 months', 'KES 180,000', 'CLASSIFIED', 'linear-gradient(140deg,#2A1A11,#9A4E0E)'),
        l('w2', 'Working dogs', 'Anatolian pup, 5 months', 'KES 60,000', 'CLASSIFIED', 'linear-gradient(140deg,#144E35,#2EA1B8)'),
      ]},
      { category: 'Poultry', secs: 26, items: [
        l('y1', 'Poultry', 'Kienyeji chicks, day-old', 'KES 120 ea', 'CLASSIFIED', 'linear-gradient(140deg,#F2A41C,#2A1A11)'),
        l('y2', 'Poultry', 'Kuroiler, 6 weeks', 'KES 380 ea', 'CLASSIFIED', 'linear-gradient(140deg,#9A4E0E,#144E35)'),
      ]},
      { category: 'Clinic space', secs: 33, items: [
        l('c1', 'Clinic space', 'Consult room to let — Ruaka', 'KES 45,000/mo', 'CLASSIFIED', 'linear-gradient(140deg,#1C7A5B,#2EA1B8)'),
        l('c2', 'Clinic space', 'Shared theatre, Westlands', 'KES 12,000/day', 'CLASSIFIED', 'linear-gradient(140deg,#144E35,#6D5BD0)'),
      ]},
      { category: 'Jobs', secs: 41, items: [
        l('j1', 'Jobs', 'Locum vet — 3 weekends', 'KES 8,000/day', 'CLASSIFIED', 'linear-gradient(140deg,#6D5BD0,#12100C)'),
        l('j2', 'Jobs', 'Vet nurse, full time — Thika', 'KES 45,000/mo', 'CLASSIFIED', 'linear-gradient(140deg,#2EA1B8,#144E35)'),
      ]},
      { category: 'Transport', secs: 48, items: [
        l('t1', 'Transport', 'Livestock lorry, 12 head', 'From 9,500', 'CLASSIFIED', 'linear-gradient(140deg,#9A4E0E,#144E35)'),
        l('t2', 'Transport', 'Chilled milk tanker, 3,000 L', 'From 14,000', 'CLASSIFIED', 'linear-gradient(140deg,#2A1A11,#1C7A5B)'),
      ]},
      { category: 'Tack & fencing', secs: 55, items: [
        l('k1', 'Tack & fencing', 'Electric fence energiser, 8 km', 'KES 27,500', 'PRODUCT', 'linear-gradient(140deg,#144E35,#0B1F18)'),
        l('k2', 'Tack & fencing', 'Cattle crush, galvanised', 'KES 132,000', 'PRODUCT', 'linear-gradient(140deg,#1C7A5B,#2A1A11)'),
      ]},
    ],
  },
  {
    heading: 'Supplies & services',
    slots: [
      { category: 'Breeding', secs: 22, items: [
        l('b1', 'Breeding', 'Boran bull, 3 yrs, proven', 'KES 320,000', 'CLASSIFIED', 'linear-gradient(140deg,#6D5BD0,#144E35)'),
        l('b2', 'Breeding', 'Sahiwal semen straws', 'KES 2,400 ea', 'PRODUCT', 'linear-gradient(140deg,#144E35,#9A4E0E)'),
      ]},
      { category: 'Vet supplies', secs: 29, items: [
        l('u1', 'Vet supplies', 'Disposable syringes, 100 pk', 'KES 950', 'PRODUCT', 'linear-gradient(140deg,#2EA1B8,#0B1F18)'),
        l('u2', 'Vet supplies', 'Suture, 3-0 vicryl, 12 pk', 'KES 4,600', 'PRODUCT', 'linear-gradient(140deg,#1C7A5B,#144E35)'),
      ]},
      { category: 'Aquaculture', secs: 36, items: [
        l('q1', 'Aquaculture', 'Tilapia fingerlings, 5,000', 'KES 12 ea', 'CLASSIFIED', 'linear-gradient(140deg,#144E35,#2EA1B8)'),
        l('q2', 'Aquaculture', 'Pond liner, 500 micron', 'KES 380/m²', 'PRODUCT', 'linear-gradient(140deg,#2EA1B8,#12100C)'),
      ]},
      { category: 'Bees', secs: 43, items: [
        l('h1', 'Bees', 'Langstroth hives, colonised', 'KES 8,800', 'CLASSIFIED', 'linear-gradient(140deg,#F2A41C,#9A4E0E)'),
        l('h2', 'Bees', 'Honey extractor, 4-frame', 'KES 34,000', 'PRODUCT', 'linear-gradient(140deg,#9A4E0E,#2A1A11)'),
      ]},
      { category: 'Pet accessories', secs: 50, items: [
        l('x1', 'Pet accessories', 'Cat carrier, airline-approved', 'KES 4,200', 'PRODUCT', 'linear-gradient(140deg,#1C7A5B,#6D5BD0)'),
        l('x2', 'Pet accessories', 'Orthopaedic dog bed, large', 'KES 7,900', 'PRODUCT', 'linear-gradient(140deg,#6D5BD0,#144E35)'),
      ]},
      { category: 'Training', secs: 57, items: [
        l('g1', 'Training', 'Puppy obedience, 6 weeks', 'KES 15,000', 'CLASSIFIED', 'linear-gradient(140deg,#2A1A11,#1C7A5B)'),
        l('g2', 'Training', 'Herd-health CPD, online', 'KES 6,500', 'CLASSIFIED', 'linear-gradient(140deg,#144E35,#2EA1B8)'),
      ]},
    ],
  },
];

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** One second of wall clock, shared by every slot on the page. */
function useTick() {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
}

const Countdown: React.FC<{ left: number }> = ({ left }) => (
  <span
    className={`absolute top-2 left-2 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/55 px-2 py-0.5 backdrop-blur-sm text-[8.5px] font-black tracking-wider text-zinc-100 tabular-nums font-display ${left <= 3 ? 'animate-pulse' : ''}`}
  >
    <i className="w-[5px] h-[5px] rounded-full bg-amber shrink-0" /> {mmss(Math.max(0, left))}
  </span>
);

interface Props {
  onOpenListing: (listing: Listing) => void;
  onBrowseAll: () => void;
}

const MarketplaceRail: React.FC<Props> = ({ onOpenListing, onBrowseAll }) => {
  useTick();
  const started = useRef(Date.now());
  const elapsed = Math.floor((Date.now() - started.current) / 1000);

  // Derived from elapsed time rather than held in state: a slot's position is a
  // pure function of the clock, so a re-render for any other reason can never
  // knock the rotation out of step.
  const HERO_SECS = 8;
  const heroIndex = Math.floor(elapsed / HERO_SECS) % HERO.length;
  const heroLeft = HERO_SECS - (elapsed % HERO_SECS);
  const hero = HERO[heroIndex];

  const slotState = (slot: Slot, offset: number) => {
    const t = elapsed + offset;
    return {
      item: slot.items[Math.floor(t / slot.secs) % slot.items.length],
      left: slot.secs - (t % slot.secs),
    };
  };

  let offsetSeed = 0;

  return (
    <aside className="flex flex-col gap-3 min-w-0">
      <p className="text-[8.5px] font-display font-extrabold uppercase tracking-[0.18em] text-slate-400 px-0.5">
        Marketplace
      </p>

      {/* ── the hero. Double height is a different product, not a bigger box:
             room for a two-line headline and a real supporting line is what
             makes it sellable above the commodity slots. ── */}
      <button
        onClick={() => onOpenListing({
          id: `hero-${heroIndex}`, category: hero.category, title: hero.title,
          price: '', kind: hero.kind, gradient: hero.gradient,
        })}
        className="relative h-[392px] rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 text-left"
        style={{ background: hero.gradient }}
      >
        <span className="absolute top-2 right-2 z-10 rounded-full border border-white/25 bg-black/55 px-2 py-0.5 backdrop-blur-sm text-[8px] font-display font-extrabold uppercase tracking-widest text-mint">
          Promoted
        </span>
        <Countdown left={heroLeft} />
        <span className="absolute inset-0 flex flex-col justify-end gap-1 p-[18px]">
          <span className="text-[8px] font-display font-extrabold uppercase tracking-[0.16em] text-mint">{hero.category}</span>
          <span className="text-xl font-display font-extrabold tracking-tight leading-tight text-white drop-shadow">{hero.title}</span>
          <span className="text-[12.5px] font-semibold text-zinc-300 leading-snug">{hero.sub}</span>
          <span className="self-start mt-3 rounded-lg bg-white px-3 py-1.5 text-[8.5px] font-display font-extrabold uppercase tracking-widest text-pine">
            {hero.cta}
          </span>
        </span>
        <span
          className="absolute left-0 bottom-0 h-[2.5px] bg-amber z-10 transition-[width] duration-1000 ease-linear"
          style={{ width: `${((HERO_SECS - heroLeft) / HERO_SECS) * 100}%` }}
        />
        <span className="absolute bottom-[18px] right-[18px] z-10 flex gap-1">
          {HERO.map((_, i) => (
            <i key={i} className={`h-[5px] rounded-full ${i === heroIndex ? 'w-3.5 bg-white' : 'w-[5px] bg-white/40'}`} />
          ))}
        </span>
      </button>

      {BLOCKS.map(block => (
        <React.Fragment key={block.heading}>
          <p className="mt-1 text-[8.5px] font-display font-extrabold uppercase tracking-[0.18em] text-slate-400 px-0.5">
            {block.heading}
          </p>
          <div
            className="grid grid-cols-2 gap-2"
            /* ⚠️ SIZED rows. A tile that fails to lay out holds its slot rather
               than folding the block to zero — which looks exactly like markup
               that never rendered, and cost two review cycles to spot. */
            style={{ gridAutoRows: '154px' }}
          >
            {block.slots.map(slot => {
              const { item, left } = slotState(slot, (offsetSeed += 7));
              return (
                <div
                  key={slot.category}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenListing(item)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenListing(item); } }}
                  className="relative flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-left cursor-pointer hover:border-seafoam transition-colors"
                >
                  <Countdown left={left} />
                  <span className="absolute top-2 right-2 z-10 rounded-full border border-white/25 bg-black/55 px-1.5 py-px backdrop-blur-sm text-[7px] font-display font-extrabold uppercase tracking-widest text-mint">
                    Ad
                  </span>
                  <span className="h-[72px] shrink-0" style={{ background: item.gradient }} />
                  <span className="flex flex-col gap-0.5 flex-1 min-w-0 px-2.5 pt-2 pb-2.5">
                    <span className="text-[7.5px] font-display font-extrabold uppercase tracking-[0.13em] text-slate-400">{slot.category}</span>
                    <span className="text-[11px] font-bold leading-snug text-pine dark:text-zinc-100 line-clamp-2">{item.title}</span>
                    <span className="mt-auto text-[11.5px] font-display font-extrabold tracking-tight text-seafoam tabular-nums">{item.price}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </React.Fragment>
      ))}

      <button
        onClick={onBrowseAll}
        className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-2.5 text-[9px] font-display font-extrabold uppercase tracking-widest text-seafoam hover:border-seafoam hover:bg-seafoam/5"
      >
        Browse all listings →
      </button>

      <p className="text-[10.5px] font-semibold text-slate-400 leading-relaxed px-0.5">
        Eighteen categories, each cycling its own listings on its own clock — so the
        column never flips all at once.
      </p>
    </aside>
  );
};

export default MarketplaceRail;
