import React from 'react';
import { Users, UserPlus, X, Star, Loader2, ClipboardList, Wrench } from 'lucide-react';
import { visitsAPI, toast } from '../../../services';
import type { VisitEncounter, VisitRegisteredBy } from '../../../services/modules/appointments.api';
import { useStaff } from '../../../contexts/StaffContext';

/**
 * WHO WORKED THIS VISIT — one row per encounter, plus whoever registered it.
 *
 * The clinic's attribution was already in the database and simply had no screen:
 * `visit_encounter_staff` (106/172) records who attended each encounter, and 127
 * added `appointments.created_by` for the person who booked it — front desk, who
 * is involved in nearly every visit and was the one participant nobody recorded
 * (user, 2026-08-04).
 *
 * Assignment is per ENCOUNTER, not per visit, because that is the unit the work
 * actually happened in: the groomer attended the groom, the vet attended the
 * consult, and a single visit-level "attending staff" field cannot express that.
 *
 * ⚠️ Saving REPLACES the encounter's whole team — the picker sends the full list
 * and the server keeps `lead_staff_id` in sync with the starred member. Staff
 * fees are INTERNAL cost and are never billed (the standing rule from 106), so
 * no money is shown here at all.
 */

interface Props {
  visitId: string | number;
  /** Locked once the record is locked — attribution is part of the record. */
  readOnly?: boolean;
}

const staffName = (u: any): string =>
  u?.name
  || [u?.profile?.title, u?.profile?.firstName, u?.profile?.secondName, u?.profile?.surname].filter(Boolean).join(' ')
  || u?.email
  || `Staff #${u?.id}`;

const prettyType = (e: VisitEncounter) =>
  [e.encounterType, e.visitType].filter(Boolean).join(' · ').replace(/_/g, ' ');

const VisitTeamPanel: React.FC<Props> = ({ visitId, readOnly }) => {
  const { staff } = useStaff();
  const [encounters, setEncounters] = React.useState<VisitEncounter[]>([]);
  const [registeredBy, setRegisteredBy] = React.useState<VisitRegisteredBy | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [pickerFor, setPickerFor] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  // Services/procedures on this visit, so staff can be credited per line. A
  // procedure anchors to a task, so both appear here and use the same endpoint.
  const [tasks, setTasks] = React.useState<{ id: string; name: string; encounterId: string | null; attendance?: any[] }[]>([]);
  // The visit's own type, so a visit with NO encounter can be given its primary
  // one from here instead of dead-ending (user, 2026-08-04: "i cant add or
  // remove staff from visit"). Attribution hangs off encounters, so with none
  // there was literally nothing to attach a person to.
  const [visitType, setVisitType] = React.useState<{ encounterType: string; visitType: string | null } | null>(null);
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const [r, v] = await Promise.all([
        visitsAPI.listEncounters(visitId),
        visitsAPI.getById(Number(visitId)).catch(() => null),
      ]);
      if (r.success && r.data) {
        setEncounters(r.data.encounters || []);
        setRegisteredBy(r.data.registeredBy ?? null);
      }
      const appt = (v as any)?.data?.appointment ?? (v as any)?.data ?? null;
      if (appt) setVisitType({ encounterType: String(appt.encounterType || 'VET_VISIT'), visitType: appt.visitType ?? null });
      const vt = appt?.tasks ?? [];
      setTasks(Array.isArray(vt) ? vt.map((t: any) => ({
        id: String(t.id), name: t.name, encounterId: t.encounterId != null ? String(t.encounterId) : null, attendance: t.attendance ?? [],
      })) : []);
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  React.useEffect(() => { load(); }, [load]);

  const save = async (enc: VisitEncounter, next: NonNullable<VisitEncounter['attendingStaff']>) => {
    setSavingId(enc.id);
    // Optimistic: the picker should feel instant. Reverted from the server
    // response below, so a rejected save can't leave a phantom assignee.
    setEncounters(prev => prev.map(e => (e.id === enc.id ? { ...e, attendingStaff: next } : e)));
    try {
      const r = await visitsAPI.setEncounterStaff(
        visitId, enc.id,
        next.map(s => ({ userId: s.userId, role: s.role, isLead: s.isLead })),
      );
      if (r.success && r.data?.encounter) {
        setEncounters(prev => prev.map(e => (e.id === enc.id ? r.data!.encounter : e)));
      } else { await load(); }
    } catch {
      await load();
      toast.error('Could not update the visit team');
    } finally {
      setSavingId(null);
    }
  };

  const addStaff = (enc: VisitEncounter, userId: string, name: string, role: string | null) => {
    const cur = enc.attendingStaff ?? [];
    if (cur.some(s => String(s.userId) === String(userId))) return;
    save(enc, [...cur, { id: `tmp-${userId}`, userId, role, fee: null, isLead: cur.length === 0, name }]);
    setPickerFor(null);
    setSearch('');
  };

  const removeStaff = (enc: VisitEncounter, userId: string) => {
    const cur = enc.attendingStaff ?? [];
    const next = cur.filter(s => String(s.userId) !== String(userId));
    // The server re-leads the first entry if the lead was the one removed;
    // mirror that here so the optimistic view matches what comes back.
    if (next.length && !next.some(s => s.isLead)) next[0] = { ...next[0], isLead: true };
    save(enc, next);
  };

  const saveTask = async (taskId: string, next: any[]) => {
    setSavingId(`task-${taskId}`);
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, attendance: next } : t)));
    try {
      await visitsAPI.setTaskStaff(visitId, taskId, next.map(s => ({ userId: s.userId, role: s.role, isLead: s.isLead })));
      // Reload so the encounter roll-up reflects the change — the credit shows
      // under the encounter, not only on the service row.
      await load();
    } catch {
      await load();
      toast.error('Could not update the service team');
    } finally { setSavingId(null); }
  };

  /** Give a bare visit its primary encounter so a team can be recorded. */
  const startEncounter = async () => {
    setCreating(true);
    try {
      const r = await visitsAPI.addEncounter(visitId, {
        encounterType: visitType?.encounterType || 'VET_VISIT',
        visitType: visitType?.visitType ?? undefined,
      });
      if (r.success) { toast.success('Encounter added — assign the team below'); await load(); }
    } catch (e: any) { toast.error(e?.message || 'Could not add the encounter'); }
    finally { setCreating(false); }
  };

  const makeLead = (enc: VisitEncounter, userId: string) => {
    const cur = enc.attendingStaff ?? [];
    save(enc, cur.map(s => ({ ...s, isLead: String(s.userId) === String(userId) })));
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 flex items-center gap-2 text-slate-400">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest">Loading visit team…</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-seafoam" />
          <h3 className="text-[11px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">Visit team</h3>
        </div>
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Internal · never billed</span>
      </div>

      {/* Registered by — the front-desk half of the attribution. */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
        <ClipboardList size={13} className="text-slate-400 shrink-0" />
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Registered by</span>
        <span className="text-[11px] font-bold text-pine dark:text-zinc-100 truncate">
          {registeredBy?.name || '—'}
        </span>
        {registeredBy?.role && (
          <span className="px-1.5 py-0.5 rounded-md bg-slate-200/60 dark:bg-zinc-700 text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-300 shrink-0">
            {registeredBy.role.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {encounters.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 p-4 space-y-2.5">
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
            Staff are recorded against an <b>encounter</b> — the consult, the groom, the surgery —
            because that is the unit the work happened in. This visit has none yet, so there is
            nothing to assign anyone to.
          </p>
          {!readOnly && (
            <button type="button" onClick={startEncounter} disabled={creating}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-seafoam text-white text-[10px] font-black uppercase tracking-widest hover:bg-seafoam/90 disabled:opacity-50 transition-all">
              {creating ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
              Add {String(visitType?.encounterType || 'visit').replace(/_/g, ' ').toLowerCase()} encounter
            </button>
          )}
          <p className="text-[10px] text-slate-400">Or add one in Clinical Workflow — either way its team appears here.</p>
        </div>
      )}

      {encounters.map(enc => {
        const team = enc.attendingStaff ?? [];
        const busy = savingId === enc.id;
        const picking = pickerFor === enc.id;
        const encTasks = tasks.filter(t => String(t.encounterId) === String(enc.id));
        const available = staff.filter(u =>
          !team.some(s => String(s.userId) === String(u.id))
          && (!search || staffName(u).toLowerCase().includes(search.toLowerCase())),
        );
        return (
          <div key={enc.id} className="rounded-xl border border-slate-100 dark:border-zinc-800 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-zinc-800/60">
              <span className="text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 truncate">
                {prettyType(enc)}
                {enc.isPrimary && <span className="ml-1.5 text-[8px] text-seafoam">primary</span>}
              </span>
              {busy && <Loader2 size={12} className="animate-spin text-slate-400 shrink-0" />}
            </div>

            <div className="p-3 space-y-2">
              {team.length === 0 && (
                <p className="text-[10px] text-slate-400 font-medium italic">Nobody assigned yet.</p>
              )}
              {team.map(s => (
                <div key={String(s.userId)} className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={readOnly || busy}
                    onClick={() => makeLead(enc, String(s.userId))}
                    title={s.isLead ? 'Lead for this encounter' : 'Make lead'}
                    className={`shrink-0 ${s.isLead ? 'text-amber-500' : 'text-slate-300 dark:text-zinc-600 hover:text-amber-400'} disabled:cursor-not-allowed`}
                  >
                    <Star size={13} fill={s.isLead ? 'currentColor' : 'none'} />
                  </button>
                  <span className="text-[11px] font-bold text-pine dark:text-zinc-100 truncate flex-1">{s.name || `Staff #${s.userId}`}</span>
                  {s.role && (
                    <span className="px-1.5 py-0.5 rounded-md bg-seafoam/10 text-seafoam text-[8px] font-black uppercase tracking-widest shrink-0">{s.role.replace(/_/g, ' ')}</span>
                  )}
                  {!readOnly && (
                    <button
                      type="button" disabled={busy}
                      onClick={() => removeStaff(enc, String(s.userId))}
                      title="Remove from this encounter"
                      className="shrink-0 text-slate-300 dark:text-zinc-600 hover:text-rose-500 disabled:cursor-not-allowed"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}

              {!readOnly && !picking && (
                <button
                  type="button" disabled={busy}
                  onClick={() => { setPickerFor(enc.id); setSearch(''); }}
                  className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-seafoam hover:text-pine dark:hover:text-zinc-100 transition-colors disabled:opacity-50"
                >
                  <UserPlus size={12} /> Assign staff
                </button>
              )}

              {/* Credited through a SERVICE or PROCEDURE rather than added to
                  the encounter directly. Shown here so the encounter's stats
                  read as one number, but kept visually distinct — and never
                  overwritten when the encounter team is saved. */}
              {(enc.serviceStaff?.length ?? 0) > 0 && (
                <div className="pt-2 mt-1 border-t border-slate-100 dark:border-zinc-800 space-y-1">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Via services</p>
                  {enc.serviceStaff!.map(ss => (
                    <div key={`${ss.taskId}-${ss.userId}`} className="flex items-center gap-2">
                      <Wrench size={11} className="text-slate-300 dark:text-zinc-600 shrink-0" />
                      <span className="text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{ss.name || `Staff #${ss.userId}`}</span>
                      <span className="text-[9px] text-slate-400 truncate">· {ss.via}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Per-service assignment. Optional by design — a blank service is
                  normal and the encounter team still covers it. */}
              {!readOnly && encTasks.length > 0 && (
                <div className="pt-2 mt-1 border-t border-slate-100 dark:border-zinc-800 space-y-1.5">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Services &amp; procedures — optional</p>
                  {encTasks.map(t => {
                    const cur = t.attendance ?? [];
                    const tBusy = savingId === `task-${t.id}`;
                    const tPicking = pickerFor === `task-${t.id}`;
                    const avail = staff.filter(u =>
                      !cur.some((x: any) => String(x.userId) === String(u.id))
                      && (!search || staffName(u).toLowerCase().includes(search.toLowerCase())));
                    return (
                      <div key={t.id} className="rounded-lg bg-slate-50 dark:bg-zinc-950/40 px-2.5 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-pine dark:text-zinc-100 truncate flex-1">{t.name}</span>
                          {tBusy && <Loader2 size={11} className="animate-spin text-slate-400 shrink-0" />}
                          <button
                            type="button" disabled={tBusy}
                            onClick={() => { setPickerFor(tPicking ? null : `task-${t.id}`); setSearch(''); }}
                            className="text-[8px] font-black uppercase tracking-widest text-seafoam hover:text-pine dark:hover:text-zinc-100 shrink-0 disabled:opacity-50"
                          >
                            {tPicking ? 'Done' : cur.length ? 'Change' : 'Assign'}
                          </button>
                        </div>
                        {cur.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {cur.map((x: any) => (
                              <span key={String(x.userId)} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-[9px] font-bold text-pine dark:text-zinc-200">
                                {x.name || `#${x.userId}`}
                                <button type="button" disabled={tBusy}
                                  onClick={() => saveTask(t.id, cur.filter((y: any) => String(y.userId) !== String(x.userId)))}
                                  className="text-slate-300 hover:text-rose-500 disabled:cursor-not-allowed"><X size={9} /></button>
                              </span>
                            ))}
                          </div>
                        )}
                        {tPicking && (
                          <div className="mt-1.5 space-y-1">
                            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff…" className="field-input py-1 text-[11px] w-full" />
                            <div className="max-h-32 overflow-y-auto custom-scrollbar rounded-lg border border-slate-100 dark:border-zinc-800 divide-y divide-slate-50 dark:divide-zinc-800/60 bg-white dark:bg-zinc-900">
                              {avail.length === 0 && <p className="px-2 py-1.5 text-[10px] text-slate-400">No matching staff.</p>}
                              {avail.slice(0, 30).map(u => (
                                <button key={String(u.id)} type="button"
                                  onClick={() => { saveTask(t.id, [...cur, { userId: String(u.id), role: (u as any).role ?? null, isLead: cur.length === 0, name: staffName(u) }]); setPickerFor(null); setSearch(''); }}
                                  className="w-full text-left px-2 py-1 hover:bg-slate-50 dark:hover:bg-zinc-800 text-[10px] font-bold text-pine dark:text-zinc-100 truncate">
                                  {staffName(u)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!readOnly && picking && (
                <div className="space-y-1.5 pt-1">
                  <input
                    autoFocus value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search staff…"
                    className="field-input py-1.5 text-xs w-full"
                  />
                  <div className="max-h-40 overflow-y-auto custom-scrollbar rounded-lg border border-slate-100 dark:border-zinc-800 divide-y divide-slate-50 dark:divide-zinc-800/60">
                    {available.length === 0 && (
                      <p className="px-3 py-2 text-[10px] text-slate-400 font-medium">No matching staff.</p>
                    )}
                    {available.slice(0, 40).map(u => (
                      <button
                        key={String(u.id)} type="button"
                        onClick={() => addStaff(enc, String(u.id), staffName(u), (u as any).role ?? null)}
                        className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center justify-between gap-2"
                      >
                        <span className="text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{staffName(u)}</span>
                        {(u as any).role && (
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 shrink-0">{String((u as any).role).replace(/_/g, ' ')}</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button" onClick={() => { setPickerFor(null); setSearch(''); }}
                    className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-pine dark:hover:text-zinc-100"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default VisitTeamPanel;
