/**
 * Clinic-facing detail on a client's farms — herds, crop plots, and individual
 * animals at the same depth the client sees on their own portal. Gated by the
 * CLIENT's own subscription (`livestock:farms`), not the clinic's Farms add-on:
 * a clinic with no livestock module at all can still see that a client farms
 * and needs to subscribe to unlock the per-animal register.
 */
import React, { useEffect, useState } from 'react';
import { Lock, ChevronDown, ChevronRight, Sprout, Wheat, Scale, Utensils, Droplet } from 'lucide-react';
import {
  clientLivestockAPI,
  type ClientLivestockAccess,
  type ClientFarm,
  type ClientFarmDetail,
  type ClientFarmAnimal,
  type ClientAnimalFeedingLog,
  type ClientAnimalProduceRecord,
} from '../../../services/modules/clientLivestock.api';

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

const LockedPanel: React.FC<{ access: Extract<ClientLivestockAccess, { locked: true }> }> = ({ access }) => (
  <div className="border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl p-4 flex items-start gap-3">
    <Lock size={16} className="text-amber-500 shrink-0 mt-0.5" />
    <div className="min-w-0">
      <p className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">
        No individual animal records
      </p>
      <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-1">
        This client is on {access.currentPackageName ?? 'the Free plan'} and hasn't subscribed to per-animal
        tracking, so their individual animals are hidden here too.
        {access.cheapestPackage && (
          <>
            {' '}Encourage them to upgrade to <strong>{access.cheapestPackage.name}</strong> ({access.cheapestPackage.currency}{' '}
            {access.cheapestPackage.amount.toLocaleString()}/mo) to unlock it.
          </>
        )}
      </p>
    </div>
  </div>
);

const AnimalRow: React.FC<{ a: ClientFarmAnimal; clientId: string }> = ({ a, clientId }) => {
  const [open, setOpen] = useState(false);
  const [feedingLogs, setFeedingLogs] = useState<ClientAnimalFeedingLog[] | null>(null);
  const [produceRecords, setProduceRecords] = useState<ClientAnimalProduceRecord[] | null>(null);

  useEffect(() => {
    if (!open || feedingLogs) return;
    Promise.all([
      clientLivestockAPI.listAnimalFeedingLogs(clientId, a.id),
      clientLivestockAPI.listAnimalProduceRecords(clientId, a.id),
    ])
      .then(([f, p]) => {
        if (f.success && f.data) setFeedingLogs(f.data);
        if (p.success && p.data) setProduceRecords(p.data);
      })
      .catch(() => { /* a log read must never break the profile */ });
  }, [open, feedingLogs, clientId, a.id]);

  return (
    <div className="border border-slate-200 dark:border-zinc-800 rounded-lg p-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-center gap-1.5">
            {open ? <ChevronDown size={12} className="text-slate-400 shrink-0" /> : <ChevronRight size={12} className="text-slate-400 shrink-0" />}
            <div className="min-w-0">
              <p className="text-[12px] font-black text-pine dark:text-zinc-100 truncate">{a.name}</p>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                {[a.breed, a.species, a.sex].filter(Boolean).join(' · ') || a.species}
              </p>
            </div>
          </div>
          <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${
            a.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'
          }`}>{a.status}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400">
          {a.tagNumber && <span>Tag {a.tagNumber}</span>}
          {a.weightValue != null && (
            <span className="inline-flex items-center gap-1"><Scale size={10} /> {a.weightValue}{a.weightUnit} ({fmtDate(a.weighedOn)})</span>
          )}
          {a.isPregnant && <span className="text-pink-500 font-bold">Pregnant</span>}
          {a.isLactating && <span className="text-sky-500 font-bold">Lactating</span>}
          {a.dob && <span>Born {fmtDate(a.dob)}{a.dobIsApprox ? ' (approx)' : ''}</span>}
        </div>
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1"><Utensils size={10} /> Feeding</p>
            {!feedingLogs ? (
              <p className="text-[10px] text-slate-400">Loading…</p>
            ) : feedingLogs.length === 0 ? (
              <p className="text-[10px] text-slate-400">No feeding logged yet.</p>
            ) : (
              <div className="space-y-1">
                {feedingLogs.slice(0, 5).map((l) => (
                  <div key={l.id} className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">{fmtDate(l.fedAt)}</span>
                    <span className="font-bold text-slate-600 dark:text-zinc-300">{l.quantityKg != null ? `${l.quantityKg}kg` : '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1"><Droplet size={10} /> Produce</p>
            {!produceRecords ? (
              <p className="text-[10px] text-slate-400">Loading…</p>
            ) : produceRecords.length === 0 ? (
              <p className="text-[10px] text-slate-400">No produce logged yet.</p>
            ) : (
              <div className="space-y-1">
                {produceRecords.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">{fmtDate(r.recordedOn)}{r.produce ? ` · ${r.produce}` : ''}</span>
                    <span className="font-bold text-slate-600 dark:text-zinc-300">{r.quantity}{r.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const FarmCard: React.FC<{ farm: ClientFarm; access: ClientLivestockAccess; clientId: string }> = ({ farm, access, clientId }) => {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ClientFarmDetail | null>(null);
  const [animals, setAnimals] = useState<ClientFarmAnimal[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || detail) return;
    setLoading(true);
    Promise.all([
      clientLivestockAPI.getFarmDetail(clientId, farm.id),
      access.locked ? Promise.resolve(null) : clientLivestockAPI.listFarmAnimals(clientId, farm.id),
    ])
      .then(([detailRes, animalsRes]) => {
        if (detailRes.success && detailRes.data) setDetail(detailRes.data);
        if (animalsRes?.success && animalsRes.data && !animalsRes.data.locked) setAnimals(animalsRes.data.animals);
      })
      .catch(() => { /* a farm read must never break the profile */ })
      .finally(() => setLoading(false));
  }, [open, detail, clientId, farm.id, access.locked]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-50/60 dark:hover:bg-zinc-800/40"
      >
        <div className="min-w-0 flex items-center gap-2">
          {open ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
          <Sprout size={14} className="text-seafoam shrink-0" />
          <div className="min-w-0">
            <p className="text-[12px] font-black text-pine dark:text-zinc-100 truncate">{farm.name}</p>
            <p className="text-[10px] text-slate-400 truncate">
              {[farm.farmType, farm.county, farm.location].filter(Boolean).join(' · ') || 'No location set'}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right text-[10px] text-slate-400">
          {farm.headCount} head · {farm.animalGroupCount} herd{farm.animalGroupCount === 1 ? '' : 's'} · {farm.cropPlotCount} plot{farm.cropPlotCount === 1 ? '' : 's'}
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100 dark:border-zinc-800 p-4 space-y-4">
          {loading && !detail && <p className="text-[11px] text-slate-400">Loading…</p>}
          {detail && detail.animalGroups.length > 0 && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Herds & flocks</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {detail.animalGroups.map((g) => (
                  <div key={g.id} className="border border-slate-200 dark:border-zinc-800 rounded-lg p-3">
                    <p className="text-[11px] font-black text-pine dark:text-zinc-100">{g.name}</p>
                    <p className="text-[10px] text-slate-400">{[g.breed, g.species].filter(Boolean).join(' · ')}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{g.headCount} head{g.purpose ? ` · ${g.purpose}` : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {detail && detail.cropPlots.length > 0 && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Crop plots</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {detail.cropPlots.map((p) => (
                  <div key={p.id} className="border border-slate-200 dark:border-zinc-800 rounded-lg p-3">
                    <p className="text-[11px] font-black text-pine dark:text-zinc-100 flex items-center gap-1.5"><Wheat size={12} className="text-amber-500" /> {p.name}</p>
                    <p className="text-[10px] text-slate-400">{p.crop}{p.sizeAcres != null ? ` · ${p.sizeAcres} acres` : ''}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Planted {fmtDate(p.plantedOn)} · Harvest {fmtDate(p.expectedHarvestOn)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Individual animals</p>
            {access.locked ? (
              <LockedPanel access={access} />
            ) : animals && animals.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {animals.map((a) => <AnimalRow key={a.id} a={a} clientId={clientId} />)}
              </div>
            ) : animals ? (
              <p className="text-[11px] text-slate-400">No individual animals recorded yet.</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

const ClientLivestockDetail: React.FC<{ clientId: string }> = ({ clientId }) => {
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
    <div className="space-y-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Farm & animal records</p>
      {access.locked && <LockedPanel access={access} />}
      {farms.map((f) => <FarmCard key={f.id} farm={f} access={access} clientId={clientId} />)}
    </div>
  );
};

export default ClientLivestockDetail;
