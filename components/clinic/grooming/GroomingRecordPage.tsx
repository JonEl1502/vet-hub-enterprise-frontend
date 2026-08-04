import React, { useState, useEffect } from 'react';
import { ArrowLeft, Scissors, Dog, ExternalLink } from 'lucide-react';
import { Visit } from '../../../types';
import { groomingAPI } from '../../../services';
import { useData } from '../../../contexts/DataContext';
import GroomingPanel from '../appointments/GroomingPanel';
import RecordActionBar, { RecordActionBarSpacer } from '../shared/RecordActionBar';
import { RecordActionProvider, useRecordActionSlot } from '../shared/RecordActionContext';
import RecordPageHeader from '../shared/RecordPageHeader';
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

      {/* One column (user, 2026-08-03), matching the boarding stay: the report
          card gets the full width and the controls run under it. */}
      <div className="space-y-4">
        {/* Report card — intake, before/after, groomer notes, consumables. */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-2.5 sm:p-4 shadow-sm">
          <GroomingPanel appointment={appointment} onSaved={onChanged}
            notesFormat={gRec ? { value: gRec.displayFormat || 'PARAGRAPH', onChange: (v) => patchRec({ displayFormat: v }) } : undefined}
            onFinalize={locked ? undefined : () => onOpenAppointment?.(String(appointment.id))} />
        </div>

        {/* Status / share / linked-visit controls — full width, below. */}
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
