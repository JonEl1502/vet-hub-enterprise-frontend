import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Stethoscope, Sprout, Loader2, MapPin, Milk, Syringe, Phone, ChevronRight,
  ArrowLeft, CircleDollarSign,
} from 'lucide-react';
import {
  livestockAPI, type Farm, type FarmVisit, type FarmVisitDetail, type AnimalGroup,
} from '../../services/modules/livestock.api';
import { toast } from '../../services';
import LoadingSpinner from '../shared/common/LoadingSpinner';
import { LivestockPage, EmptyState, Modal, Field, FarmFilter, fmtDate, fmtDateTime } from './shared';

/**
 * 299 — the clinic's FARM visit list, separate from its pet visit list.
 *
 * User, 2026-09-14: *"let Farm have separate visits lists from clinic …
 * according Practitioner: Full clinical records and visits / Herds, feeding and
 * produce. it means the record must still show its for farm not cinic."*
 *
 * ⚠️ SEPARATION IS STRUCTURAL, NOT A FILTER. These rows live in `farm_visits`
 * and the pet engine's rows live in `appointments`; neither query can see the
 * other, so nothing has to remember to exclude anything. What this screen owes
 * the user is the other half: every row SAYS it is a farm record, names the
 * farm, and names what was seen — a herd, one animal, or the whole place.
 */

const STATUS_TONE: Record<string, string> = {
  SCHEDULED: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  IN_PROGRESS: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  COMPLETED: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  CANCELLED: 'bg-slate-100 dark:bg-zinc-800 text-slate-500',
};

const KINDS = [
  'ROUTINE', 'FOLLOW_UP', 'EMERGENCY', 'VACCINATION', 'AI', 'HERD_HEALTH', 'OTHER',
] as const;

const KIND_LABEL: Record<string, string> = {
  ROUTINE: 'Routine', FOLLOW_UP: 'Follow-up', EMERGENCY: 'Emergency',
  VACCINATION: 'Vaccination', AI: 'AI / breeding', HERD_HEALTH: 'Herd health', OTHER: 'Other',
};

const FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: '', label: 'All' },
];

/**
 * ⚠️ The badge that answers "which list am I in". Small, always present, and
 * on the row rather than only the page header — a screenshot of one row has to
 * be unambiguous too.
 */
const FarmBadge: React.FC = () => (
  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300 text-[9px] font-black uppercase tracking-widest shrink-0">
    <Sprout size={9} /> Farm
  </span>
);

const money = (n: number, c: string) =>
  `${c} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const FarmVisitRecordsView: React.FC = () => {
  const [visits, setVisits] = useState<FarmVisit[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [groups, setGroups] = useState<AnimalGroup[]>([]);
  const [filter, setFilter] = useState('open');
  const [farmId, setFarmId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<FarmVisitDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<any>({
    farmId: '', kind: 'ROUTINE', reason: '', animalGroupId: '', seenCount: '',
    scheduledAt: new Date().toISOString().slice(0, 16), vetName: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [v, f] = await Promise.all([
      livestockAPI.listFarmVisits({ status: filter || undefined, farmId: farmId || undefined }),
      livestockAPI.listFarms(),
    ]);
    if (v.success && v.data) setVisits(v.data.visits);
    if (f.success && f.data) setFarms(f.data.farms);
    setLoading(false);
  }, [filter, farmId]);

  useEffect(() => { load(); }, [load]);

  // Herds are only offered once a farm is chosen — a herd list spanning every
  // farm the clinic serves would be a hundred rows and most of them wrong.
  useEffect(() => {
    if (!form.farmId) { setGroups([]); return; }
    livestockAPI.listAnimalGroups(form.farmId).then((r) => {
      if (r.success && r.data) setGroups(r.data.groups);
    });
  }, [form.farmId]);

  const openDetail = async (v: FarmVisit) => {
    const r = await livestockAPI.getFarmVisit(v.id);
    if (r.success && r.data) setDetail(r.data.visit);
  };

  const save = async () => {
    if (!form.farmId) { toast.error('Which farm?'); return; }
    setSaving(true);
    try {
      const r = await livestockAPI.createFarmVisit({
        farmId: form.farmId,
        kind: form.kind,
        reason: form.reason.trim() || null,
        animalGroupId: form.animalGroupId || null,
        seenCount: form.seenCount === '' ? null : Number(form.seenCount),
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        vetName: form.vetName.trim() || null,
      });
      if (r.success) {
        toast.success('Farm visit recorded');
        setCreating(false);
        setForm({ ...form, reason: '', animalGroupId: '', seenCount: '' });
        await load();
      }
    } finally { setSaving(false); }
  };

  const patchDetail = async (data: Record<string, unknown>) => {
    if (!detail) return;
    setSaving(true);
    try {
      const r = await livestockAPI.updateFarmVisit(detail.id, data as any);
      if (r.success) {
        const fresh = await livestockAPI.getFarmVisit(detail.id);
        if (fresh.success && fresh.data) setDetail(fresh.data.visit);
        await load();
      }
    } finally { setSaving(false); }
  };

  const grouped = useMemo(() => {
    const byFarm = new Map<string, FarmVisit[]>();
    visits.forEach((v) => byFarm.set(v.farmId, [...(byFarm.get(v.farmId) ?? []), v]));
    return [...byFarm.entries()];
  }, [visits]);

  // ── One visit, in full ────────────────────────────────────────────────────
  if (detail) {
    return (
      <LivestockPage
        title={detail.farmName ?? 'Farm visit'}
        subtitle={`${KIND_LABEL[detail.kind] ?? detail.kind} · ${fmtDateTime(detail.scheduledAt)}`}
        icon={Stethoscope}
        actions={
          <button
            onClick={() => setDetail(null)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-[11px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5"
          >
            <ArrowLeft size={13} /> Visits
          </button>
        }
      >
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <FarmBadge />
            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${STATUS_TONE[detail.status]}`}>
              {detail.status.replace('_', ' ')}
            </span>
            <span className="text-xs font-bold text-slate-500">{detail.subject}</span>
            {detail.seenCount != null && (
              <span className="text-xs text-slate-400">· {detail.seenCount} seen</span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            {detail.farmLocation && (
              <div className="flex items-center gap-1.5 text-slate-500">
                <MapPin size={12} /> {detail.farmLocation}
              </div>
            )}
            {detail.ownerName && (
              <div className="flex items-center gap-1.5 text-slate-500">
                <Phone size={12} /> {detail.ownerName}{detail.ownerPhone ? ` · ${detail.ownerPhone}` : ''}
              </div>
            )}
            {detail.vetName && (
              <div className="flex items-center gap-1.5 text-slate-500">
                <Stethoscope size={12} /> {detail.vetName}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-slate-500">
              <CircleDollarSign size={12} /> {money(detail.totalCost, detail.currency)}
              {detail.isPaid ? ' · paid' : ' · unpaid'}
            </div>
          </div>

          {/* The clinical record. Editable in place — a vet writing up in the
              car should not have to open a dialog per field. */}
          {([
            ['reason', 'Why they called'],
            ['findings', 'What was found'],
            ['diagnosis', 'Diagnosis'],
            ['plan', 'Plan'],
          ] as const).map(([key, label]) => (
            <Field key={key} label={label}>
              <textarea
                className="field-input w-full"
                rows={key === 'reason' ? 2 : 3}
                defaultValue={(detail as any)[key] ?? ''}
                onBlur={(e) => {
                  const next = e.target.value;
                  if (next !== ((detail as any)[key] ?? '')) patchDetail({ [key]: next });
                }}
              />
            </Field>
          ))}

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Status">
              <select className="field-select w-full" value={detail.status}
                      onChange={(e) => patchDetail({ status: e.target.value })}>
                {['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </Field>
            <Field label="Charged">
              <input className="field-input w-full" type="number" min="0"
                     defaultValue={detail.totalCost}
                     onBlur={(e) => patchDetail({ totalCost: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Travel (km)">
              <input className="field-input w-full" type="number" min="0"
                     defaultValue={detail.travelKm ?? ''}
                     onBlur={(e) => patchDetail({ travelKm: e.target.value === '' ? null : Number(e.target.value) })} />
            </Field>
          </div>

          {/* Treatments given on this visit — the withdrawal dates are the
              reason a farm record exists at all. */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Treatments on this visit
            </h4>
            {detail.treatments.length === 0 ? (
              <p className="text-xs text-slate-400">Nothing recorded against this visit.</p>
            ) : (
              <div className="space-y-2">
                {detail.treatments.map((t) => (
                  <div key={t.id} className="flex items-start gap-2 text-xs">
                    <Syringe size={12} className="mt-0.5 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-700 dark:text-zinc-200">
                        {t.product}
                        {t.dose ? ` · ${t.dose}` : ''}{t.route ? ` · ${t.route}` : ''}
                      </div>
                      <div className="text-slate-400">
                        {fmtDate(t.treatedOn)}
                        {t.treatedCount != null ? ` · ${t.treatedCount} head` : ''}
                        {t.milkSafeOn ? ` · milk safe ${fmtDate(t.milkSafeOn)}` : ''}
                        {t.meatSafeOn ? ` · meat safe ${fmtDate(t.meatSafeOn)}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </LivestockPage>
    );
  }

  // ── The list ──────────────────────────────────────────────────────────────
  return (
    <LivestockPage
      title="Farm Visits"
      subtitle="Attendances at your farm clients — separate from the clinic's own visit list"
      icon={Stethoscope}
      actions={
        <button
          onClick={() => { setForm({ ...form, farmId: farmId || farms[0]?.id || '' }); setCreating(true); }}
          className="px-4 py-2.5 rounded-xl bg-pine text-white text-[11px] font-black uppercase tracking-widest hover:opacity-90"
        >
          Record a visit
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                filter === f.id
                  ? 'bg-white dark:bg-zinc-800 text-pine dark:text-zinc-100 shadow-sm'
                  : 'text-slate-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <FarmFilter farms={farms} value={farmId} onChange={setFarmId} />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : visits.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="No farm visits yet"
          hint="Record an attendance and it is kept here — with the farm, the herd and the withdrawal dates — never mixed in with the clinic's pet visits."
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(([fid, rows]) => (
            <div key={fid}>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                <Sprout size={11} /> {rows[0].farmName}
                {rows[0].farmLocation && <span className="font-bold normal-case tracking-normal text-slate-300">· {rows[0].farmLocation}</span>}
              </h3>
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-slate-100 dark:divide-zinc-800 overflow-hidden">
                {rows.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => openDetail(v)}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* ⚠️ On the ROW, not only the page. */}
                        <FarmBadge />
                        <span className="text-sm font-bold text-slate-800 dark:text-zinc-100 truncate">
                          {v.subject}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${STATUS_TONE[v.status]}`}>
                          {v.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {KIND_LABEL[v.kind] ?? v.kind} · {fmtDateTime(v.scheduledAt)}
                        {v.animalGroupSpecies ? ` · ${v.animalGroupSpecies}` : ''}
                        {v.seenCount != null ? ` · ${v.seenCount} seen` : ''}
                        {v.treatmentCount > 0 ? ` · ${v.treatmentCount} treatment${v.treatmentCount === 1 ? '' : 's'}` : ''}
                      </div>
                    </div>
                    {v.totalCost > 0 && (
                      <span className={`shrink-0 text-xs font-black tabular-nums ${v.isPaid ? 'text-emerald-600' : 'text-slate-500'}`}>
                        {money(v.totalCost, v.currency)}
                      </span>
                    )}
                    <ChevronRight size={14} className="shrink-0 text-slate-300" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <Modal title="Record a farm visit" onClose={() => setCreating(false)} onSave={save} saving={saving}>
          <Field label="Farm">
            <select className="field-select w-full" value={form.farmId}
                    onChange={(e) => setForm({ ...form, farmId: e.target.value, animalGroupId: '' })}>
              <option value="">Choose…</option>
              {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
          <Field label="What kind of visit">
            <select className="field-select w-full" value={form.kind}
                    onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </Field>
          <Field label="When">
            <input className="field-input w-full" type="datetime-local" value={form.scheduledAt}
                   onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
          </Field>
          {groups.length > 0 && (
            <Field label="Which herd or flock — optional">
              <select className="field-select w-full" value={form.animalGroupId}
                      onChange={(e) => setForm({ ...form, animalGroupId: e.target.value })}>
                <option value="">The whole farm</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} — {g.species}{g.headCount ? ` (${g.headCount})` : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="How many head seen — optional">
            <input className="field-input w-full" type="number" min="0" placeholder="—"
                   value={form.seenCount} onChange={(e) => setForm({ ...form, seenCount: e.target.value })} />
          </Field>
          <Field label="Why they called">
            <textarea className="field-input w-full" rows={3} placeholder="Three cows off feed since Tuesday"
                      value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </Field>
          <Field label="Who attended — optional">
            <input className="field-input w-full" placeholder="Dr Wanjiku"
                   value={form.vetName} onChange={(e) => setForm({ ...form, vetName: e.target.value })} />
          </Field>
        </Modal>
      )}
    </LivestockPage>
  );
};

export default FarmVisitRecordsView;
