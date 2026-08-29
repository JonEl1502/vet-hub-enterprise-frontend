/**
 * Farm home for the pet-owner portal in FARM mode.
 *
 * The farmer's daily loop is: what needs feeding, what produce is due, log it.
 * So this screen leads with those two actions rather than with a farm list —
 * most accounts have one farm, and making them tap into it first would put a
 * navigation step in front of the only thing they came to do.
 *
 * Farms are created either by the clinic (which pays for that through the Farms
 * add-on, 230) or by the owner themselves on the Farmer rung and up (231). What
 * the vet maintains — herds, plans, schedules — stays read-only here; the daily
 * entries only the owner can make are the point of the screen.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sprout, Milk, Wheat, Check, Loader2, CalendarClock, AlertTriangle, Plus, MapPin, Siren, Pencil } from 'lucide-react';
import {
  clientPortalAPI,
  type PortalFarm, type PortalFeedingPlan, type PortalProduceSchedule,
  type PortalProduceRecord, type PortalAnimalGroup, type PortalCropPlot,
  type PortalFarmVisitRequest, type PortalHoldings,
} from '../../../services/modules/clientPortal.api';
import { toast } from '../../../services';
import CpModal from '../CpModal';
import ClientFarmRecords from './ClientFarmRecords';

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '—';
const fmtWhen = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never';

const ClientFarms: React.FC = () => {
  const [farms, setFarms] = useState<PortalFarm[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [groups, setGroups] = useState<PortalAnimalGroup[]>([]);
  const [plots, setPlots] = useState<PortalCropPlot[]>([]);
  const [plans, setPlans] = useState<PortalFeedingPlan[]>([]);
  const [schedules, setSchedules] = useState<PortalProduceSchedule[]>([]);
  const [records, setRecords] = useState<PortalProduceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [feeding, setFeeding] = useState<string | null>(null);
  const [recording, setRecording] = useState<PortalProduceSchedule | null>(null);
  const [visitRequests, setVisitRequests] = useState<PortalFarmVisitRequest[]>([]);
  const [requesting, setRequesting] = useState(false);
  const [reqReason, setReqReason] = useState('');
  const [reqUrgency, setReqUrgency] = useState('ROUTINE');
  const [reqGroup, setReqGroup] = useState('');
  const [editHead, setEditHead] = useState<PortalAnimalGroup | null>(null);
  const [headVal, setHeadVal] = useState('');
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);
  // 231 — farm mode is the Farmer rung. A lapsed farmer keeps their data and
  // sees an upgrade prompt, never an error page.
  const [locked, setLocked] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // 262 — which farm product this account is on. 'BASIC' is the free record
  // book; 'FULL' additionally has feeding plans, crops and the vet link.
  const [holdings, setHoldings] = useState<PortalHoldings | null>(null);
  const tier = holdings?.farmTier ?? 'BASIC';
  const isFull = tier === 'FULL';
  const [newFarmName, setNewFarmName] = useState('');
  const navigate = useNavigate();

  const loadFarms = useCallback(() => {
    setLoading(true);
    return clientPortalAPI.getMyFarms({ showError: false })
      .then((r) => {
        if (r.success && r.data?.farms) {
          setLocked(false);
          setFarms(r.data.farms);
          if (r.data.farms.length) setActiveId((id) => id || r.data!.farms[0].id);
        } else if (r.status === 403) {
          // The plan gate, not a failure. Show the upgrade path.
          setLocked(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadFarms(); }, [loadFarms]);

  useEffect(() => {
    clientPortalAPI.getHoldings({ showError: false })
      .then((r) => { if (r.success && r.data) setHoldings(r.data); })
      .catch(() => { /* falls back to BASIC, which shows less, never more */ });
  }, []);

  const addFarm = async () => {
    const name = newFarmName.trim();
    if (!name) return;
    setSaving(true);
    const r = await clientPortalAPI.createMyFarm({ name });
    setSaving(false);
    if (r.success) {
      setAddOpen(false);
      setNewFarmName('');
      await loadFarms();
    }
  };

  /**
   * ⚠️ Feeding plans and visit requests are the PAID product (262), so on the
   * free tier they are not fetched at all. Calling them anyway would work —
   * the gate returns a clean 403 — but it would fire two failing requests on
   * every farm switch and surface an error toast for a feature the farmer was
   * never offered.
   */
  const loadFarm = useCallback(async (farmId: string, full: boolean) => {
    if (!farmId) return;
    const [d, p, f, v] = await Promise.all([
      clientPortalAPI.getFarmDetail(farmId),
      clientPortalAPI.getFarmProduce(farmId),
      full ? clientPortalAPI.getFarmFeeding(farmId) : Promise.resolve(null),
      full ? clientPortalAPI.listVisitRequests(farmId) : Promise.resolve(null),
    ]);
    if (d.success && d.data) { setGroups(d.data.animalGroups); setPlots(d.data.cropPlots); }
    if (p.success && p.data) { setSchedules(p.data.schedules); setRecords(p.data.records); }
    if (f?.success && f.data) setPlans(f.data.plans);
    if (v?.success && v.data) setVisitRequests(v.data.requests);
  }, []);

  useEffect(() => { loadFarm(activeId, isFull); }, [activeId, isFull, loadFarm]);

  const logFeed = async (plan: PortalFeedingPlan) => {
    setFeeding(plan.id);
    try {
      const res = await clientPortalAPI.logFeeding(plan.id, {});
      if (res.success && res.data?.log) {
        setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, lastFedAt: res.data!.log.fedAt } : p)));
        toast.success(`${plan.name} — fed`);
      }
    } finally { setFeeding(null); }
  };

  const submitProduce = async () => {
    if (!recording || qty === '') { toast.error('Enter a quantity'); return; }
    setSaving(true);
    try {
      const res = await clientPortalAPI.recordProduce(activeId, {
        produceScheduleId: recording.id,
        quantity: Number(qty),
        unit: recording.unit,
      });
      if (res.success && res.data?.record) {
        setRecords((prev) => [res.data!.record, ...prev]);
        toast.success('Recorded');
        setRecording(null);
        setQty('');
        loadFarm(activeId, isFull); // next-due rolled forward server-side
      }
    } finally { setSaving(false); }
  };

  const submitVisitRequest = async () => {
    if (!reqReason.trim()) { toast.error('Tell them what the visit is for'); return; }
    setSaving(true);
    try {
      const res = await clientPortalAPI.requestFarmVisit(activeId, {
        reason: reqReason.trim(), urgency: reqUrgency, animalGroupId: reqGroup || undefined,
      });
      if (res.success && res.data?.request) {
        setVisitRequests((prev) => [res.data!.request, ...prev]);
        toast.success('Visit requested — your clinic will confirm');
        setRequesting(false); setReqReason(''); setReqUrgency('ROUTINE'); setReqGroup('');
      }
    } finally { setSaving(false); }
  };

  const saveHeadCount = async () => {
    if (!editHead || headVal === '') return;
    setSaving(true);
    try {
      const res = await clientPortalAPI.updateHeadCount(editHead.id, Number(headVal));
      if (res.success && res.data?.group) {
        setGroups((prev) => prev.map((g) => (g.id === editHead.id ? { ...g, headCount: res.data!.group.headCount } : g)));
        toast.success('Head count updated');
        setEditHead(null); setHeadVal('');
      }
    } finally { setSaving(false); }
  };

  const fedToday = (d: string | null) => !!d && new Date(d).toDateString() === new Date().toDateString();
  const isDue = (d: string | null) => !!d && new Date(d).getTime() <= Date.now();
  const active = farms.find((f) => f.id === activeId);

  if (loading) {
    return <div className="cp-card text-center py-12 text-sm text-slate-400">Loading your farm…</div>;
  }

  // Has farms (or wants them) but not the plan. Deliberately NOT phrased as an
  // error: nothing has been taken away, the records are still there, and the
  // one thing they need is named plainly.
  if (locked) {
    return (
      <div className="cp-card text-center py-14">
        <Sprout size={26} className="mx-auto cp-accent-text" />
        <p className="mt-3 text-sm font-bold text-slate-700">Farm mode is on the Farmer plan</p>
        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
          Herds and flocks, feeding plans and produce records live here. Your pets, visits
          and invoices are unaffected — they stay on your current plan.
        </p>
        <button className="cp-btn mt-4" onClick={() => navigate('/client/plan')}>See plans</button>
      </div>
    );
  }

  if (farms.length === 0) {
    return (
      <>
        <div className="cp-card text-center py-14">
          <Sprout size={26} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm font-bold text-slate-700">No farm on your account yet</p>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            Add your own, or let your clinic register it for you. Either way your herds,
            feeding plans and produce records appear here.
          </p>
          <button className="cp-btn mt-4 inline-flex items-center gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Add my farm
          </button>
        </div>

        {addOpen && (
        <CpModal onClose={() => setAddOpen(false)} title="Add your farm">
          <div className="space-y-3">
            <input
              className="cp-input w-full"
              placeholder="Farm name"
              value={newFarmName}
              onChange={(e) => setNewFarmName(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-slate-500">
              You can link a clinic or a county vet officer later — a farm does not need
              either to exist.
            </p>
            <button className="cp-btn w-full" onClick={addFarm} disabled={saving || !newFarmName.trim()}>
              {saving ? 'Adding…' : 'Add farm'}
            </button>
          </div>
        </CpModal>
        )}
      </>
    );
  }

  return (
    <div className="space-y-5">
      {/* Farm switcher — only when there's more than one */}
      {farms.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {farms.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveId(f.id)}
              className={`px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                f.id === activeId ? 'bg-pine text-white shadow' : 'bg-white text-slate-500 border border-slate-200'
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="cp-card relative">
          <div className="flex items-start justify-between gap-3 sm:pr-56">
            <div className="min-w-0">
              <h2 className="text-base font-black text-slate-800 truncate">{active.name}</h2>
              {(active.county || active.location) && (
                <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin size={11} /> {[active.county, active.location].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            {active.clinic && (
              <span className="shrink-0 text-[10px] text-slate-400 text-right">
                Cared for by<br /><span className="font-bold text-slate-600">{active.clinic.name}</span>
              </span>
            )}
          </div>
          {/* ⚠️ These used to be a full-width 3-up grid, which on a desktop put
              a metre of empty space between "79 HEAD" and "0 PLOTS". They are
              a strip that sits WITH the farm name from `sm` up, and only
              spread out on a phone where there is nothing else on the row.
              `cropPlotCount` is dropped on the free tier — a farmer with no
              crops module does not need a permanent zero. */}
          <div className="mt-3 sm:mt-0 sm:absolute sm:right-5 sm:top-5 flex items-center justify-around sm:justify-end gap-5 sm:gap-6">
            <div className="text-center"><p className="text-lg font-black text-slate-800 dark:text-zinc-100 leading-none">{active.headCount}</p><p className="text-[9px] uppercase tracking-widest text-slate-400 mt-1">Head</p></div>
            <div className="text-center"><p className="text-lg font-black text-slate-800 dark:text-zinc-100 leading-none">{active.animalGroupCount}</p><p className="text-[9px] uppercase tracking-widest text-slate-400 mt-1">Kinds</p></div>
            {isFull && (
              <div className="text-center"><p className="text-lg font-black text-slate-800 dark:text-zinc-100 leading-none">{active.cropPlotCount}</p><p className="text-[9px] uppercase tracking-widest text-slate-400 mt-1">Plots</p></div>
            )}
          </div>
        </div>
      )}

      {/* ── 262: the FREE record book ─────────────────────────────────────
          Renders on BOTH tiers. A paying farmer gains this on top of feeding
          plans and produce schedules — they do not lose a screen by gaining
          one. Everything below is the PAID product and is gated. */}
      {active && (
        <ClientFarmRecords
          farmId={active.id}
          groups={groups}
          onGroupsChanged={() => loadFarm(activeId, isFull)}
          tier={tier}
          groupLimit={holdings?.groupLimit ?? 3}
        />
      )}

      {/* Feeding — the daily action, first. PAID (livestock:farms). */}
      {isFull && (
      <section>
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
          <Sprout size={13} /> Today's feeding
        </h3>
        {plans.length === 0 ? (
          <div className="cp-card text-center py-6 text-xs text-slate-400">No feeding plans set up yet.</div>
        ) : (
          <div className="space-y-2">
            {plans.map((p) => (
              <div key={p.id} className="cp-card flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{p.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {[p.animalGroupName, p.feedType, p.quantityKg != null ? `${p.quantityKg} kg` : null]
                      .filter(Boolean).join(' · ')}
                  </p>
                  <p className={`text-[10px] mt-0.5 font-semibold ${fedToday(p.lastFedAt) ? 'text-emerald-600' : 'text-amber-600'}`}>
                    Last fed {fmtWhen(p.lastFedAt)}
                  </p>
                  {/* Named feeding times (161). A slot only reads overdue once
                      its time has passed, so the morning chip doesn't shout at
                      an owner who feeds at six in the evening. */}
                  {(p as any).today?.windows?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(p as any).today.windows.map((w: any) => (
                        <span key={w.key}
                          className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                            w.fed ? 'bg-emerald-50 text-emerald-600'
                              : w.due ? 'bg-rose-50 text-rose-600'
                              : 'bg-slate-100 text-slate-400'}`}>
                          {w.fed ? '✓' : w.due ? '!' : '·'} {w.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => logFeed(p)}
                  disabled={feeding === p.id}
                  className="shrink-0 px-3.5 py-2.5 rounded-xl bg-pine text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50"
                >
                  {feeding === p.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Fed
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      )}

      {/* Produce SCHEDULES are the paid product — the free tier records what
          actually came off the farm instead of what was expected. */}
      {isFull && (
      <section>
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
          <CalendarClock size={13} /> Produce
        </h3>
        {schedules.length === 0 ? (
          <div className="cp-card text-center py-6 text-xs text-slate-400">No produce scheduled yet.</div>
        ) : (
          <div className="space-y-2">
            {schedules.map((s) => (
              <div key={s.id} className="cp-card flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{s.produce}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {[s.sourceName, s.expectedQty != null ? `expect ${s.expectedQty} ${s.unit}` : null]
                      .filter(Boolean).join(' · ')}
                  </p>
                  <p className={`text-[10px] mt-0.5 font-semibold flex items-center gap-1 ${isDue(s.nextDueOn) ? 'text-amber-600' : 'text-slate-500'}`}>
                    {isDue(s.nextDueOn) && <AlertTriangle size={10} />} Due {fmtDate(s.nextDueOn)}
                  </p>
                </div>
                <button
                  onClick={() => { setRecording(s); setQty(s.expectedQty != null ? String(s.expectedQty) : ''); }}
                  className="shrink-0 px-3.5 py-2.5 rounded-xl bg-pine text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"
                >
                  <Plus size={12} /> Record
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      )}

      {/* Ask the vet out. PAID — the user's call (spec §3.4), and the one
          limit flagged as most likely worth reversing: it cuts against pulling
          farmers toward the clinics. */}
      {isFull && (
      <section>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <Siren size={13} /> Vet visits
          </h3>
          <button
            onClick={() => setRequesting(true)}
            className="px-3 py-1.5 rounded-lg bg-pine text-white text-[10px] font-black uppercase tracking-widest"
          >
            Request a visit
          </button>
        </div>
        {visitRequests.length === 0 ? (
          <div className="cp-card text-center py-6 text-xs text-slate-400">
            No visits requested. Ask your clinic to come out when something needs a vet.
          </div>
        ) : (
          <div className="space-y-2">
            {visitRequests.slice(0, 5).map((v) => (
              <div key={v.id} className="cp-card">
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                    v.status === 'SCHEDULED' ? 'bg-indigo-100 text-indigo-700'
                    : v.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700'
                    : v.status === 'CANCELLED' ? 'bg-slate-100 text-slate-500'
                    : 'bg-sky-100 text-sky-700'
                  }`}>{v.status}</span>
                  <span className="text-[10px] text-slate-400">{fmtDate(v.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-sm text-slate-700 break-words">{v.reason}</p>
                {v.scheduledFor && (
                  <p className="mt-1 text-[11px] font-semibold text-indigo-600">
                    Vet coming {new Date(v.scheduledFor).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                )}
                {v.clinicNotes && <p className="mt-1 text-[11px] text-slate-500">{v.clinicNotes}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
      )}

      {/* ⚠️ On the FREE tier this is NOT hidden — it is the shop window.
          (user, 2026-08-29: *"free acc wont have it, or have it and as selling
          point there make them want to buy it"*.)

          Hiding a feature teaches nobody it exists. A farmer who has just
          recorded a sick goat's dewormer is exactly the person who wants a vet
          on the farm, and that is the moment to say what it costs. What must
          never happen is the third option: a live-looking "Book a visit"
          button that 403s — that reads as a broken app, not a locked feature. */}
      {!isFull && (
        <section>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
            <Siren size={13} /> Vet visits
          </h3>
          <div className="cp-card overflow-hidden">
            <div className="p-1 sm:p-2 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <p className="text-sm font-black text-slate-800 dark:text-zinc-100">
                  Get the vet to come to the farm
                </p>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-md">
                  Request a visit from your phone and your clinic confirms the time — no calling
                  round. Sick animals, routine checks, pregnancy diagnosis and vaccination rounds.
                </p>
                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 text-[11px] text-slate-600 dark:text-zinc-300">
                  {[
                    'Request a vet visit, tracked to done',
                    'Feeding plans with named times',
                    'Crops and produce schedules',
                    'Your full record history, not 90 days',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <Check size={12} className="mt-0.5 shrink-0 text-emerald-600" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="sm:text-right shrink-0">
                <p className="text-[10px] uppercase tracking-widest text-slate-400">Farmer plan</p>
                <p className="text-xl font-black text-slate-800 dark:text-zinc-100 leading-tight">
                  KES 1,500<span className="text-xs font-bold text-slate-400">/mo</span>
                </p>
                <button className="cp-btn mt-2 w-full sm:w-auto" onClick={() => navigate('/client/plan')}>
                  See what you get
                </button>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Your records stay free either way.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ⚠️ "Herds & flocks" USED to live here as a read-mostly card with a
          head-count pencil. It is gone on purpose — `ClientFarmRecords` now
          renders the herd with its full composition and an editor, on both
          tiers, and two herd lists on one page is worse than either. */}

      {isFull && plots.length > 0 && (
        <section>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
            <Wheat size={13} /> Crop plots
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {plots.map((p) => (
              <div key={p.id} className="cp-card">
                <p className="text-sm font-bold text-slate-800 truncate">{p.name}</p>
                <p className="text-[11px] text-slate-500">{p.crop}</p>
                <p className="text-[10px] text-slate-400 mt-1">Harvest {fmtDate(p.expectedHarvestOn)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {records.length > 0 && (
        <section>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Recent yield</h3>
          <div className="cp-card divide-y divide-slate-100">
            {records.slice(0, 8).map((r) => (
              <div key={r.id} className="py-2 flex items-center justify-between">
                <span className="text-xs text-slate-500">{fmtDate(r.recordedOn)}</span>
                <span className="text-sm font-bold text-slate-800">{r.quantity} <span className="text-[10px] font-normal text-slate-400">{r.unit}</span></span>
              </div>
            ))}
          </div>
        </section>
      )}

      {requesting && (
        <CpModal title="Request a vet visit" onClose={() => setRequesting(false)}>
          <div className="space-y-3">
            <div>
              <label className="field-label">What's the problem?</label>
              <textarea className="field-textarea" rows={3} autoFocus value={reqReason}
                onChange={(e) => setReqReason(e.target.value)}
                placeholder="e.g. Three cows off feed since yesterday, one with swollen udder" />
            </div>
            {groups.length > 0 && (
              <div>
                <label className="field-label">Which herd? (optional)</label>
                <select className="field-select" value={reqGroup} onChange={(e) => setReqGroup(e.target.value)}>
                  <option value="">Whole farm</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="field-label">How urgent?</label>
              <select className="field-select" value={reqUrgency} onChange={(e) => setReqUrgency(e.target.value)}>
                <option value="ROUTINE">Routine — next time you're nearby</option>
                <option value="SOON">Soon — within a few days</option>
                <option value="URGENT">Urgent — today if possible</option>
              </select>
            </div>
            <button onClick={submitVisitRequest} disabled={saving}
              className="w-full py-3 rounded-xl bg-pine text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />} Send request
            </button>
          </div>
        </CpModal>
      )}

      {editHead && (
        <CpModal title={`${editHead.name} — head count`} onClose={() => setEditHead(null)}>
          <div className="space-y-3">
            <div>
              <label className="field-label">How many animals now?</label>
              <input className="field-input" type="number" inputMode="numeric" min="0" autoFocus
                value={headVal} onChange={(e) => setHeadVal(e.target.value)} />
              <p className="mt-1 text-[10px] text-slate-400">
                Keep this current so your vet sees the right numbers.
              </p>
            </div>
            <button onClick={saveHeadCount} disabled={saving}
              className="w-full py-3 rounded-xl bg-pine text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />} Save
            </button>
          </div>
        </CpModal>
      )}

      {recording && (
        <CpModal title={`Record ${recording.produce}`} onClose={() => setRecording(null)}>
          <div className="space-y-3">
            <div>
              <label className="field-label">Quantity ({recording.unit})</label>
              <input
                className="field-input" type="number" inputMode="decimal" min="0" step="0.1"
                autoFocus value={qty} onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <button
              onClick={submitProduce}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-pine text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving && <Loader2 size={13} className="animate-spin" />} Record
            </button>
          </div>
        </CpModal>
      )}
    </div>
  );
};

export default ClientFarms;
