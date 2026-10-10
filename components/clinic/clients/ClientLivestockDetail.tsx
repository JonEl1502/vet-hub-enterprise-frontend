/**
 * A client's farms, as the clinic sees them — the same warm sand-and-coral look
 * as the farmer's own portal (Phase D), and the same depth: photos, who is in
 * calf or milking and when, what they were fed and gave, what treatments are
 * under withholding, and what is coming up — with a way to answer with advice.
 *
 * Gated by the CLIENT's own subscription (`livestock:farms`), not the clinic's
 * Farms add-on: a clinic with no livestock module can still see that a client
 * farms and needs to subscribe to unlock the per-animal register. The farmer's
 * MONEY is never shown here — only the clinical and husbandry record.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Lock, Sprout, Wheat, Scale, Utensils, Droplet, Baby, Milk, Beef, Stethoscope, ShieldAlert,
  CalendarClock, MessageSquarePlus, ChevronDown, ChevronUp, MapPin,
} from 'lucide-react';
import {
  clientLivestockAPI,
  type ClientLivestockAccess, type ClientFarm, type ClientFarmDetail, type ClientFarmAnimal,
  type ClientAnimalFeedingLog, type ClientAnimalProduceRecord, type ClientFarmTreatment,
} from '../../../services/modules/clientLivestock.api';
import { livestockAPI, type ClinicFarmReminder } from '../../../services/modules/livestock.api';
import { fmtDay, rel } from '../../client/views/AnimalBreeding';
import { AdviseModal } from '../dashboard/FarmRemindersCard';

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const DAY = 86_400_000;
const daysUntil = (iso: string) => { const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((new Date(`${iso.slice(0, 10)}T00:00:00`).getTime() - t.getTime()) / DAY); };

const SectionTitle: React.FC<{ icon: React.ElementType; children: React.ReactNode; right?: React.ReactNode }> = ({ icon: Icon, children, right }) => (
  <div className="flex items-center justify-between mb-2">
    <h4 className="text-xs font-black uppercase tracking-widest cp-muted flex items-center gap-1.5"><Icon size={12} /> {children}</h4>
    {right}
  </div>
);

const LockedPanel: React.FC<{ access: Extract<ClientLivestockAccess, { locked: true }> }> = ({ access }) => (
  <div className="cp-card p-4 flex items-start gap-3" style={{ borderStyle: 'dashed' }}>
    <span className="cp-icon-chip shrink-0"><Lock size={16} /></span>
    <div className="min-w-0">
      <p className="text-sm font-black" style={{ color: 'var(--cp-ink)' }}>Individual animals are on the Farmer plan</p>
      <p className="text-xs cp-muted mt-1 leading-relaxed">
        This client is on {access.currentPackageName ?? 'the Free plan'} and hasn't subscribed to per-animal
        tracking, so their animals, breeding dates and treatments are hidden here too.
        {access.cheapestPackage && (
          <> Encourage them to upgrade to <strong>{access.cheapestPackage.name}</strong> ({access.cheapestPackage.currency}{' '}
          {access.cheapestPackage.amount.toLocaleString()}/mo) to unlock it.</>
        )}
      </p>
    </div>
  </div>
);

const AnimalCard: React.FC<{ a: ClientFarmAnimal; clientId: string; onAdvise: (a: ClientFarmAnimal) => void }> = ({ a, clientId, onAdvise }) => {
  const [open, setOpen] = useState(false);
  const [feeding, setFeeding] = useState<ClientAnimalFeedingLog[] | null>(null);
  const [produce, setProduce] = useState<ClientAnimalProduceRecord[] | null>(null);
  const r = a.repro;

  useEffect(() => {
    if (!open || feeding) return;
    Promise.all([clientLivestockAPI.listAnimalFeedingLogs(clientId, a.id), clientLivestockAPI.listAnimalProduceRecords(clientId, a.id)])
      .then(([f, p]) => { if (f.success && f.data) setFeeding(f.data); if (p.success && p.data) setProduce(p.data); })
      .catch(() => { /* a log read must never break the profile */ });
  }, [open, feeding, clientId, a.id]);

  return (
    <div className="cp-card overflow-hidden" data-testid="clinic-animal">
      <button type="button" className="w-full text-left flex items-center gap-3 p-3" onClick={() => setOpen((v) => !v)}>
        {a.avatarUrl ? (
          <img src={a.avatarUrl} alt="" className="w-16 h-16 rounded-2xl object-cover shrink-0" loading="lazy" />
        ) : (
          <span className="w-16 h-16 rounded-2xl shrink-0 bg-gradient-to-br from-[#f79b70] to-[#e56a3c] text-white/90 flex items-center justify-center"><Beef size={26} strokeWidth={1.6} /></span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black truncate" style={{ color: 'var(--cp-ink)' }}>
            {a.name}{a.tagNumber ? <span className="cp-muted font-bold text-[11px]"> · #{a.tagNumber}</span> : null}
          </p>
          <p className="text-[11px] cp-muted truncate">{[a.species, a.breed, a.sex === 'MALE' ? 'Male' : a.sex === 'FEMALE' ? 'Female' : null].filter(Boolean).join(' · ')}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {a.isPregnant && <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white flex items-center gap-1"><Baby size={10} /> In calf</span>}
            {a.isLactating && <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500 text-white flex items-center gap-1"><Milk size={10} /> Milking{r?.daysInMilk != null ? ` · day ${r.daysInMilk}` : ''}</span>}
            {a.status !== 'ACTIVE' && <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-500 text-white">{a.status}</span>}
          </div>
        </div>
        {open ? <ChevronUp size={16} className="cp-muted shrink-0" /> : <ChevronDown size={16} className="cp-muted shrink-0" />}
      </button>

      {a.isPregnant && r?.dueOn && (
        <div className="mx-3 mb-3 rounded-xl px-3 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-xs space-y-0.5">
          <p className="flex justify-between"><span className="text-amber-900/70 dark:text-amber-200/70">Due{r.dueIsEstimate ? ' (est.)' : ''}</span><b>{fmtDay(r.dueOn)} <span className="font-normal opacity-70">· {rel(r.daysToDue)}</span></b></p>
          {r.dryOffOn && <p className="flex justify-between"><span className="text-amber-900/70 dark:text-amber-200/70">Stop milking</span><b className={a.isLactating && (r.dryOffInDays ?? 99) <= 14 ? 'text-rose-600' : ''}>{fmtDay(r.dryOffOn)}</b></p>}
          {r.nextMilkingOn && <p className="flex justify-between"><span className="text-amber-900/70 dark:text-amber-200/70">Milking starts again</span><b>{fmtDay(r.nextMilkingOn)}</b></p>}
        </div>
      )}

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-[var(--cp-border)] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest cp-muted mb-1.5 flex items-center gap-1"><Scale size={10} /> Weight</p>
              {a.weights.length === 0 ? <p className="text-[11px] cp-muted">None recorded.</p> : a.weights.slice(0, 4).map((w) => (
                <div key={w.id} className="flex justify-between text-[11px]"><span className="cp-muted">{fmtDate(w.weighedOn)}</span><b>{w.weightValue}{w.weightUnit}</b></div>
              ))}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest cp-muted mb-1.5 flex items-center gap-1"><Utensils size={10} /> Feeding</p>
              {!feeding ? <p className="text-[11px] cp-muted">Loading…</p> : feeding.length === 0 ? <p className="text-[11px] cp-muted">None logged.</p> : feeding.slice(0, 4).map((l) => (
                <div key={l.id} className="flex justify-between text-[11px]"><span className="cp-muted truncate">{fmtDate(l.fedAt)}{l.notes ? ` · ${l.notes}` : ''}</span><b>{l.quantityKg != null ? `${l.quantityKg}kg` : '—'}</b></div>
              ))}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest cp-muted mb-1.5 flex items-center gap-1"><Droplet size={10} /> Produce</p>
              {!produce ? <p className="text-[11px] cp-muted">Loading…</p> : produce.length === 0 ? <p className="text-[11px] cp-muted">None logged.</p> : produce.slice(0, 4).map((p) => (
                <div key={p.id} className="flex justify-between text-[11px]"><span className="cp-muted">{fmtDate(p.recordedOn)}{p.produce ? ` · ${p.produce}` : ''}</span><b>{p.quantity}{p.unit}</b></div>
              ))}
            </div>
          </div>
          <button className="cp-btn-ghost !py-2 !px-3 !text-[11px]" onClick={() => onAdvise(a)}><MessageSquarePlus size={13} /> Advise on {a.name}</button>
        </div>
      )}
    </div>
  );
};

const FarmPanel: React.FC<{ farm: ClientFarm; access: ClientLivestockAccess; clientId: string; defaultOpen: boolean }> = ({ farm, access, clientId, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [detail, setDetail] = useState<ClientFarmDetail | null>(null);
  const [animals, setAnimals] = useState<ClientFarmAnimal[] | null>(null);
  const [treatments, setTreatments] = useState<ClientFarmTreatment[] | null>(null);
  const [reminders, setReminders] = useState<ClinicFarmReminder[]>([]);
  const [advise, setAdvise] = useState<{ animal?: ClientFarmAnimal } | null>(null);

  const loadReminders = useCallback(() => {
    livestockAPI.listFarmReminders().then((r) => setReminders(r.success && r.data ? r.data.reminders.filter((x) => x.farmId === farm.id) : [])).catch(() => setReminders([]));
  }, [farm.id]);

  useEffect(() => {
    if (!open || detail) return;
    Promise.all([
      clientLivestockAPI.getFarmDetail(clientId, farm.id),
      access.locked ? Promise.resolve(null) : clientLivestockAPI.listFarmAnimals(clientId, farm.id),
      access.locked ? Promise.resolve(null) : clientLivestockAPI.listFarmTreatments(clientId, farm.id).catch(() => null),
    ]).then(([d, a, t]) => {
      if (d.success && d.data) setDetail(d.data);
      if (a?.success && a.data && !a.data.locked) setAnimals(a.data.animals);
      if (t?.success && t.data) setTreatments(t.data);
    }).catch(() => { /* a farm read must never break the profile */ });
    loadReminders();
  }, [open, detail, clientId, farm.id, access.locked, loadReminders]);

  const held = (treatments ?? []).filter((t) => t.meatHeld || t.milkHeld);

  return (
    <div className="space-y-3">
      <div className="cp-card p-4">
        <button type="button" className="w-full flex items-center gap-3 text-left" onClick={() => setOpen((v) => !v)}>
          <span className="cp-icon-chip shrink-0"><Sprout size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-black truncate" style={{ color: 'var(--cp-ink)' }}>{farm.name}</p>
            <p className="text-[11px] cp-muted flex items-center gap-1 truncate"><MapPin size={10} />{[farm.farmType, farm.county, farm.location].filter(Boolean).join(' · ') || 'No location set'}</p>
          </div>
          {open ? <ChevronUp size={16} className="cp-muted" /> : <ChevronDown size={16} className="cp-muted" />}
        </button>
        <div className="mt-3 grid grid-cols-3 text-center">
          {[['Head', farm.headCount], ['Kinds', farm.animalGroupCount], ['Plots', farm.cropPlotCount]].map(([l, v]) => (
            <div key={String(l)}><p className="text-lg font-black tabular-nums" style={{ color: 'var(--cp-ink)' }}>{v}</p><p className="text-[10px] font-black uppercase tracking-widest cp-muted">{l}</p></div>
          ))}
        </div>
        {farm.clinic && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest cp-accent-text flex items-center gap-1"><Stethoscope size={11} /> Cared for by {farm.clinic.name}</span>
            <button className="cp-btn-ghost !py-1.5 !px-3 !text-[11px]" onClick={() => setAdvise({})}><MessageSquarePlus size={13} /> Leave advice</button>
          </div>
        )}
      </div>

      {open && (
        <>
          {held.length > 0 && (
            <div className="rounded-2xl p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25" data-testid="withholding">
              <p className="text-xs font-black text-rose-700 dark:text-rose-300 flex items-center gap-1.5 mb-1.5"><ShieldAlert size={14} /> Under withholding now</p>
              {held.map((t) => (
                <p key={t.id} className="text-[11px] text-rose-800 dark:text-rose-200">
                  <b>{t.product}</b> · {t.target}
                  {t.milkHeld && t.milkSafeOn ? ` · milk safe ${fmtDay(t.milkSafeOn)}` : ''}
                  {t.meatHeld && t.meatSafeOn ? ` · meat safe ${fmtDay(t.meatSafeOn)}` : ''}
                </p>
              ))}
            </div>
          )}

          {reminders.length > 0 && (
            <div>
              <SectionTitle icon={CalendarClock}>Coming up</SectionTitle>
              <div className="cp-card overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800">
                {reminders.map((r) => (
                  <div key={r.id} className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0"><p className="text-sm font-bold truncate" style={{ color: 'var(--cp-ink)' }}>{r.title}</p><p className="text-[10px] cp-muted">{fmtDay(r.dueOn)} · {rel(daysUntil(r.dueOn))}{r.source === 'CLINIC' ? ' · your advice' : ''}</p></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <SectionTitle icon={Beef}>Animals</SectionTitle>
            {access.locked ? <LockedPanel access={access} />
              : animals && animals.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {animals.map((a) => <AnimalCard key={a.id} a={a} clientId={clientId} onAdvise={(x) => setAdvise({ animal: x })} />)}
                </div>
              ) : animals ? <p className="text-xs cp-muted">No individual animals recorded yet.</p> : <p className="text-xs cp-muted">Loading…</p>}
          </div>

          {detail && detail.animalGroups.length > 0 && (
            <div>
              <SectionTitle icon={Milk}>Herds &amp; flocks</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                {detail.animalGroups.map((g) => (
                  <div key={g.id} className="cp-card-soft p-3">
                    <p className="text-sm font-black" style={{ color: 'var(--cp-ink)' }}>{g.name}</p>
                    <p className="text-[11px] cp-muted">{[g.breed, g.species].filter(Boolean).join(' · ')}</p>
                    <p className="text-[11px] mt-1"><b>{g.headCount}</b> head{g.purpose ? ` · ${g.purpose}` : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {treatments && treatments.length > 0 && (
            <div>
              <SectionTitle icon={Stethoscope}>Treatments</SectionTitle>
              <div className="cp-card overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800">
                {treatments.slice(0, 8).map((t) => (
                  <div key={t.id} className="px-3.5 py-2.5">
                    <p className="text-sm font-bold" style={{ color: 'var(--cp-ink)' }}>{t.product}{t.dose ? ` · ${t.dose}` : ''}</p>
                    <p className="text-[10px] cp-muted">{fmtDate(t.treatedOn)} · {t.target}{t.administeredBy ? ` · by ${t.administeredBy.toLowerCase()}` : ''}{t.milkSafeOn ? ` · milk safe ${fmtDate(t.milkSafeOn)}` : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detail && detail.cropPlots.length > 0 && (
            <div>
              <SectionTitle icon={Wheat}>Crop plots</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                {detail.cropPlots.map((p) => (
                  <div key={p.id} className="cp-card-soft p-3"><p className="text-sm font-black" style={{ color: 'var(--cp-ink)' }}>{p.name}</p><p className="text-[11px] cp-muted">{p.crop}{p.sizeAcres != null ? ` · ${p.sizeAcres} acres` : ''}</p></div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {advise && (
        <AdviseModal
          farmId={farm.id} farmAnimalId={advise.animal?.id}
          context={advise.animal ? `${advise.animal.name} · ${farm.name}` : farm.name}
          onClose={() => setAdvise(null)} onSent={() => { setAdvise(null); loadReminders(); }}
        />
      )}
    </div>
  );
};

const ClientLivestockDetail: React.FC<{ clientId: string; /** Show just this farm (the Farms screen opens one at a time). */ onlyFarmId?: string }> = ({ clientId, onlyFarmId }) => {
  const [access, setAccess] = useState<ClientLivestockAccess | null>(null);
  const [farms, setFarms] = useState<ClientFarm[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([clientLivestockAPI.getAccess(clientId), clientLivestockAPI.listFarms(clientId)])
      .then(([accessRes, farmsRes]) => {
        if (cancelled) return;
        if (accessRes.success && accessRes.data) setAccess(accessRes.data);
        if (farmsRes.success && farmsRes.data) setFarms(farmsRes.data);
      })
      .catch(() => { /* a farm read must never break the profile */ });
    return () => { cancelled = true; };
  }, [clientId]);

  if (!farms || farms.length === 0 || !access) return null;

  return (
    <div className={onlyFarmId ? 'space-y-4' : 'farm-skin space-y-4'}>
      {farms.filter((f) => !onlyFarmId || f.id === onlyFarmId).map((f, i) => <FarmPanel key={f.id} farm={f} access={access} clientId={clientId} defaultOpen={i === 0} />)}
    </div>
  );
};

export default ClientLivestockDetail;
