/**
 * Farm home for the pet-owner portal in FARM mode.
 *
 * The farmer's daily loop is: what needs feeding, what produce is due, log it.
 * So this screen leads with those two actions rather than with a farm list —
 * most accounts have one farm, and making them tap into it first would put a
 * navigation step in front of the only thing they came to do.
 *
 * Farms themselves are created by the clinic, not here: this is the owner's
 * view of records their vet maintains, plus the daily entries only they can
 * make.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Sprout, Milk, Wheat, Check, Loader2, CalendarClock, AlertTriangle, Plus, MapPin } from 'lucide-react';
import {
  clientPortalAPI,
  type PortalFarm, type PortalFeedingPlan, type PortalProduceSchedule,
  type PortalProduceRecord, type PortalAnimalGroup, type PortalCropPlot,
} from '../../../services/modules/clientPortal.api';
import { toast } from '../../../services';
import CpModal from '../CpModal';

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
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    clientPortalAPI.getMyFarms()
      .then((r) => {
        if (r.success && r.data?.farms) {
          setFarms(r.data.farms);
          if (r.data.farms.length) setActiveId(r.data.farms[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const loadFarm = useCallback(async (farmId: string) => {
    if (!farmId) return;
    const [d, f, p] = await Promise.all([
      clientPortalAPI.getFarmDetail(farmId),
      clientPortalAPI.getFarmFeeding(farmId),
      clientPortalAPI.getFarmProduce(farmId),
    ]);
    if (d.success && d.data) { setGroups(d.data.animalGroups); setPlots(d.data.cropPlots); }
    if (f.success && f.data) setPlans(f.data.plans);
    if (p.success && p.data) { setSchedules(p.data.schedules); setRecords(p.data.records); }
  }, []);

  useEffect(() => { loadFarm(activeId); }, [activeId, loadFarm]);

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
        loadFarm(activeId); // next-due rolled forward server-side
      }
    } finally { setSaving(false); }
  };

  const fedToday = (d: string | null) => !!d && new Date(d).toDateString() === new Date().toDateString();
  const isDue = (d: string | null) => !!d && new Date(d).getTime() <= Date.now();
  const active = farms.find((f) => f.id === activeId);

  if (loading) {
    return <div className="cp-card text-center py-12 text-sm text-slate-400">Loading your farm…</div>;
  }

  if (farms.length === 0) {
    return (
      <div className="cp-card text-center py-14">
        <Sprout size={26} className="mx-auto text-slate-300" />
        <p className="mt-3 text-sm font-bold text-slate-700">No farm on your account yet</p>
        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
          Your clinic registers your farm. Once it's set up, your herds, feeding plans and
          produce records appear here.
        </p>
      </div>
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
        <div className="cp-card">
          <div className="flex items-start justify-between gap-3">
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
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div><p className="text-lg font-black text-slate-800">{active.headCount}</p><p className="text-[9px] uppercase tracking-widest text-slate-400">Head</p></div>
            <div><p className="text-lg font-black text-slate-800">{active.animalGroupCount}</p><p className="text-[9px] uppercase tracking-widest text-slate-400">Groups</p></div>
            <div><p className="text-lg font-black text-slate-800">{active.cropPlotCount}</p><p className="text-[9px] uppercase tracking-widest text-slate-400">Plots</p></div>
          </div>
        </div>
      )}

      {/* Feeding — the daily action, first */}
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

      {/* Produce due */}
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

      {/* Herds & plots — reference, read-only (the clinic maintains these) */}
      {groups.length > 0 && (
        <section>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
            <Milk size={13} /> Herds & flocks
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {groups.map((g) => (
              <div key={g.id} className="cp-card">
                <p className="text-sm font-bold text-slate-800 truncate">{g.name}</p>
                <p className="text-[11px] text-slate-500">{g.species}{g.breed ? ` · ${g.breed}` : ''}</p>
                <p className="mt-1 text-lg font-black text-slate-800">{g.headCount}
                  <span className="text-[9px] font-normal uppercase tracking-widest text-slate-400 ml-1">head</span></p>
              </div>
            ))}
          </div>
        </section>
      )}

      {plots.length > 0 && (
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
