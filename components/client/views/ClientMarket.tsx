import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Plus, Search, MapPin, Tag, ShieldCheck, Store, Eye,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { marketplaceAPI, MarketListing, MarketOrder, clientPortalAPI } from '../../../services';
import { PortalFarm, FARM_SPECIES } from '../../../services/modules/clientPortal.api';
import { speciesConfig } from './farmSpecies';
import CpPage from '../CpPage';
import CpPickOrType from '../CpPickOrType';

/**
 * 296 — the farm marketplace.
 *
 * User, 2026-09-14: *"add ad-on Sale of Farm Produce to community, selling
 * animals … market place where users trade there animals platform is just an
 * escrow."*
 *
 * ⚠️ WHAT THIS SCREEN PROMISES IS WHAT IT CAN DELIVER. An enquiry introduces a
 * buyer to a seller and records what was discussed. It does NOT take the
 * buyer's money, because holding funds between two farmers is a licensed
 * activity in Kenya (CBK, payment service provider) and pretending otherwise
 * on a button would be the worst possible place to find that out. The escrow
 * states exist in the database and the copy below says plainly where a deal
 * currently stands.
 */

const money = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/** Counties a listing is most often in — free text still wins. */
const COUNTIES = [
  'Nairobi', 'Kiambu', 'Nakuru', 'Uasin Gishu', 'Meru', 'Nyeri', 'Machakos',
  'Kakamega', 'Bungoma', 'Kisii', 'Kajiado', 'Murang’a', 'Laikipia', 'Narok',
];

const STATUS_COPY: Record<string, string> = {
  ENQUIRY: 'You asked — the seller has been told',
  AGREED: 'Price and quantity agreed',
  PENDING_PAYMENT: 'Waiting on payment',
  HELD: 'Paid and held',
  RELEASED: 'Paid out to the seller',
  REFUNDED: 'Refunded',
  DISPUTED: 'In dispute',
  CANCELLED: 'Called off',
};

const ClientMarket: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'browse' | 'mine' | 'deals'>('browse');
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [mine, setMine] = useState<MarketListing[]>([]);
  const [orders, setOrders] = useState<{ buying: MarketOrder[]; selling: MarketOrder[] }>({ buying: [], selling: [] });
  const [farms, setFarms] = useState<PortalFarm[]>([]);
  const [loading, setLoading] = useState(true);
  /**
   * ⚠️ SELL THE LOCK, NEVER HIDE IT. The Market tab stays in the rail for a
   * farmer who has not bought the add-on; landing here shows what it is and
   * what it costs, rather than a control that 403s or a tab that vanished.
   */
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [county, setCounty] = useState('');

  // Detail + sell
  const [detail, setDetail] = useState<MarketListing | null>(null);
  const [sellOpen, setSellOpen] = useState(false);
  const [form, setForm] = useState({
    kind: 'LIVESTOCK', title: '', species: 'Cattle', breed: '', sex: '',
    ageMonths: '', weightKg: '', quantity: '1', unit: 'head', unitPrice: '',
    county: '', location: '', description: '', farmId: '', negotiable: true,
  });
  const [enquiry, setEnquiry] = useState({ quantity: '1', note: '' });

  const cfg = useMemo(() => speciesConfig(form.species), [form.species]);

  const load = useCallback(async () => {
    const [b, m, o, f] = await Promise.all([
      marketplaceAPI.browse({ q, kind, county }, { silent: true }),
      marketplaceAPI.mine({ silent: true }),
      marketplaceAPI.orders({ silent: true }),
      clientPortalAPI.getMyFarms({ silent: true }),
    ]);
    if (b.status === 403) { setLocked(true); setLoading(false); return; }
    setLocked(false);
    if (b.success && b.data) setListings(b.data.listings);
    if (m.success && m.data) setMine(m.data.listings);
    if (o.success && o.data) setOrders(o.data);
    if (f.success && f.data) setFarms(f.data.farms);
    setLoading(false);
  }, [q, kind, county]);

  useEffect(() => {
    // Debounced only for the text box; a dropdown change should feel instant.
    const id = setTimeout(() => { load(); }, q ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, q]);

  // ⚠️ The unit follows the species, because "3 head of chicken" is the same
  // cattle-shaped mistake the animal register had.
  useEffect(() => {
    if (form.kind === 'LIVESTOCK') setForm((p) => ({ ...p, unit: speciesConfig(p.species).headNoun }));
  }, [form.species, form.kind]);

  const submitListing = async () => {
    if (!form.title.trim()) { toast.error('Say what you are selling'); return; }
    const price = Number(form.unitPrice);
    if (!Number.isFinite(price) || price <= 0) { toast.error('A price is required'); return; }
    setSaving(true);
    try {
      const r = await marketplaceAPI.create({
        kind: form.kind,
        title: form.title.trim(),
        description: form.description.trim() || null,
        species: form.kind === 'LIVESTOCK' ? form.species : null,
        breed: form.breed.trim() || null,
        sex: form.sex || null,
        ageMonths: form.ageMonths === '' ? null : Number(form.ageMonths),
        weightKg: form.weightKg === '' ? null : Number(form.weightKg),
        quantity: Math.max(1, Number(form.quantity) || 1),
        unit: form.unit,
        unitPrice: price,
        county: form.county.trim() || null,
        location: form.location.trim() || null,
        farmId: form.farmId || null,
        negotiable: form.negotiable,
      });
      if (r.success) {
        toast.success('Listed');
        setSellOpen(false);
        setForm((p) => ({ ...p, title: '', breed: '', ageMonths: '', weightKg: '', unitPrice: '', description: '' }));
        setTab('mine');
        await load();
      }
    } finally { setSaving(false); }
  };

  const submitEnquiry = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const r = await marketplaceAPI.enquire(detail.id, {
        quantity: Math.max(1, Number(enquiry.quantity) || 1),
        note: enquiry.note.trim() || undefined,
      });
      if (r.success) {
        toast.success('The seller has been told');
        setDetail(null);
        setEnquiry({ quantity: '1', note: '' });
        setTab('deals');
        await load();
      }
    } finally { setSaving(false); }
  };

  const withdraw = async (l: MarketListing) => {
    const r = await marketplaceAPI.update(l.id, { status: 'WITHDRAWN' });
    if (r.success) { toast.success('Taken down'); await load(); }
  };

  if (locked) {
    return (
      <div className="space-y-4 fade-in">
        <button className="text-xs font-bold cp-accent-text flex items-center gap-1" onClick={() => navigate('/client/farm')}>
          <ArrowLeft className="w-3.5 h-3.5" /> My farm
        </button>
        <div className="cp-card p-6 max-w-xl">
          <Store className="w-7 h-7 cp-accent-text" />
          <h1 className="text-2xl font-black mt-3" style={{ color: 'var(--cp-ink)' }}>
            Sale of Farm Produce
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--cp-ink-soft)' }}>
            List animals and produce where other farmers on VetHubCore will see
            them, and keep every enquiry, price and agreement in one place
            instead of across a dozen WhatsApp threads.
          </p>
          <ul className="mt-4 space-y-1.5 text-sm" style={{ color: 'var(--cp-ink-soft)' }}>
            {[
              'List livestock and produce, priced per head, bird, tray or kilo',
              'Buyers filter by species, breed and county',
              'Every enquiry and agreed price kept against the listing',
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 cp-accent-text" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <button className="cp-btn w-full mt-5" onClick={() => navigate('/client/plan')}>
            See what it costs
          </button>
        </div>
      </div>
    );
  }

  // ── Sell: a page, because it is a dozen fields ──────────────────────────
  if (sellOpen) {
    return (
      <CpPage title="Sell something" onBack={() => setSellOpen(false)}>
        <div className="space-y-3">
          <div className="flex gap-1.5">
            {([['LIVESTOCK', 'An animal'], ['PRODUCE', 'Produce']] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setForm({ ...form, kind: k, unit: k === 'PRODUCE' ? 'kg' : cfg.headNoun })}
                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                  form.kind === k ? 'cp-tab-on border-transparent' : 'cp-muted'
                }`}
                style={form.kind === k ? undefined : { borderColor: 'var(--cp-border)' }}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <label className="cp-label">What are you selling?</label>
            <input className="cp-input w-full" autoFocus
              placeholder={form.kind === 'LIVESTOCK' ? 'In-calf Friesian heifer' : 'Maize, 90kg bags'}
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>

          {form.kind === 'LIVESTOCK' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="cp-label">What is it?</label>
                  <select className="cp-input w-full" value={form.species}
                    onChange={(e) => setForm({ ...form, species: e.target.value })}>
                    {FARM_SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="cp-label">Breed</label>
                  <CpPickOrType
                    options={cfg.breeds}
                    value={form.breed}
                    onChange={(v) => setForm({ ...form, breed: v })}
                    placeholder="Type the breed"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="cp-label">Sex</label>
                  <select className="cp-input w-full" value={form.sex}
                    onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                    <option value="">Mixed</option>
                    <option value="FEMALE">{cfg.femaleLabel}</option>
                    <option value="MALE">{cfg.maleLabel}</option>
                  </select>
                </div>
                <div>
                  <label className="cp-label">Age ({cfg.ageUnit})</label>
                  <input className="cp-input w-full" type="number" min="0" placeholder="—"
                    value={form.ageMonths} onChange={(e) => setForm({ ...form, ageMonths: e.target.value })} />
                </div>
                <div>
                  <label className="cp-label">Weight (kg)</label>
                  <input className="cp-input w-full" type="number" min="0" placeholder="—"
                    value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="cp-label">How many</label>
              <input className="cp-input w-full" type="number" min="1"
                value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div>
              <label className="cp-label">Unit</label>
              <input className="cp-input w-full" value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div>
              {/* ⚠️ PER UNIT, said on the label. A farmer quoting a total for
                  twenty birds and a buyer reading a per-bird price is the one
                  misunderstanding this screen must not allow. */}
              <label className="cp-label">Price per {form.unit.replace(/s$/, '')}</label>
              <input className="cp-input w-full" type="number" min="0" placeholder="45000"
                value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
            </div>
          </div>

          {Number(form.quantity) > 1 && Number(form.unitPrice) > 0 && (
            <p className="text-[11px] cp-muted">
              {form.quantity} × {money(Number(form.unitPrice), 'KES')} ={' '}
              <strong style={{ color: 'var(--cp-ink)' }}>
                {money(Number(form.quantity) * Number(form.unitPrice), 'KES')}
              </strong> in total.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="cp-label">County</label>
              <input className="cp-input w-full" list="cp-counties" placeholder="Nakuru"
                value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} />
              <datalist id="cp-counties">
                {COUNTIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="cp-label">Where exactly</label>
              <input className="cp-input w-full" placeholder="Njoro"
                value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
          </div>

          {farms.length > 0 && (
            <div>
              <label className="cp-label">
                Off which farm <span className="cp-muted font-normal normal-case tracking-normal">— optional</span>
              </label>
              <select className="cp-input w-full" value={form.farmId}
                onChange={(e) => setForm({ ...form, farmId: e.target.value })}>
                <option value="">Not saying</option>
                {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="cp-label">Anything else</label>
            <textarea className="cp-input w-full" rows={3}
              placeholder="Vaccinated, dewormed in July, milking 18 litres."
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--cp-ink-soft)' }}>
            <input type="checkbox" checked={form.negotiable}
              onChange={(e) => setForm({ ...form, negotiable: e.target.checked })} />
            Price is negotiable
          </label>

          <button className="cp-btn w-full" onClick={submitListing} disabled={saving || !form.title.trim()}>
            {saving ? 'Listing…' : 'List it'}
          </button>
        </div>
      </CpPage>
    );
  }

  // ── One listing ────────────────────────────────────────────────────────
  if (detail) {
    const dcfg = speciesConfig(detail.species);
    const facts = [
      detail.breed,
      detail.sex === 'FEMALE' ? dcfg.femaleLabel : detail.sex === 'MALE' ? dcfg.maleLabel : null,
      detail.ageMonths != null ? `${Math.round(detail.ageMonths)} months` : null,
      detail.weightKg != null ? `${detail.weightKg}kg` : null,
    ].filter(Boolean);
    return (
      <CpPage
        title={detail.title}
        subtitle={[detail.species, detail.county].filter(Boolean).join(' · ') || undefined}
        onBack={() => setDetail(null)}
      >
        <div className="space-y-4">
          <div>
            <div className="text-2xl font-black cp-accent-text">
              {money(detail.unitPrice, detail.currency)}
              <span className="text-sm font-bold cp-muted"> / {detail.unit.replace(/s$/, '')}</span>
            </div>
            <div className="text-sm mt-0.5" style={{ color: 'var(--cp-ink-soft)' }}>
              {detail.quantity} {detail.unit} available
              {detail.quantity > 1 && <> · {money(detail.totalPrice, detail.currency)} for the lot</>}
              {detail.negotiable && <> · negotiable</>}
            </div>
          </div>

          {facts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {facts.map((f) => (
                <span key={f as string} className="cp-chip">{f}</span>
              ))}
            </div>
          )}

          {detail.description && (
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--cp-ink-soft)' }}>
              {detail.description}
            </p>
          )}

          <div className="text-xs cp-muted flex flex-wrap gap-x-3 gap-y-1">
            <span className="flex items-center gap-1"><Store className="w-3 h-3" /> {detail.sellerName}</span>
            {(detail.location || detail.county) && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {[detail.location, detail.county].filter(Boolean).join(', ')}
              </span>
            )}
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {detail.viewCount} looked</span>
          </div>

          <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--cp-border)' }}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="cp-label">How many {detail.unit}</label>
                <input className="cp-input w-full" type="number" min="1" max={detail.quantity}
                  value={enquiry.quantity} onChange={(e) => setEnquiry({ ...enquiry, quantity: e.target.value })} />
              </div>
              <div>
                <label className="cp-label">That would be</label>
                <div className="cp-input w-full flex items-center font-black" style={{ color: 'var(--cp-ink)' }}>
                  {money(detail.unitPrice * Math.max(1, Number(enquiry.quantity) || 1), detail.currency)}
                </div>
              </div>
            </div>
            <div>
              <label className="cp-label">Message to the seller</label>
              <textarea className="cp-input w-full" rows={2}
                placeholder="Can I come and see them on Saturday?"
                value={enquiry.note} onChange={(e) => setEnquiry({ ...enquiry, note: e.target.value })} />
            </div>
            <button className="cp-btn w-full" onClick={submitEnquiry} disabled={saving}>
              {saving ? 'Sending…' : 'Ask the seller'}
            </button>
            {/* ⚠️ Say what actually happens. Nothing is charged here, and a
                buyer who assumes the platform is holding their money would find
                out at the worst possible moment. */}
            <p className="text-[10px] cp-muted flex items-start gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px" />
              Asking costs nothing and pays nothing. You and the seller agree the
              price and how you pay; we keep the record of what was agreed.
            </p>
          </div>
        </div>
      </CpPage>
    );
  }

  // ── The board ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 fade-in">
      <button className="text-xs font-bold cp-accent-text flex items-center gap-1" onClick={() => navigate('/client/farm')}>
        <ArrowLeft className="w-3.5 h-3.5" /> My farm
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--cp-ink)' }}>Market</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--cp-ink-soft)' }}>
            Animals and produce, from farms on VetHubCore.
          </p>
        </div>
        <button className="cp-btn shrink-0 flex items-center gap-1.5" onClick={() => setSellOpen(true)}>
          <Plus className="w-3.5 h-3.5" /> Sell
        </button>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <div className="inline-flex min-w-max p-1 rounded-2xl border"
             style={{ background: 'var(--cp-surface-2)', borderColor: 'var(--cp-border)' }}>
          {([
            ['browse', `Browse${listings.length ? ` (${listings.length})` : ''}`],
            ['mine', `My listings${mine.length ? ` (${mine.length})` : ''}`],
            ['deals', `Deals${orders.buying.length + orders.selling.length ? ` (${orders.buying.length + orders.selling.length})` : ''}`],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                tab === id ? 'cp-tab-on' : 'cp-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'browse' && (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="relative sm:col-span-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 cp-muted" />
              <input className="cp-input w-full pl-8" placeholder="Friesian, maize, layers"
                value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="cp-input w-full" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">Animals and produce</option>
              <option value="LIVESTOCK">Animals</option>
              <option value="PRODUCE">Produce</option>
            </select>
            <select className="cp-input w-full" value={county} onChange={(e) => setCounty(e.target.value)}>
              <option value="">Anywhere</option>
              {COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin cp-accent-text" /></div>
          ) : listings.length === 0 ? (
            <div className="cp-card px-5 py-12 text-center">
              <Store className="w-6 h-6 mx-auto cp-muted mb-2" />
              <p className="text-sm font-bold" style={{ color: 'var(--cp-ink)' }}>Nothing on the board yet</p>
              <p className="text-xs mt-1 cp-muted">Be the first — list an animal and farmers near you will see it.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {listings.map((l) => (
                <button key={l.id} onClick={() => setDetail(l)} className="cp-card p-4 text-left hover:opacity-90 transition-opacity">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-black truncate" style={{ color: 'var(--cp-ink)' }}>{l.title}</div>
                      <div className="text-[11px] cp-muted truncate">
                        {[l.species, l.breed].filter(Boolean).join(' · ') || (l.kind === 'PRODUCE' ? 'Produce' : 'Livestock')}
                      </div>
                    </div>
                    {l.negotiable && <span className="cp-chip shrink-0 text-[9px]">Nego</span>}
                  </div>
                  <div className="mt-2 text-lg font-black cp-accent-text">
                    {money(l.unitPrice, l.currency)}
                    <span className="text-[11px] font-bold cp-muted"> / {l.unit.replace(/s$/, '')}</span>
                  </div>
                  <div className="mt-1 text-[11px] cp-muted flex flex-wrap gap-x-2">
                    <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> {l.quantity} {l.unit}</span>
                    {l.county && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {l.county}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'mine' && (
        mine.length === 0 ? (
          <div className="cp-card px-5 py-12 text-center">
            <p className="text-sm font-bold" style={{ color: 'var(--cp-ink)' }}>You have nothing listed</p>
            <button className="cp-btn mt-3" onClick={() => setSellOpen(true)}>Sell something</button>
          </div>
        ) : (
          <div className="cp-card overflow-hidden divide-y" style={{ borderColor: 'var(--cp-border)' }}>
            {mine.map((l) => (
              <div key={l.id} className="px-4 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate" style={{ color: 'var(--cp-ink)' }}>{l.title}</div>
                  <div className="text-[11px] cp-muted">
                    {money(l.unitPrice, l.currency)} / {l.unit.replace(/s$/, '')} · {l.quantity} {l.unit}
                    {' · '}{l.orderCount} asked · {l.viewCount} looked
                  </div>
                </div>
                <span className="cp-chip shrink-0 text-[9px]">{l.status}</span>
                {l.status === 'ACTIVE' && (
                  <button className="text-[10px] font-black uppercase tracking-widest cp-muted shrink-0"
                          onClick={() => withdraw(l)}>
                    Take down
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'deals' && (
        <div className="space-y-4">
          {(['selling', 'buying'] as const).map((side) => {
            const rows = orders[side];
            if (rows.length === 0) return null;
            return (
              <div key={side}>
                <h3 className="text-[10px] font-black uppercase tracking-widest cp-muted mb-2">
                  {side === 'selling' ? 'People asking about yours' : 'What you asked about'}
                </h3>
                <div className="cp-card overflow-hidden divide-y" style={{ borderColor: 'var(--cp-border)' }}>
                  {rows.map((o) => (
                    <div key={o.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold truncate" style={{ color: 'var(--cp-ink)' }}>{o.listingTitle}</div>
                          <div className="text-[11px] cp-muted">
                            {o.quantity} × {money(o.unitPrice, o.currency)} = {money(o.totalAmount, o.currency)}
                            {side === 'selling' && o.buyerName && <> · {o.buyerName}</>}
                          </div>
                        </div>
                        <span className="cp-chip shrink-0 text-[9px]">{o.status}</span>
                      </div>
                      <p className="text-[11px] cp-muted mt-1">{STATUS_COPY[o.status] ?? o.status}</p>
                      {o.note && (
                        <p className="text-xs mt-1 italic" style={{ color: 'var(--cp-ink-soft)' }}>&ldquo;{o.note}&rdquo;</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {orders.buying.length + orders.selling.length === 0 && (
            <div className="cp-card px-5 py-12 text-center">
              <p className="text-sm font-bold" style={{ color: 'var(--cp-ink)' }}>No deals yet</p>
              <p className="text-xs mt-1 cp-muted">Ask about something on the board and it shows up here.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientMarket;
