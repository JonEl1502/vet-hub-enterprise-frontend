import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, Plus, Trash2, Loader2, Check, GripVertical, Layers,
  ClipboardList, AlertTriangle, Copy, Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy,
  sortableKeyboardCoordinates, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  workflowTemplatesAPI, WorkflowTemplate, FormField, LayoutStage, LayoutSection,
} from '../../../services';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import FieldPicker from './FieldPicker';
import { usePlanAccess } from '../../../contexts/PlanAccessContext';

/**
 * Visit workflow builder (backend migration 136).
 * Spec: backend/docs/DYNAMIC_FORM_BUILDER.md
 *
 * Edits the layout tree — stages → sections → fields — where ARRAY POSITION IS
 * THE ORDER. Nothing here stores coordinates: the wizard's grids are
 * responsive, and stored positions would break on every other viewport. A
 * field carries only `span` (how many columns it occupies) and `required`.
 *
 * Shipped presets are read-only on purpose. Editing one offers a fork instead,
 * which is what keeps our presets upgradeable for every clinic at once.
 */

interface Props {
  templateId: string | null;
  onBack: () => void;
  /** Opens the fork this page creates when a preset is customised. */
  onOpenTemplate?: (id: string) => void;
}

interface Draft {
  name: string;
  description: string;
  icon: string;
  encounterType: string;
  visitType: string;
  stages: LayoutStage[];
  isDefault: boolean;
}

const EMPTY: Draft = {
  name: '', description: '', icon: '', encounterType: '', visitType: '',
  stages: [], isDefault: false,
};

const slug = (s: string) =>
  (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'stage';

const leafOf = (key: string) => key.split('.').pop() || key;

// Mirrors resolveEntryPoint()'s switch — these are the visits a workflow can
// claim. Left blank, the workflow is only reachable as the clinic's default.
const ENCOUNTER_TYPES = ['', 'VET_VISIT', 'GROOMING', 'BOARDING'];
const VISIT_TYPES = ['', 'CONSULTATION', 'ROUTINE_CHECK', 'VACCINATION', 'DEWORMING', 'EMERGENCY', 'FOLLOW_UP', 'INPATIENT'];

// ── Sortable row primitive ────────────────────────────────────────────────
const Sortable: React.FC<{ id: string; children: (handle: React.ReactNode) => React.ReactNode }> = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };
  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-seafoam shrink-0 touch-none"
    >
      <GripVertical size={14} />
    </button>
  );
  return <div ref={setNodeRef} style={style}>{children(handle)}</div>;
};

const WorkflowBuilderPage: React.FC<Props> = ({ templateId, onBack, onOpenTemplate }) => {
  const [loading, setLoading] = useState(!!templateId);
  const [saving, setSaving] = useState(false);
  const [forking, setForking] = useState(false);
  const [source, setSource] = useState<WorkflowTemplate | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [fieldsByKey, setFieldsByKey] = useState<Record<string, FormField>>({});
  const [activeStage, setActiveStage] = useState(0);
  const [pickerFor, setPickerFor] = useState<string | null>(null); // section key

  // Two independent reasons a page is read-only, and the copy differs:
  //   1. a shipped preset — referenced live by every clinic, never edited in
  //      place; fork it instead;
  //   2. the plan no longer includes the builder (migration 138) — a clinic
  //      that downgrades keeps its workflows running and readable, it just
  //      cannot change them. Gating here means the save button is never
  //      offered only to 403 on click.
  const { can } = usePlanAccess();
  const canBuild = can('capability:workflow-builder');
  const isPreset = source?.ownerType === 'SYSTEM' || (source ? source.clinicId === null : false);
  const readOnly = isPreset || !canBuild;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    if (!templateId) { setDraft(EMPTY); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await workflowTemplatesAPI.getById(templateId);
      if (res.success && res.data?.template) {
        const t = res.data.template;
        setSource(t);
        setDraft({
          name: t.name,
          description: t.description || '',
          icon: t.icon || '',
          encounterType: t.encounterType || '',
          visitType: t.visitType || '',
          stages: Array.isArray(t.stages) ? t.stages : [],
          isDefault: t.isDefault,
        });
        const map: Record<string, FormField> = {};
        for (const f of t.fields || []) map[f.key] = f;
        setFieldsByKey(map);
      }
    } catch (e) { console.error(e); toast.error('Could not load that workflow'); }
    finally { setLoading(false); }
  }, [templateId]);
  useEffect(() => { load(); }, [load]);

  const stage = draft.stages[activeStage];

  // Keys and leaves already used in the ACTIVE stage. Leaves matter because
  // answers are stored as data[stage][leaf] — two fields sharing a leaf in one
  // stage would overwrite each other, and the API rejects it on save.
  const placedKeys = useMemo(
    () => new Set((stage?.sections || []).flatMap(s => s.fields.map(f => f.fieldKey))),
    [stage],
  );
  const claimedLeaves = useMemo(() => new Set([...placedKeys].map(leafOf)), [placedKeys]);

  const patchStage = (idx: number, patch: Partial<LayoutStage>) =>
    setDraft(d => ({ ...d, stages: d.stages.map((s, i) => (i === idx ? { ...s, ...patch } : s)) }));

  const patchSection = (sIdx: number, patch: Partial<LayoutSection>) =>
    patchStage(activeStage, {
      sections: (stage?.sections || []).map((sec, i) => (i === sIdx ? { ...sec, ...patch } : sec)),
    });

  // ── Stage ops ───────────────────────────────────────────────────────────
  const addStage = () => {
    const label = `Stage ${draft.stages.length + 1}`;
    const key = `${slug(label)}_${Date.now().toString(36).slice(-4)}`;
    setDraft(d => ({ ...d, stages: [...d.stages, { key, label, short: label, sections: [] }] }));
    setActiveStage(draft.stages.length);
  };

  const removeStage = (idx: number) => {
    setDraft(d => ({ ...d, stages: d.stages.filter((_, i) => i !== idx) }));
    setActiveStage(a => Math.max(0, a >= idx ? a - 1 : a));
  };

  const onStageDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setDraft(d => {
      const from = d.stages.findIndex(s => s.key === active.id);
      const to = d.stages.findIndex(s => s.key === over.id);
      if (from < 0 || to < 0) return d;
      // Keep the open stage open after it moves.
      setActiveStage(cur => (cur === from ? to : cur === to ? from : cur));
      return { ...d, stages: arrayMove(d.stages, from, to) };
    });
  };

  // ── Section ops ─────────────────────────────────────────────────────────
  const addSection = () => {
    const label = `Section ${(stage?.sections.length || 0) + 1}`;
    const key = `${slug(label)}_${Date.now().toString(36).slice(-4)}`;
    patchStage(activeStage, { sections: [...(stage?.sections || []), { key, label, fields: [] }] });
  };

  const removeSection = (sIdx: number) =>
    patchStage(activeStage, { sections: (stage?.sections || []).filter((_, i) => i !== sIdx) });

  const onSectionDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id || !stage) return;
    const from = stage.sections.findIndex(s => s.key === active.id);
    const to = stage.sections.findIndex(s => s.key === over.id);
    if (from < 0 || to < 0) return;
    patchStage(activeStage, { sections: arrayMove(stage.sections, from, to) });
  };

  // ── Field ops ───────────────────────────────────────────────────────────
  const addField = (sIdx: number, field: FormField) => {
    setFieldsByKey(m => ({ ...m, [field.key]: field }));
    const sec = stage!.sections[sIdx];
    patchSection(sIdx, { fields: [...sec.fields, { fieldKey: field.key, span: 1 }] });
    setPickerFor(null);
  };

  const patchField = (sIdx: number, fIdx: number, patch: Partial<{ span: number; required: boolean }>) => {
    const sec = stage!.sections[sIdx];
    patchSection(sIdx, { fields: sec.fields.map((f, i) => (i === fIdx ? { ...f, ...patch } : f)) });
  };

  const removeField = (sIdx: number, fIdx: number) => {
    const sec = stage!.sections[sIdx];
    patchSection(sIdx, { fields: sec.fields.filter((_, i) => i !== fIdx) });
  };

  const onFieldDragEnd = (sIdx: number) => (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id || !stage) return;
    const sec = stage.sections[sIdx];
    const from = sec.fields.findIndex(f => `${sec.key}:${f.fieldKey}` === active.id);
    const to = sec.fields.findIndex(f => `${sec.key}:${f.fieldKey}` === over.id);
    if (from < 0 || to < 0) return;
    patchSection(sIdx, { fields: arrayMove(sec.fields, from, to) });
  };

  // ── Persist ─────────────────────────────────────────────────────────────
  const fork = async () => {
    if (!source) return;
    setForking(true);
    try {
      const res = await workflowTemplatesAPI.fork(source.id);
      if (res.success && res.data?.template) {
        toast.success('Copied to your clinic — edit your copy freely');
        onOpenTemplate?.(res.data.template.id);
      } else toast.error(res.message || 'Could not copy that workflow');
    } catch (e: any) { toast.error(e?.message || 'Could not copy that workflow'); }
    finally { setForking(false); }
  };

  const save = async () => {
    if (!draft.name.trim()) { toast.error('Give the workflow a name'); return; }
    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      description: draft.description || null,
      icon: draft.icon || null,
      encounterType: draft.encounterType || null,
      visitType: draft.visitType || null,
      stages: draft.stages,
      isDefault: draft.isDefault,
    };
    try {
      const res = source && !readOnly
        ? await workflowTemplatesAPI.update(source.id, payload)
        : await workflowTemplatesAPI.create(payload);
      if (res.success && res.data?.template) {
        toast.success('Workflow saved');
        setSource(res.data.template);
        if (!source) onOpenTemplate?.(res.data.template.id);
      } else {
        // The API rejects layouts that would corrupt captured data — surface
        // its reason verbatim rather than a generic failure.
        toast.error(res.message || 'Could not save the workflow');
      }
    } catch (e: any) { toast.error(e?.message || 'Could not save the workflow'); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner />;

  const totalFields = draft.stages.reduce(
    (n, s) => n + s.sections.reduce((m, sec) => m + sec.fields.length, 0), 0,
  );

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-pine">
            <ChevronLeft size={16} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-black text-pine dark:text-zinc-100 tracking-tight uppercase truncate">
                {draft.name || 'New workflow'}
              </h1>
              {source?.ownerType === 'SYSTEM' && (
                <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest bg-seafoam/10 text-seafoam border border-seafoam/20">
                  Shipped preset · v{source.version}
                </span>
              )}
              {source?.basedOnId && (
                <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-500">
                  Copy of v{source.baseVersion}
                </span>
              )}
              {source?.visibility === 'SHARED' && (
                <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  Shared
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              Visit workflow · {draft.stages.length} stage{draft.stages.length === 1 ? '' : 's'} · {totalFields} field{totalFields === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {readOnly ? (
            canBuild && isPreset ? (
            <button
              onClick={fork}
              disabled={forking}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-seafoam/20 disabled:opacity-50"
            >
              {forking ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />} Customise a copy
            </button>
            ) : null
          ) : (
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-seafoam/20 disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save workflow
            </button>
          )}
        </div>
      </div>

      {readOnly && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-seafoam/5 border border-seafoam/20">
          <Lock size={13} className="text-seafoam shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed">
            {isPreset ? (
              <>
                This is a workflow we ship and keep improving — your clinic uses it live, so improvements reach you
                automatically. It can’t be edited directly. <strong>Customise a copy</strong> to make it yours; we’ll
                tell you when a newer version of the original is available.
              </>
            ) : (
              <>
                Your plan doesn’t include the workflow builder, so this is read-only. Your workflows keep running in
                consultations exactly as they are — <strong>upgrade to Pro</strong> to change them again.
              </>
            )}
          </p>
        </div>
      )}

      {/* ── Details ── */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="sm:col-span-2">
          <label className="field-label">Workflow name</label>
          <input
            className="field-input" disabled={readOnly}
            placeholder="e.g. Rabbit vaccination"
            value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="field-label">Opens on encounter</label>
          <select
            className="field-select" disabled={readOnly}
            value={draft.encounterType}
            onChange={e => setDraft(d => ({ ...d, encounterType: e.target.value }))}
          >
            {ENCOUNTER_TYPES.map(v => <option key={v} value={v}>{v || 'Any'}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Opens on visit type</label>
          <select
            className="field-select" disabled={readOnly}
            value={draft.visitType}
            onChange={e => setDraft(d => ({ ...d, visitType: e.target.value }))}
          >
            {VISIT_TYPES.map(v => <option key={v} value={v}>{v || 'Any'}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2 xl:col-span-4">
          <label className="field-label">Description</label>
          <input
            className="field-input" disabled={readOnly}
            placeholder="What this workflow is for"
            value={draft.description}
            onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] gap-4">
        {/* ── Stages ── */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3 h-fit">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Layers size={11} /> Stages
            </p>
            {!readOnly && (
              <button onClick={addStage} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-pine text-white text-[9px] font-black uppercase tracking-widest">
                <Plus size={10} /> Stage
              </button>
            )}
          </div>

          {!draft.stages.length && (
            <p className="text-[11px] text-slate-400 py-3 text-center">No stages yet — add the first one.</p>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onStageDragEnd}>
            <SortableContext items={draft.stages.map(s => s.key)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {draft.stages.map((s, i) => (
                  <Sortable key={s.key} id={s.key}>
                    {handle => (
                      <div
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border transition-all ${
                          i === activeStage
                            ? 'border-seafoam bg-seafoam/5'
                            : 'border-slate-200 dark:border-zinc-800 hover:border-seafoam/40'
                        }`}
                      >
                        {!readOnly && handle}
                        <span className="text-[9px] font-black text-slate-400 w-4 shrink-0">{i + 1}</span>
                        <button
                          type="button"
                          onClick={() => setActiveStage(i)}
                          className="flex-1 min-w-0 text-left text-[11px] font-bold text-pine dark:text-zinc-100 truncate"
                        >
                          {s.label}
                        </button>
                        <span className="text-[9px] text-slate-400 shrink-0">
                          {s.sections.reduce((n, sec) => n + sec.fields.length, 0)}
                        </span>
                        {!readOnly && (
                          <button onClick={() => removeStage(i)} className="text-slate-300 hover:text-red-500 shrink-0">
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    )}
                  </Sortable>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <p className="text-[9px] text-slate-400 leading-relaxed pt-1">
            Drag to reorder — the order here is the order a vet walks through the visit.
          </p>
        </div>

        {/* ── Sections + fields of the active stage ── */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3 min-w-0">
          {!stage ? (
            <p className="text-[11px] text-slate-400 py-8 text-center">Select a stage to lay out its questions.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[180px]">
                  <label className="field-label">Stage name</label>
                  <input
                    className="field-input" disabled={readOnly}
                    value={stage.label}
                    onChange={e => patchStage(activeStage, { label: e.target.value })}
                  />
                </div>
                <div className="w-32">
                  <label className="field-label">Stepper label</label>
                  <input
                    className="field-input" disabled={readOnly}
                    placeholder="Short"
                    value={stage.short || ''}
                    onChange={e => patchStage(activeStage, { short: e.target.value })}
                  />
                </div>
                {!readOnly && (
                  <button onClick={addSection} className="flex items-center gap-1 px-3 h-9 rounded-lg bg-seafoam/10 text-seafoam text-[10px] font-black uppercase tracking-widest">
                    <Plus size={11} /> Card
                  </button>
                )}
              </div>

              {!stage.sections.length && (
                <p className="text-[11px] text-slate-400 py-6 text-center">
                  No cards yet. A card is one titled box on the page — “Diet &amp; Intake”, “Systemic Examination”.
                </p>
              )}

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDragEnd}>
                <SortableContext items={stage.sections.map(s => s.key)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {stage.sections.map((sec, sIdx) => (
                      <Sortable key={sec.key} id={sec.key}>
                        {handle => (
                          <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800">
                              {!readOnly && handle}
                              <input
                                className="flex-1 min-w-0 bg-transparent text-[10px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 outline-none"
                                disabled={readOnly}
                                value={sec.label}
                                onChange={e => patchSection(sIdx, { label: e.target.value })}
                              />
                              <span className="text-[9px] text-slate-400 shrink-0">{sec.fields.length}</span>
                              {!readOnly && (
                                <button onClick={() => removeSection(sIdx)} className="text-slate-300 hover:text-red-500 shrink-0">
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>

                            <div className="p-2.5 space-y-1.5">
                              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onFieldDragEnd(sIdx)}>
                                <SortableContext
                                  items={sec.fields.map(f => `${sec.key}:${f.fieldKey}`)}
                                  strategy={verticalListSortingStrategy}
                                >
                                  {sec.fields.map((pf, fIdx) => {
                                    const def = fieldsByKey[pf.fieldKey];
                                    const isNative = def?.fieldType === 'native';
                                    return (
                                      <Sortable key={`${sec.key}:${pf.fieldKey}`} id={`${sec.key}:${pf.fieldKey}`}>
                                        {handle => (
                                          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                                            {!readOnly && handle}
                                            <span className="flex-1 min-w-0">
                                              <span className="block text-[11px] font-bold text-pine dark:text-zinc-100 truncate">
                                                {def?.label || pf.fieldKey}
                                              </span>
                                              <span className="block text-[9px] font-mono text-slate-400 truncate">{pf.fieldKey}</span>
                                            </span>

                                            {isNative && (
                                              <span title="Built-in block — position it, but its internals are fixed" className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-slate-100 dark:bg-zinc-800 text-slate-500 shrink-0">
                                                Built-in
                                              </span>
                                            )}

                                            {/* Width in grid columns — not pixels. */}
                                            <div className="hidden sm:flex items-center gap-0.5 shrink-0">
                                              {[1, 2, 3].map(n => (
                                                <button
                                                  key={n}
                                                  type="button"
                                                  disabled={readOnly}
                                                  onClick={() => patchField(sIdx, fIdx, { span: n })}
                                                  className={`w-5 h-5 rounded text-[9px] font-black transition-all ${
                                                    (pf.span || 1) === n
                                                      ? 'bg-seafoam text-white'
                                                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:text-seafoam'
                                                  }`}
                                                  title={`${n} column${n > 1 ? 's' : ''} wide`}
                                                >
                                                  {n}
                                                </button>
                                              ))}
                                            </div>

                                            <button
                                              type="button"
                                              disabled={readOnly}
                                              onClick={() => patchField(sIdx, fIdx, { required: !pf.required })}
                                              className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shrink-0 transition-all ${
                                                pf.required
                                                  ? 'bg-red-500/10 text-red-500'
                                                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'
                                              }`}
                                            >
                                              Req
                                            </button>

                                            {!readOnly && (
                                              <button onClick={() => removeField(sIdx, fIdx)} className="text-slate-300 hover:text-red-500 shrink-0">
                                                <Trash2 size={11} />
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </Sortable>
                                    );
                                  })}
                                </SortableContext>
                              </DndContext>

                              {!readOnly && (
                                pickerFor === sec.key ? (
                                  <FieldPicker
                                    placedKeys={placedKeys}
                                    claimedLeaves={claimedLeaves}
                                    onPick={f => addField(sIdx, f)}
                                    onClose={() => setPickerFor(null)}
                                  />
                                ) : (
                                  <button
                                    onClick={() => setPickerFor(sec.key)}
                                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-slate-300 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:border-seafoam hover:text-seafoam transition-colors"
                                  >
                                    <Plus size={11} /> Add field
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </Sortable>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </>
          )}
        </div>
      </div>

      {/* ── Preview ── */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-3">
          <ClipboardList size={11} /> Workflow preview
        </p>
        {!draft.stages.length ? (
          <p className="text-[11px] text-slate-400">Nothing to preview yet.</p>
        ) : (
          <div className="space-y-2">
            {draft.stages.map((s, i) => {
              const count = s.sections.reduce((n, sec) => n + sec.fields.length, 0);
              return (
                <div key={s.key} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-seafoam/10 text-seafoam text-[9px] font-black flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 truncate">{s.label}</p>
                    <p className="text-[10px] text-slate-400">
                      {count ? `${s.sections.length} card${s.sections.length === 1 ? '' : 's'} · ${count} field${count === 1 ? '' : 's'}` : 'no fields'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {draft.stages.some(s => !s.sections.some(sec => sec.fields.length)) && (
          <p className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 mt-3">
            <AlertTriangle size={11} /> A stage with no fields is skipped in the visit.
          </p>
        )}
      </div>
    </div>
  );
};

export default WorkflowBuilderPage;
