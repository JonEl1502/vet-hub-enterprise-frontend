import React, { useState, useEffect } from 'react';
import { ArrowLeft, Scissors, Dog, ExternalLink } from 'lucide-react';
import { Visit } from '../../../types';
import { groomingAPI } from '../../../services';
import { useData } from '../../../contexts/DataContext';
import GroomingPanel from '../appointments/GroomingPanel';
import RecordActionBar, { RecordActionBarSpacer } from '../shared/RecordActionBar';
import { RecordActionProvider, useRecordActionSlot } from '../shared/RecordActionContext';
import RecordPageHeader, { STICKY_RAIL } from '../shared/RecordPageHeader';
import NotesFormatToggle from '../shared/NotesFormatToggle';
import AddCategoryService from '../shared/AddCategoryService';
import { deriveVisitStatus, STATUS_LABEL, STATUS_STYLE } from '../shared/visitStatus';

interface Props {
  appointment: Visit;
  onBack: () => void;
  onChanged: () => void;
  // Jump to the visit workflow (finalize + settle live there).
  onOpenAppointment?: (appointmentId: string, settle?: boolean) => void;
}

/**
 * Full-page grooming record — replaces the slide-over drawer so the report
 * card (intake, before/after photos, groomer notes, consumables) has proper
 * space. Same drawer→page migration as Lab and Imaging.
 */
const GroomingRecordPageInner: React.FC<Props> = ({ appointment, onBack, onChanged, onOpenAppointment }) => {
  // Terminal actions the report panel owns (Save report · Checkout). It holds
  // the handlers and the dirty/saving state; this page holds the bar. Empty
  // until the panel registers, so the bar simply renders without them.
  const panelActions = useRecordActionSlot();
  const { pets, clients } = useData();
  // The grooming record for this visit (carries Status + Notes-format).
  const [gRec, setGRec] = useState<any | null>(null);
  const [allRecs, setAllRecs] = useState<any[]>([]);
  useEffect(() => {
    let alive = true;
    groomingAPI.list({ appointmentId: appointment.id }).then(res => { if (alive && res.success) { setAllRecs(res.data?.records ?? []); setGRec(res.data?.records?.[0] ?? null); } }).catch(() => {});
    return () => { alive = false; };
  }, [appointment.id]);
  const patchRec = (data: any) => { if (gRec) groomingAPI.update(gRec.id, data).then(() => { setGRec({ ...gRec, ...data }); onChanged(); }).catch(() => {}); };
  // Status control applies to EVERY grooming service on the visit (each syncs
  // its own visit task server-side), so the derived status stays consistent
  // with the list card and workflow header — not just records[0].
  const setAllStatus = (v: string) => {
    setAllRecs(rs => rs.map(r => ({ ...r, status: v })));
    setGRec((r: any) => r ? { ...r, status: v } : r);
    Promise.all(allRecs.map(r => groomingAPI.update(r.id, { status: v }))).then(() => onChanged()).catch(() => {});
  };
  // Single display status derived from the visit's grooming tasks.
  const displayStatus = deriveVisitStatus(appointment, ['groom']);

  const pet = pets.find(p => p.id === appointment.petId);
  const owner = clients.find(c => c.id === appointment.clientId);
  const locked = !!appointment.isPaid || (appointment.status as string) === 'COMPLETED';

  /**
   * The rail's service lines. A grooming RECORD carries the service name and
   * whether it is billable; the visit TASK carries the price — so the figure
   * has to come from the join, not from either alone.
   *
   * ✅ Joined on `taskId` — the STABLE key. A grooming record has carried its
   * `task_id` since the per-service records moved into `grooming_records`, so
   * the name match this used to do was never necessary: renaming a service
   * dropped the price to 0 for no reason. Name is kept only as a fallback for
   * a record whose task was deleted out from under it.
   */
  const groomTasks = (appointment.tasks || []).filter(t => (t.category || '').toLowerCase().includes('groom'));
  const ccy = 'KES';
  const groomLines = allRecs.map((r: any, i: number) => {
    const t = groomTasks.find(tk => r.taskId != null && String(tk.id) === String(r.taskId))
      ?? groomTasks.find(tk => (tk.name || '').toLowerCase() === String(r.serviceName || '').toLowerCase());
    return {
      key: String(r.id ?? i),
      name: r.serviceName || t?.name || 'Grooming service',
      status: r.status,
      billable: r.billable !== false,
      price: Number((t as any)?.price) || 0,
    };
  });
  const groomTotal = groomLines.filter(l => l.billable).reduce((sum, l) => sum + l.price, 0);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-seafoam transition-all">
        <ArrowLeft size={13} /> Grooming
      </button>

      {/* Header banner — shared sticky/condensing header (2026-08-04). */}
      <RecordPageHeader
        accent="from-fuchsia-700 to-pink-600"
        icon={Scissors}
        eyebrow="Grooming visit"
        title={<><Dog size={16} /> {pet?.name ?? appointment.pet?.name ?? 'Patient'}</>}
        condensedMeta={pet?.species ?? ''}
        subtitle={`${pet?.breed ? `${pet.breed} · ` : ''}${pet?.species ?? ''}${owner?.name ? ` · Owner: ${owner.name}` : ''}`}
        right={
          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${STATUS_STYLE[displayStatus]}`}>
            {STATUS_LABEL[displayStatus]}
          </span>
        }
      />

      {/* TWO COLUMNS, matching the inpatient chart and boarding stay
          (user, 2026-08-05). Reverses the 2026-08-03 one-column call for the
          same reason boarding did: the rail is STICKY, so it follows you down
          a long report instead of being a strip you scroll past. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Report card — intake, before/after, groomer notes, consumables. */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-2.5 sm:p-4 shadow-sm">
          <GroomingPanel appointment={appointment} onSaved={onChanged}
            onFinalize={locked ? undefined : () => onOpenAppointment?.(String(appointment.id))} />
        </div>

        {/* SIDE RAIL — what's on this visit and what it comes to, plus the
            notes format. The inpatient rail's equivalent is its accruing
            charge; this is the grooming answer to "what will this bill?".
            Built from `allRecs` (the grooming records) joined to the visit's
            grooming TASKS, which is where the money lives — a record carries
            the service name and its billable flag, the task carries the price. */}
        <div className={`space-y-4 ${STICKY_RAIL}`}>
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-seafoam flex items-center gap-1.5">
                <Scissors size={13} /> Services
              </p>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                {groomLines.length || 0} on this visit
              </span>
            </div>

            {groomLines.length === 0 ? (
              <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                No grooming services yet — add one from the bar below.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {groomLines.map(l => (
                  <div key={l.key} className="py-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{l.name}</p>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {String(l.status || 'PENDING').replace(/_/g, ' ')}
                        {!l.billable && ' · not billed'}
                      </p>
                    </div>
                    <span className={`text-[11px] font-black shrink-0 ${l.billable ? 'text-pine dark:text-zinc-100' : 'text-slate-400 line-through'}`}>
                      {ccy} {l.price.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Billable only — a non-billable service is deliberately excluded
                from the figure, not just struck through in the list. */}
            {groomLines.length > 0 && (
              <div className="pt-1 flex items-center justify-between border-t border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bills at</span>
                <span className="text-sm font-black text-pine dark:text-zinc-100">{ccy} {groomTotal.toLocaleString()}</span>
              </div>
            )}
            <p className="text-[9px] text-slate-400 dark:text-zinc-500">
              Settled on the visit workflow, not here.
            </p>
          </div>

          {/* Moved out of the report card so the rail carries the record's
              controls, as inpatient's does. NotesFormatToggle renders its own
              heading — do not add a label above it. */}
          {gRec && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <NotesFormatToggle
                value={gRec.displayFormat || 'PARAGRAPH'}
                onChange={(v) => patchRec({ displayFormat: v })}
              />
            </div>
          )}
        </div>
      </div>

      {/* Actions + status are PINNED (user, 2026-08-04). They used to sit in a
          card at the very bottom, so on a long report you had to scroll past
          everything to change the status or jump to the visit. Anything beyond
          the inline limit collapses into "More" so the bar never wraps.
          Save report + Checkout join them here — the panel registers them
          through RecordActionContext, because it owns the handlers while the
          bar belongs to this page (user, 2026-08-04). */}
      <RecordActionBarSpacer />
      <RecordActionBar
        status={gRec ? { value: gRec.status || 'PENDING', options: ['PENDING', 'IN_PROGRESS', 'COMPLETED'], onChange: setAllStatus, disabled: locked } : undefined}
        hint={panelActions.find(a => a.note)?.note || 'Finalize & settle live on the visit workflow'}
        slot={!locked ? (
          <AddCategoryService
            appointmentId={appointment.id}
            categoryKeyword="groom"
            taskCategory="Grooming"
            existingNames={appointment.tasks.filter(tk => (tk.category || '').toLowerCase().includes('groom')).map(tk => tk.name)}
            existing={appointment.tasks.filter(tk => (tk.category || '').toLowerCase().includes('groom')).map(tk => ({ id: tk.id, name: tk.name }))}
            label="Add grooming service"
            tone="pink"
            onAdded={async () => { onChanged(); const res = await groomingAPI.list({ appointmentId: appointment.id }).catch(() => null); if (res?.success) { setAllRecs(res.data?.records ?? []); setGRec(res.data?.records?.[0] ?? null); } }}
          />
        ) : undefined}
        actions={[
          // Panel-owned terminal actions first — Save report / Checkout are what
          // you reach for; `primary` keeps Checkout inline when the rest overflow.
          ...panelActions.map(a => ({
            key: a.key,
            label: a.busy ? `${a.label}…` : a.label,
            icon: a.icon as React.ElementType | undefined,
            onClick: a.onClick,
            primary: a.primary,
            disabled: a.disabled,
          })),
          ...(appointment.id != null && onOpenAppointment ? [{
            key: 'linked', label: 'Linked appointment', icon: ExternalLink, tone: 'seafoam' as const,
            onClick: () => onOpenAppointment(String(appointment.id), false),
          }] : []),
        ]}
      />
    </div>
  );
};

/**
 * The provider must sit ABOVE both the panel (which registers) and the bar
 * (which renders), so the page body is an inner component — a hook called in
 * the same component that renders the provider would read the default,
 * empty context and the buttons would never appear.
 */
const GroomingRecordPage: React.FC<Props> = (props) => (
  <RecordActionProvider>
    <GroomingRecordPageInner {...props} />
  </RecordActionProvider>
);

export default GroomingRecordPage;
