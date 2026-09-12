import React, { useState } from 'react';
import { ArrowLeft, Flag, ShieldCheck } from 'lucide-react';
import { toast } from '../../../services';
import { Listing } from './MarketplaceRail';

/**
 * Where an advert goes when it is clicked (297).
 *
 * ⚠️ TWO KINDS OF UNIT, TWO DESTINATIONS, and conflating them is the mistake
 * this screen exists to avoid:
 *
 *   · A PRODUCT is already a row in a supplier's catalogue. It goes where those
 *     have always gone — a PRE-FILLED PURCHASE ORDER at the offer price. That
 *     machinery exists; this page just hands off to it.
 *
 *   · A CLASSIFIED — a puppy, a used autoclave, a locum weekend — belongs to a
 *     PERSON, not a catalogue. There is no stock row, no PO, no price list, only
 *     a seller to reach. Showing it an "Order" button would promise a
 *     transaction the platform cannot complete.
 *
 * The tile cannot tell the reader which it is, so the page must, and it does so
 * through the ACTION rather than a badge nobody reads.
 *
 * ── Seeded, for now ──────────────────────────────────────────────────────
 * Classifieds are a second product with their own entity — seller, lifecycle,
 * photos, inbox, moderation queue — and none of it is built. This renders the
 * real destination at the real size so the click has somewhere honest to land,
 * and swaps to the API the day that model ships.
 */

interface Props {
  listing: Listing;
  onBack: () => void;
  onOpenListing: (l: Listing) => void;
}

const DETAIL: Record<string, { body: string; specs: Array<[string, string]>; seller: { name: string; kind: string; since: string; record: string } }> = {
  CLASSIFIED: {
    body: 'Second litter from the same pair. Both parents are on site and you are welcome to see them. Wormed at 3, 5 and 7 weeks, first vaccination done on 4 September and the card comes with the puppy. Eating solids, used to a household with children.',
    specs: [
      ['Age', '9 weeks'],
      ['Available', '3 males, 1 female'],
      ['Vaccinated', 'Yes — first dose, card supplied'],
      ['Dewormed', '3× since birth'],
      ['Location', 'Karen, Nairobi'],
      ['Registration', 'KVB-registered breeder'],
    ],
    seller: { name: 'Karen Ridge Kennels', kind: 'Breeder · Nairobi', since: '2024', record: 'No disputes' },
  },
  PRODUCT: {
    body: 'Stock-clearing before the new shipment lands. Batch expiry March 2028. Free delivery inside Nairobi and Kiambu on orders above KES 20,000.',
    specs: [
      ['Pack', '50 ml vial'],
      ['Minimum order', '6 vials'],
      ['Batch expiry', 'March 2028'],
      ['Withdrawal', 'Meat 28 days · milk not permitted'],
      ['Delivery', 'Nairobi & Kiambu'],
      ['In stock', '340 vials'],
    ],
    seller: { name: 'Agrovet Direct Kenya', kind: 'Supplier · Nairobi', since: '2023', record: '1,180 orders filled' },
  },
};

const ListingView: React.FC<Props> = ({ listing, onBack, onOpenListing }) => {
  const isProduct = listing.kind === 'PRODUCT';
  const d = DETAIL[listing.kind];
  const [phone, setPhone] = useState<string | null>(null);
  const [reported, setReported] = useState(false);

  return (
    <div className="flex flex-col gap-3.5 min-w-0">
      <button onClick={onBack} className="self-start inline-flex items-center gap-1.5 text-[9.5px] font-display font-extrabold uppercase tracking-widest text-slate-400 hover:text-seafoam">
        <ArrowLeft size={13} /> Back to the feed
      </button>

      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5">
        <div className="grid gap-1.5 h-[230px]" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
          <span className="row-span-2 rounded-2xl" style={{ background: listing.gradient }} />
          <span className="rounded-xl" style={{ background: listing.gradient, filter: 'hue-rotate(25deg)' }} />
          <span className="rounded-xl" style={{ background: listing.gradient, filter: 'hue-rotate(-25deg)' }} />
        </div>

        <div className="flex items-start gap-3 flex-wrap mt-4">
          <div className="flex-1 min-w-[220px]">
            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${
              isProduct ? 'bg-amber-500/10 text-amber-600 border-amber-500/25' : 'bg-violet-500/10 text-violet-600 border-violet-500/25'
            }`}>
              {listing.category}
            </span>
            <h2 className="mt-2 text-xl font-display font-extrabold tracking-tight leading-tight text-pine dark:text-zinc-100">
              {listing.title}
            </h2>
            <p className="mt-1.5 text-[11.5px] font-semibold text-slate-400">
              {d.specs.find(([k]) => k === 'Location')?.[1] ?? 'Nairobi'} · listed 3 days ago
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-display font-extrabold tracking-tight tabular-nums text-pine dark:text-zinc-100">
              {listing.price || '—'}
            </div>
          </div>
        </div>

        <p className="mt-3.5 text-[13.5px] leading-relaxed text-slate-600 dark:text-zinc-400 max-w-[62ch]">{d.body}</p>

        <dl className="mt-4 grid gap-y-1 gap-x-4 text-[12.5px]" style={{ gridTemplateColumns: '110px 1fr' }}>
          {d.specs.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="font-semibold text-slate-400">{k}</dt>
              <dd className="m-0 font-semibold text-pine dark:text-zinc-100">{v}</dd>
            </React.Fragment>
          ))}
        </dl>
      </div>

      {/* ⚠️ THE ACTION IS THE WHOLE POINT, and it differs by kind. */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-pine to-seafoam grid place-items-center text-white font-display font-extrabold shrink-0">
            {d.seller.name.charAt(0)}
          </span>
          <span className="flex-1 min-w-[160px]">
            <span className="block text-[13px] font-display font-bold text-pine dark:text-zinc-100">{d.seller.name}</span>
            <span className="block text-[11px] font-semibold text-slate-400">
              {d.seller.kind} · on VetHub since {d.seller.since} · {d.seller.record}
            </span>
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mt-3.5">
          {isProduct ? (
            <>
              <button
                onClick={() => toast.success('Opens a purchase order pre-filled at the offer price')}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pine to-seafoam text-white text-[10px] font-display font-extrabold uppercase tracking-widest"
              >
                Add to a purchase order
              </button>
              <button className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-[10px] font-display font-extrabold uppercase tracking-widest text-slate-500 hover:border-seafoam hover:text-seafoam">
                See the supplier's catalogue
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => toast.success('Messaging the seller opens with the marketplace release')}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pine to-seafoam text-white text-[10px] font-display font-extrabold uppercase tracking-widest"
              >
                Message the seller
              </button>
              <button
                onClick={() => setPhone('0722 ••• 418')}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-[10px] font-display font-extrabold uppercase tracking-widest text-slate-500 hover:border-seafoam hover:text-seafoam"
              >
                {phone ?? 'Show phone number'}
              </button>
            </>
          )}
          <button
            onClick={() => { setReported(true); toast.success('Thanks — a moderator will look at this'); }}
            disabled={reported}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-[10px] font-display font-extrabold uppercase tracking-widest text-slate-400 hover:border-rose-400 hover:text-rose-500 disabled:opacity-50"
          >
            <Flag size={12} className="inline mr-1.5" />{reported ? 'Reported' : 'Report listing'}
          </button>
        </div>

        <p className="mt-3 text-[11px] font-semibold text-slate-400 leading-relaxed">
          {isProduct
            ? 'The OFFER price travels into the order, not the list price — a buyer is never billed the number they did not click on.'
            : 'Messages stay inside VetHub until you choose to share a number, so a listing that goes wrong is still traceable.'}
        </p>
      </div>

      {/* ⚠️ NOT OPTIONAL ON A LIVE-ANIMAL MARKETPLACE. Every classifieds site
          that skipped this became a scam channel. The last line also routes the
          buyer back into the clinic network, which is who pays for this. */}
      {!isProduct && (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 p-4">
          <p className="flex items-center gap-2 text-[9px] font-display font-extrabold uppercase tracking-[0.14em] text-slate-400">
            <ShieldCheck size={13} /> Before you buy an animal
          </p>
          <ul className="mt-2 pl-4 list-disc text-[11.5px] leading-relaxed text-slate-600 dark:text-zinc-400">
            <li>See the animal with its mother, at the address given.</li>
            <li>Ask for the vaccination card and check the batch numbers.</li>
            <li>Never send a deposit before you have seen it in person.</li>
            <li>A VetHub clinic near you can check it over — ask in Community.</li>
          </ul>
        </div>
      )}

      <div>
        <p className="mb-2.5 text-[8.5px] font-display font-extrabold uppercase tracking-[0.18em] text-slate-400">
          More in {listing.category}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map(i => (
            <button
              key={i}
              onClick={() => onOpenListing({ ...listing, id: `${listing.id}-rel${i}` })}
              className="flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-left hover:border-seafoam"
            >
              <span className="h-16" style={{ background: listing.gradient, filter: `hue-rotate(${i * 40}deg)` }} />
              <span className="px-2.5 py-2">
                <span className="block text-[11px] font-bold leading-snug text-pine dark:text-zinc-100 line-clamp-2">
                  Similar in {listing.category.toLowerCase()}
                </span>
                <span className="block mt-1 text-[11px] font-display font-extrabold text-seafoam tabular-nums">{listing.price}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ListingView;
