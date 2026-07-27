/**
 * Farm Settings — the full record for one farm, deeper than the quick-add
 * modal on the Farms list.
 *
 * Its reason to exist is **care linkage**: a farm may be served by the clinic,
 * by an independent vet officer (a county vet), by both, or by neither. That
 * relationship is the thing a farm's setup is actually about, so it leads the
 * page rather than sitting at the bottom of a form.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Settings2, Save, Loader2, Stethoscope, Building2, UserCheck, X,
  Archive, MapPin, Search,
} from 'lucide-react';
import { livestockAPI, type Farm, type VetOfficer } from '../../services/modules/livestock.api';
import { useClinic } from '../../contexts/ClinicContext';
import { toast, dialog } from '../../services';
import LoadingSpinner from '../shared/common/LoadingSpinner';
import { LivestockPage, EmptyState, Field, FarmFilter } from './shared';

const FARM_TYPES = [
  { value: 'MIXED', label: 'Mixed (animals + crops)' },
  { value: 'LIVESTOCK', label: 'Livestock only' },
  { value: 'CROP', label: 'Crops only' },
];

/**
 * Vet-officer picker. Two pools are shown as separate groups because they mean
 * different things: a clinic vet is staff here, an independent is a county
 * officer or private practitioner the farm uses instead of (or alongside) us.
 */
const VetOfficerPicker: React.FC<{
  officers: VetOfficer[];
  value: string | null;
  onChange: (id: string | null) => void;
}> = ({ officers, value, onChange }) => {
  const [q, setQ] = useState('');

  const { clinicVets, independents } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (o: VetOfficer) =>
      !needle || `${o.name} ${o.email} ${o.detail}`.toLowerCase().includes(needle);
    return {
      clinicVets: officers.filter((o) => o.kind === 'CLINIC_VET' && match(o)),
      independents: officers.filter((o) => o.kind === 'INDEPENDENT' && match(o)),
    };
  }, [officers, q]);

  const selected = officers.find((o) => o.id === value) || null;

  const Row: React.FC<{ o: VetOfficer }> = ({ o }) => (
    <button
      type="button"
      onClick={() => onChange(o.id === value ? null : o.id)}
      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all flex items-center gap-2.5 ${
        o.id === value
          ? 'border-pine bg-pine/5 dark:bg-pine/20'
          : 'border-slate-200 dark:border-zinc-800 hover:border-seafoam'
      }`}
    >
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
        o.kind === 'CLINIC_VET' ? 'bg-sky-100 dark:bg-sky-900/40 text-sky-600' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600'
      }`}>
        {o.kind === 'CLINIC_VET' ? <Building2 size={13} /> : <Stethoscope size={13} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-slate-800 dark:text-zinc-100 truncate">{o.name}</span>
        <span className="block text-[10px] text-slate-400 truncate">{o.detail}{o.phone ? ` · ${o.phone}` : ''}</span>
      </span>
      {o.id === value && <UserCheck size={14} className="text-pine dark:text-seafoam shrink-0" />}
    </button>
  );

  return (
    <div className="space-y-3">
      {selected ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-pine/5 dark:bg-pine/20 border border-pine/30">
          <span className="text-xs font-bold text-slate-800 dark:text-zinc-100 truncate">
            {selected.name}
            <span className="ml-2 text-[10px] font-normal text-slate-500">
              {selected.kind === 'CLINIC_VET' ? 'Clinic vet' : 'Independent'}
            </span>
          </span>
          <button type="button" onClick={() => onChange(null)} title="Unassign"
            className="text-slate-400 hover:text-rose-500 shrink-0"><X size={14} /></button>
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">
          No vet assigned — this farm is self-managed unless you link someone.
        </p>
      )}

      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="field-input pl-8" placeholder="Search vets…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="max-h-64 overflow-y-auto space-y-3 pr-0.5">
        {clinicVets.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Our clinic</p>
            {clinicVets.map((o) => <Row key={o.id} o={o} />)}
          </div>
        )}
        {independents.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Independent · county vet officers
            </p>
            {independents.map((o) => <Row key={o.id} o={o} />)}
          </div>
        )}
        {clinicVets.length === 0 && independents.length === 0 && (
          <p className="text-[11px] text-slate-400 py-3 text-center">No vets match that search.</p>
        )}
      </div>
    </div>
  );
};

const FarmSettingsView: React.FC = () => {
  const { clinics, selectedClinicIds } = useClinic();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [officers, setOfficers] = useState<VetOfficer[]>([]);
  const [farmId, setFarmId] = useState('');
  const [draft, setDraft] = useState<Partial<Farm> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, o] = await Promise.all([
        livestockAPI.listFarms({ includeInactive: true }),
        livestockAPI.listVetOfficers(),
      ]);
      if (f.success && f.data?.farms) {
        setFarms(f.data.farms);
        if (f.data.farms.length && !farmId) setFarmId(f.data.farms[0].id);
      }
      if (o.success && o.data?.officers) setOfficers(o.data.officers);
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load, selectedClinicIds.join(',')]);

  // Reset the draft whenever the selected farm changes so edits can't leak
  // from one farm onto another.
  useEffect(() => {
    const f = farms.find((x) => x.id === farmId);
    setDraft(f ? { ...f } : null);
  }, [farmId, farms]);

  const dirty = useMemo(() => {
    const original = farms.find((f) => f.id === farmId);
    if (!original || !draft) return false;
    return (['name', 'farmType', 'county', 'location', 'sizeAcres', 'notes', 'linkedClinicId', 'linkedVetUserId', 'isActive'] as const)
      .some((k) => (original as any)[k] !== (draft as any)[k]);
  }, [draft, farms, farmId]);

  const save = async () => {
    if (!draft || !farmId) return;
    if (!draft.name?.trim()) { toast.error('Farm name is required'); return; }
    setSaving(true);
    try {
      const res = await livestockAPI.updateFarm(farmId, {
        name: draft.name.trim(),
        farmType: draft.farmType,
        county: draft.county || null,
        location: draft.location || null,
        sizeAcres: draft.sizeAcres ?? null,
        notes: draft.notes || null,
        linkedClinicId: draft.linkedClinicId || null,
        linkedVetUserId: draft.linkedVetUserId || null,
        isActive: draft.isActive,
      } as any);
      if (res.success && res.data?.farm) {
        setFarms((prev) => prev.map((f) => (f.id === farmId ? res.data!.farm : f)));
        toast.success('Farm settings saved');
      }
    } finally { setSaving(false); }
  };

  const archive = async () => {
    if (!draft || !farmId) return;
    const ok = await dialog.confirmDelete({
      title: 'Archive farm',
      message: 'Feeding and produce history is kept; the farm stops appearing in lists.',
      entityName: draft.name || 'this farm',
    });
    if (!ok) return;
    const res = await livestockAPI.deleteFarm(farmId);
    if (res.success) {
      toast.success('Farm archived');
      setFarms((prev) => prev.map((f) => (f.id === farmId ? { ...f, isActive: false } : f)));
      setDraft((d) => (d ? { ...d, isActive: false } : d));
    }
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><LoadingSpinner size="lg" message="Loading farm settings..." /></div>;
  }

  if (farms.length === 0) {
    return (
      <LivestockPage title="Farm Settings" subtitle="Care linkage and farm details" icon={Settings2}>
        <EmptyState icon={Settings2} title="No farms yet" hint="Register a farm on the Farms page first." />
      </LivestockPage>
    );
  }

  return (
    <LivestockPage
      title="Farm Settings"
      subtitle="Care linkage and farm details"
      icon={Settings2}
      actions={
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="px-4 py-2.5 rounded-xl bg-pine text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:opacity-90 disabled:opacity-40 transition-all"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
        </button>
      }
    >
      <FarmFilter farms={farms} value={farmId} onChange={setFarmId} allowAll={false} />

      {draft && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Care linkage leads — it's what a farm's setup is actually about. */}
          <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 lg:row-span-2">
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Stethoscope size={15} className="text-pine dark:text-seafoam" /> Care linkage
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Who looks after this farm. Both are optional and independent — a farm can
                use our clinic, an outside vet officer, both, or neither.
              </p>
            </div>

            <Field label="Registered clinic">
              <select
                className="field-select"
                value={draft.linkedClinicId ?? ''}
                onChange={(e) => setDraft({ ...draft, linkedClinicId: e.target.value || null })}
              >
                <option value="">Not linked to a clinic</option>
                {clinics.map((c: any) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </Field>

            <div>
              <label className="field-label">Attending vet officer</label>
              <VetOfficerPicker
                officers={officers}
                value={draft.linkedVetUserId ?? null}
                onChange={(id) => setDraft({ ...draft, linkedVetUserId: id })}
              />
            </div>
          </section>

          {/* Farm details */}
          <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
            <h2 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
              <MapPin size={15} className="text-pine dark:text-seafoam" /> Farm details
            </h2>
            <Field label="Farm name">
              <input className="field-input" value={draft.name ?? ''}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Farm type">
              <select className="field-select" value={draft.farmType ?? 'MIXED'}
                onChange={(e) => setDraft({ ...draft, farmType: e.target.value as any })}>
                {FARM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="County">
                <input className="field-input" value={draft.county ?? ''}
                  onChange={(e) => setDraft({ ...draft, county: e.target.value })} />
              </Field>
              <Field label="Size (acres)">
                <input className="field-input" type="number" min="0" step="0.1" value={draft.sizeAcres ?? ''}
                  onChange={(e) => setDraft({ ...draft, sizeAcres: e.target.value === '' ? null : Number(e.target.value) })} />
              </Field>
            </div>
            <Field label="Location">
              <input className="field-input" value={draft.location ?? ''}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
            </Field>
            <Field label="Notes">
              <textarea className="field-textarea" rows={3} value={draft.notes ?? ''}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </Field>
            <p className="text-[11px] text-slate-400 pt-1">
              Owner · <span className="font-semibold text-slate-600 dark:text-zinc-300">{draft.ownerClientName || '—'}</span>
            </p>
          </section>

          {/* Status */}
          <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <h2 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Archive size={15} className="text-pine dark:text-seafoam" /> Status
            </h2>
            {draft.isActive ? (
              <>
                <p className="text-[11px] text-slate-400 mt-1 mb-3">
                  Archiving keeps all feeding and produce history — the farm just stops
                  appearing in working lists.
                </p>
                <button onClick={archive}
                  className="px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 text-[11px] font-black uppercase tracking-widest hover:bg-rose-50 dark:hover:bg-rose-900/20">
                  Archive farm
                </button>
              </>
            ) : (
              <>
                <p className="text-[11px] text-amber-600 mt-1 mb-3">This farm is archived.</p>
                <button onClick={() => setDraft({ ...draft, isActive: true })}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800">
                  Restore — then Save
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </LivestockPage>
  );
};

export default FarmSettingsView;
