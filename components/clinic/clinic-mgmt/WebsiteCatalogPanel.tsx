import React from 'react';
import {
  Loader2, Search, Plus, X, ShoppingBag, Pill, PackageX, Info,
} from 'lucide-react';
import { siteConnectAPI, type PublishedProduct } from '../../../services/modules/siteConnect.api';
import { inventoryAPI } from '../../../services/modules/inventory.api';
import { toast } from '../../../services';

/**
 * WEBSITE → PRODUCTS (270). What of the clinic's stock is on its public site.
 *
 * ⚠️ This lives here rather than as a toggle on every row of Inventory. A
 * clinic has thousands of items and publishes a handful; a per-row switch makes
 * "what is actually on my website?" a question you answer by scrolling. Here the
 * published set IS the screen, and adding to it is a search. (A per-row toggle
 * in Inventory is a reasonable second entry point later — it belongs to whoever
 * owns that view.)
 *
 * ⚠️ Prices and stock counts: the panel shows the clinic its OWN figures freely.
 * The public `/site/catalog` response is a different, much narrower shape — it
 * never carries a quantity, a cost or a supplier. Do not assume what is on this
 * screen is what a visitor sees.
 */

const FIELD =
  'w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 ' +
  'text-xs font-bold text-pine dark:text-zinc-100 outline-none focus:ring-2 focus:ring-seafoam/25';
const LABEL = 'text-[9px] font-black text-seafoam uppercase tracking-widest px-0.5';

const AVAIL_TONE: Record<PublishedProduct['availability'], string> = {
  IN_STOCK: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  LOW_STOCK: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  OUT_OF_STOCK: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
};
const AVAIL_LABEL: Record<PublishedProduct['availability'], string> = {
  IN_STOCK: 'In stock', LOW_STOCK: 'Low stock', OUT_OF_STOCK: 'Out of stock',
};

interface Props { enabled: boolean }

const WebsiteCatalogPanel: React.FC<Props> = ({ enabled }) => {
  const [items, setItems] = React.useState<PublishedProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);

  const [term, setTerm] = React.useState('');
  const [results, setResults] = React.useState<any[]>([]);
  const [searching, setSearching] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    siteConnectAPI.listPublished()
      .then((r) => setItems(r?.data?.items ?? []))
      .catch(() => toast.error('Could not load your website products'))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(load, [load]);

  // Debounced so a search does not fire a request per keystroke.
  React.useEffect(() => {
    if (term.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      setSearching(true);
      inventoryAPI.getAll({ search: term.trim(), limit: 12 })
        .then((r: any) => setResults(r?.data?.data ?? []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const publishedIds = React.useMemo(() => new Set(items.map((i) => i.id)), [items]);

  const setFields = async (itemId: string, patch: any, successMsg?: string) => {
    setBusyId(itemId);
    try {
      await siteConnectAPI.setWebsiteFields(itemId, patch);
      if (successMsg) toast.success(successMsg);
      load();
    } finally {
      setBusyId(null);
    }
  };

  if (!enabled) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 p-3">
        <Info size={14} className="text-seafoam shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
          Switch <strong>Product catalogue</strong> on for a website above, and the products you
          publish here become readable by it. Nothing is shared until you do.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Add */}
      <div>
        <p className={LABEL}>Add a product to your website</p>
        <div className="relative mt-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className={`${FIELD} pl-8`}
            value={term}
            placeholder="Search your stock by name…"
            onChange={(e) => setTerm(e.target.value)}
          />
          {searching && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-seafoam" />}
        </div>
        {results.length > 0 && (
          <div className="mt-1.5 border border-slate-200 dark:border-zinc-800 rounded-lg divide-y divide-slate-100 dark:divide-zinc-800 max-h-64 overflow-y-auto">
            {results.map((r: any) => {
              const id = String(r.id);
              const already = publishedIds.has(id);
              return (
                <div key={id} className="flex items-center gap-2 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black text-pine dark:text-zinc-100 truncate">{r.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {r.category}{r.sku ? ` · ${r.sku}` : ''}
                      {r.prescriptionOnly ? ' · prescription-only' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={already || busyId === id}
                    onClick={() => { setFields(id, { websiteVisible: true }, `${r.name} is on your website`); setTerm(''); }}
                    className="shrink-0 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 text-seafoam text-[9px] font-black uppercase tracking-widest disabled:opacity-40 flex items-center gap-1"
                  >
                    <Plus size={10} /> {already ? 'On site' : 'Add'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Published */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={16} className="animate-spin text-seafoam" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
          <ShoppingBag size={22} className="text-slate-300 dark:text-zinc-700 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-400">Nothing on your website yet</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Search above to put a product on it.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className={LABEL}>On your website — {items.length}</p>
          {items.map((i) => (
            <div key={i.id} className="border border-slate-200 dark:border-zinc-800 rounded-lg">
              <div className="flex items-center gap-2 p-2.5 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black text-pine dark:text-zinc-100 truncate">{i.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {i.websiteCategory ?? i.category} · shows as{' '}
                    <strong className="text-pine dark:text-zinc-200">
                      {(i.websitePrice ?? i.price).toLocaleString()}
                    </strong>
                    {i.websitePrice != null && <span className="text-seafoam"> (website price)</span>}
                  </p>
                </div>
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${AVAIL_TONE[i.availability]}`}>
                  {AVAIL_LABEL[i.availability]}
                </span>
                {i.prescriptionOnly && (
                  <span
                    title="Listed for enquiries only — a prescription-only product can never be bought online"
                    className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400 flex items-center gap-1"
                  >
                    <Pill size={9} /> Enquiry only
                  </span>
                )}
                <button type="button" onClick={() => setEditing(editing === i.id ? null : i.id)}
                  className="shrink-0 px-2 py-1 rounded border border-slate-200 dark:border-zinc-700 text-seafoam text-[9px] font-black uppercase tracking-widest">
                  {editing === i.id ? 'Done' : 'Edit'}
                </button>
                <button type="button" disabled={busyId === i.id}
                  onClick={() => setFields(i.id, { websiteVisible: false }, `${i.name} removed from your website`)}
                  className="shrink-0 p-1.5 rounded border border-slate-200 dark:border-zinc-700 text-rose-500 disabled:opacity-40"
                  aria-label={`Remove ${i.name} from the website`}>
                  {busyId === i.id ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                </button>
              </div>

              {editing === i.id && (
                <div className="border-t border-slate-100 dark:border-zinc-800 p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <p className={LABEL}>Website price — blank uses {i.price.toLocaleString()}</p>
                    <input className={FIELD} type="number" min="0" defaultValue={i.websitePrice ?? ''}
                      placeholder={String(i.price)}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        const next = v === '' ? null : Number(v);
                        if (next !== (i.websitePrice ?? null)) setFields(i.id, { websitePrice: next });
                      }} />
                  </div>
                  <div>
                    <p className={LABEL}>Public category — blank uses "{i.category}"</p>
                    <input className={FIELD} defaultValue={i.websiteCategory ?? ''} placeholder={i.category}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (i.websiteCategory ?? '')) setFields(i.id, { websiteCategory: v || null });
                      }} />
                  </div>
                  <div className="sm:col-span-2">
                    <p className={LABEL}>Description a pet owner will read</p>
                    <textarea className={`${FIELD} min-h-[64px]`} defaultValue={i.websiteDescription ?? ''}
                      placeholder="What it does, in plain words."
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (i.websiteDescription ?? '')) setFields(i.id, { websiteDescription: v || null });
                      }} />
                  </div>
                  <div className="sm:col-span-2">
                    <p className={LABEL}>Highlights — one per line, up to 8</p>
                    <textarea className={`${FIELD} min-h-[64px]`} defaultValue={(i.websiteHighlights ?? []).join('\n')}
                      placeholder={'12 weeks protection\nOral chewable tablet'}
                      onBlur={(e) => {
                        const next = e.target.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 8);
                        if (next.join('\n') !== (i.websiteHighlights ?? []).join('\n')) {
                          setFields(i.id, { websiteHighlights: next });
                        }
                      }} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 p-3">
        <PackageX size={14} className="text-seafoam shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
          Your website is told whether something is <strong>in stock, low or out</strong> — never how
          many you hold, what you paid, or who you buy from. A product that runs out stays listed and
          shows as out of stock. A <strong>prescription-only</strong> product can be listed for
          enquiries but can never be bought online.
        </p>
      </div>
    </div>
  );
};

export default WebsiteCatalogPanel;
