/**
 * MEDICAL — the health side of a farm (user, 2026-08-29).
 *
 * Three things in one place: what was BOUGHT to treat animals, WHO it came from
 * and who has been out to the farm, and the clinic connection itself.
 *
 * ⚠️ The contact list is built from what the farmer has ALREADY RECORDED, never
 * from a directory. The user was explicit: *"it's not necessarily the one they
 * are attached to — this is just a list of the ones they have interacted
 * with."* An agrovet they bought one dewormer from belongs here even though
 * VetHub has no relationship with it at all.
 *
 * This is also where "Visits" went. It was pulled out of the main farm menu
 * because it opened a pet booking screen; a farm visit is a medical event and
 * belongs beside the treatments it produces.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stethoscope, Building2, Phone, Mail, Search, Loader2, Sparkles, X, MapPin, Siren, ShieldCheck,
} from 'lucide-react';
import {
  clientPortalAPI,
  type PortalFarm, type FarmMedical, type PortalClinic, type PortalHoldings,
} from '../../../services/modules/clientPortal.api';
import { toast } from '../../../services';
import CpModal from '../CpModal';

const KES = (n: number) => `KES ${Math.round(n).toLocaleString('en-KE')}`;
const day = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const ClientFarmMedical: React.FC = () => {
  const [farms, setFarms] = useState<PortalFarm[]>([]);
  const [activeId, setActiveId] = useState('');
  const [data, setData] = useState<FarmMedical | null>(null);
  const [holdings, setHoldings] = useState<PortalHoldings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  // Clinic connect
  const [connectOpen, setConnectOpen] = useState(false);
  const [pitchOpen, setPitchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState<PortalClinic[]>([]);
  const [filtered, setFiltered] = useState(0);
  const [searching, setSearching] = useState(false);

  const isFull = holdings?.farmTier === 'FULL';

  useEffect(() => {
    Promise.all([
      clientPortalAPI.getMyFarms({ showError: false }),
      clientPortalAPI.getHoldings({ showError: false }),
    ]).then(([f, h]) => {
      if (f.success && f.data?.farms) {
        setFarms(f.data.farms);
        if (f.data.farms.length) setActiveId((id) => id || f.data!.farms[0].id);
      }
      if (h.success && h.data) setHoldings(h.data);
    }).finally(() => setLoading(false));
  }, []);

  const load = useCallback((farmId: string) => {
    if (!farmId) return;
    clientPortalAPI.farmMedical(farmId).then((r) => { if (r.success && r.data) setData(r.data); });
  }, []);
  useEffect(() => { load(activeId); }, [activeId, load]);

  useEffect(() => {
    if (!connectOpen) return;
    const term = q.trim();
    if (term.length < 2) { setOpts([]); setFiltered(0); return; }
    setSearching(true);
    const id = setTimeout(() => {
      clientPortalAPI.farmClinicOptions(term)
        .then((r) => { if (r.success && r.data) { setOpts(r.data.clinics); setFiltered(r.data.filtered); } })
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(id);
  }, [q, connectOpen]);

  /**
   * ⚠️ The free tier gets the PITCH, not a search box that ends in a 403.
   * Connecting a clinic is what makes visits and shared records work, and both
   * are paid — so offering the search would be handing out the door to a room
   * they cannot enter.
   */
  const openConnect = () => {
    if (!isFull) { setPitchOpen(true); return; }
    setConnectOpen(true); setQ('');
  };

  const connect = async (clinicId: string | null) => {
    setSaving(true);
    try {
      const r = await clientPortalAPI.setFarmClinic(activeId, clinicId);
      if (r.success) {
        toast.success(clinicId ? 'Clinic connected' : 'Clinic removed');
        setConnectOpen(false); setQ(''); setOpts([]);
        load(activeId);
      }
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="cp-card px-5 py-12 text-center"><Loader2 size={16} className="animate-spin mx-auto text-slate-400" /></div>;
  }
  if (farms.length === 0) {
    return (
      <div className="cp-card px-5 py-12 text-center">
        <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">Add your farm first</p>
        <button className="cp-btn mt-3" onClick={() => navigate('/client/farm')}>Go to My Farm</button>
      </div>
    );
  }

  const active = farms.find((f) => f.id === activeId);
  const clinics = (data?.contacts ?? []).filter((c) => c.kind === 'CLINIC');
  const agrovets = (data?.contacts ?? []).filter((c) => c.kind === 'AGROVET');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-slate-800 dark:text-zinc-100">Medical</h2>
        {active && (
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <MapPin size={11} /> {active.name}
          </p>
        )}
      </div>

      {farms.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {farms.map((f) => (
            <button key={f.id} onClick={() => setActiveId(f.id)}
              className={`px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap ${
                f.id === activeId ? 'bg-pine text-white shadow' : 'bg-white dark:bg-zinc-900 text-slate-500 border border-slate-200 dark:border-zinc-800'}`}>
              {f.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* ── Your clinic ─────────────────────────────────────────────────── */}
        <section className="min-w-0 lg:col-start-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Your clinic</h3>
          <div className="cp-card p-4">
            {data?.linkedClinicId && clinics.find((c) => c.linked) ? (
              <>
                <p className="text-sm font-black text-slate-800 dark:text-zinc-100">
                  {clinics.find((c) => c.linked)!.name}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Connected — they can see this farm.</p>
                <div className="mt-3 flex gap-2">
                  <button className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-slate-500"
                    onClick={openConnect}>Change</button>
                  <button className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-600"
                    onClick={() => connect(null)} disabled={saving}>Remove</button>
                </div>
              </>
            ) : (
              <>
                <Building2 size={18} className="cp-accent-text" />
                <p className="mt-2 text-sm font-black text-slate-800 dark:text-zinc-100">No clinic connected</p>
                <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                  A connected clinic can see this farm's animals and records, and come out when
                  something needs a vet.
                </p>
                <button className="cp-btn mt-3 w-full" onClick={openConnect}>
                  <Building2 size={14} /> Connect a clinic
                </button>
              </>
            )}
          </div>

          {isFull && (
            <button className="cp-card p-3.5 mt-2 w-full text-left flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.03]"
              onClick={() => navigate('/client/farm')}>
              <Siren size={15} className="cp-accent-text shrink-0" />
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">Request a farm visit</span>
            </button>
          )}
        </section>

        {/* ── Treatments bought ───────────────────────────────────────────── */}
        <section className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <Stethoscope size={13} /> Medicine &amp; treatments
            </h3>
            {!!data?.spentOnHealth && (
              <span className="text-[11px] font-black text-slate-600 dark:text-zinc-300">{KES(data.spentOnHealth)}</span>
            )}
          </div>
          {(data?.treatments.length ?? 0) === 0 ? (
            <div className="cp-card px-5 py-8 text-center">
              <p className="text-xs text-slate-500">
                Nothing recorded yet. Anything you log under <strong>Treatment</strong> on the farm
                page — medicine, dewormer, spray — shows up here with where you bought it.
              </p>
            </div>
          ) : (
            <div className="cp-card overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800">
              {data!.treatments.map((e) => (
                <div key={e.id} className="flex items-baseline gap-3 px-3.5 sm:px-4 py-2">
                  <span className="shrink-0 w-[76px] text-[10px] font-bold uppercase tracking-wider text-slate-400 tabular-nums">
                    {new Date(e.entryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-slate-800 dark:text-zinc-100 truncate">{e.item}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {[e.quantity != null ? `${e.quantity}${e.unit ? ` ${e.unit.toLowerCase()}` : ''}` : null,
                        e.animalGroupName, e.vendorSupplierName || e.vendorName].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] font-black text-slate-600 dark:text-zinc-300 tabular-nums">
                    {KES(e.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Who you have dealt with ─────────────────────────────────────── */}
        <section className="min-w-0 lg:col-start-1 lg:row-start-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
            Who you have dealt with
          </h3>
          {clinics.length === 0 && agrovets.length === 0 ? (
            <div className="cp-card px-5 py-8 text-center text-xs text-slate-500">
              Every agrovet or clinic you record a purchase or a visit against is listed here, with
              their contact — so you never have to hunt for the number again.
            </div>
          ) : (
            <div className="cp-card overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800">
              {[...clinics, ...agrovets].map((c) => (
                <div key={`${c.kind}-${c.id ?? c.name}`} className="px-3.5 sm:px-4 py-2.5 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-slate-800 dark:text-zinc-100 truncate flex items-center gap-1.5">
                      {c.name}
                      {c.linked && <ShieldCheck size={11} className="text-emerald-600 shrink-0" />}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {[
                        c.kind === 'CLINIC' ? (c.linked ? 'Your clinic' : 'Clinic') : 'Agrovet',
                        c.times ? `${c.times} purchase${c.times === 1 ? '' : 's'}` : null,
                        c.spent ? KES(c.spent) : null,
                        c.lastAt ? `last ${day(c.lastAt)}` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="p-1.5 rounded-lg text-slate-400 hover:text-pine hover:bg-slate-100 dark:hover:bg-white/10" title={c.phone}>
                        <Phone size={13} />
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="p-1.5 rounded-lg text-slate-400 hover:text-pine hover:bg-slate-100 dark:hover:bg-white/10" title={c.email}>
                        <Mail size={13} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {agrovets.some((a) => !a.onVetHub) && (
            <p className="mt-2 text-[10px] text-slate-400">
              Shops with no phone number here are ones you typed in yourself — add them to a record
              again and we will keep matching.
            </p>
          )}
        </section>
      </div>

      {/* ── Free tier: the sweet nudge, not a dead end ────────────────────── */}
      {pitchOpen && (
        <CpModal title="Get a vet on your side" onClose={() => setPitchOpen(false)}>
          <div className="space-y-3">
            <Sparkles size={22} className="cp-accent-text" />
            <p className="text-sm font-black text-slate-800 dark:text-zinc-100 leading-snug">
              Join the VetHub community and a clinic is one tap away.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              On the Farmer plan you connect to a clinic near you, and they can see your animals
              before they arrive — so a sick goat gets the right visit, not a guess. Ask for a farm
              visit from your phone and they confirm the time.
            </p>
            <ul className="grid gap-1.5 text-[11px] text-slate-600 dark:text-zinc-300">
              {['Connect to any clinic that serves farms',
                'Request farm visits, tracked to done',
                'Your animals and records, shared with them',
                'Feeding plans and your full history'].map((f) => (
                <li key={f} className="flex items-start gap-1.5">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-current shrink-0 opacity-50" />{f}
                </li>
              ))}
            </ul>
            <div className="cp-card p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400">Farmer plan</p>
                <p className="text-lg font-black text-slate-800 dark:text-zinc-100 leading-tight">
                  KES 1,500<span className="text-xs font-bold text-slate-400">/mo</span>
                </p>
              </div>
              <button className="cp-btn shrink-0" onClick={() => { setPitchOpen(false); navigate('/client/plan'); }}>
                Subscribe
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center">
              Everything you have already recorded stays free, and stays yours.
            </p>
          </div>
        </CpModal>
      )}

      {/* ── Paid: pick a clinic ──────────────────────────────────────────── */}
      {connectOpen && (
        <CpModal title="Connect a clinic" onClose={() => setConnectOpen(false)}>
          <div className="space-y-3">
            <p className="text-xs text-slate-500 leading-relaxed">
              Only clinics that offer farm services can be connected — otherwise they would not be
              able to open your records.
            </p>
            <div>
              <label className="cp-label flex items-center gap-1"><Search size={11} /> Find a clinic</label>
              <input className="cp-input w-full" placeholder="Clinic name or town" value={q}
                onChange={(e) => setQ(e.target.value)} autoFocus />
            </div>
            {searching && <p className="text-[11px] text-slate-400">Searching…</p>}
            {opts.length > 0 && (
              <div className="cp-card overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800">
                {opts.map((c) => (
                  <button key={c.id} className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                    onClick={() => connect(c.id)} disabled={saving}>
                    <p className="text-sm font-bold text-slate-800 dark:text-zinc-100 truncate">{c.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {[c.city, c.phone].filter(Boolean).join(' · ') || 'Offers farm services'}
                    </p>
                  </button>
                ))}
              </div>
            )}
            {q.trim().length >= 2 && !searching && opts.length === 0 && (
              <p className="text-xs text-slate-500">No clinic here offers farm services yet.</p>
            )}
            {filtered > 0 && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 leading-relaxed">
                {filtered} other {filtered === 1 ? 'clinic matches' : 'clinics match'} but {filtered === 1 ? 'does' : 'do'} not
                offer farm services on VetHub yet. Ask them to add Farms to their plan.
              </p>
            )}
          </div>
        </CpModal>
      )}
    </div>
  );
};

export default ClientFarmMedical;
