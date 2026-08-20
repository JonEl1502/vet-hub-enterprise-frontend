import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardList, Loader2, Trash2, Check, Zap, AlertTriangle, Plus, Calculator, ChevronDown, ChevronRight, Pencil, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { procedureTemplatesAPI, consumablesAPI, ProcedureApplication, ProcedureTemplate, dialog } from '../../../services';
import QtyUnitControl from './QtyUnitControl';

interface Props {
  appointmentId: string | number;
  // Scope to the application anchored on ONE service task (module pages).
  // Omit to show every procedure applied to the visit.
  taskId?: string | number | null;
  billLocked?: boolean;
  currency?: string;
  onChanged?: () => void;
  /**
   * Bump to force a reload from the server.
   *
   * ⚠️ Load-bearing wherever something OUTSIDE this panel can apply or remove a
   * recipe. The panel holds its own `apps` list and only refetches on mount or
   * after its own mutations, so a recipe applied by the host — the wizard's
   * Treatment step has its own procedure search — billed the lines while this
   * panel went on showing its empty "Apply a procedure recipe…" picker
   * (user, 2026-08-19: applied procedure on the bill, nothing under Procedures
   * performed).
   */
  refreshKey?: string | number;
  /**
   * Controlled picker. When provided, the recipe search is OPENED FROM OUTSIDE —
   * the "Add procedure" button beside "Add item" on the bill — instead of the
   * panel carrying a permanently-visible dropdown of its own.
   */
  pickerOpen?: boolean;
  onPickerOpenChange?: (open: boolean) => void;
  /**
   * Reopen the clinical workflow so procedure lines become editable again.
   * Undefined = this caller cannot offer it, and the dialog explains instead.
   */
  onRequestUnlock?: () => void | Promise<void>;
  /** Whether the current user may unlock at all. */
  canUnlock?: boolean;
  /** A SETTLED bill cannot be helped by unlocking the workflow. */
  billPaid?: boolean;
}

/**
 * Applied-procedure panel (Billable Items wave M3). Shows each procedure
 * recipe applied to the visit as a stage checklist with its generated bill
 * lines, recommended (optional) diagnostics to tick on, skipped-item
 * warnings, and a weight/flags re-quote. All mutations are pre-settle only.
 */
const AppliedProcedurePanel: React.FC<Props> = ({ appointmentId, taskId, billLocked = false, currency = 'KES', onChanged, refreshKey, pickerOpen, onPickerOpenChange, onRequestUnlock, canUnlock, billPaid }) => {
  const [apps, setApps] = useState<ProcedureApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ProcedureTemplate[]>([]);
  const [applying, setApplying] = useState(false);
  const [openStages, setOpenStages] = useState<Record<string, boolean>>({});
  // Local re-quote inputs, keyed by application id.
  const [quote, setQuote] = useState<Record<string, { weight: string; inHeat: boolean; pregnant: boolean; emergency: boolean; outOfHours: boolean }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await procedureTemplatesAPI.listApplications(appointmentId);
      if (res.success && res.data?.applications) {
        const all = res.data.applications;
        setApps(taskId != null ? all.filter(a => String(a.taskId) === String(taskId)) : all);
      }
    } catch (e) { console.error('Failed to load procedure applications', e); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId, taskId, refreshKey]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    procedureTemplatesAPI.list().then(r => { if (r.success && r.data?.templates) setTemplates(r.data.templates); }).catch(() => {});
  }, []);

  // ── Editing THE VISIT'S COPY (user, 2026-07-29) ───────────────────────────
  // A vet adapting a protocol for one patient used to have two bad options:
  // edit the clinic's master template (changing every future visit) or leave the
  // checklist wrong. The application's `snapshot` has always been a per-visit
  // copy; this is the first thing that writes to it.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; stages: { key?: string; label: string; notes?: string }[] }>({ name: '', stages: [] });

  const startEdit = (app: ProcedureApplication) => {
    const snap: any = app.snapshot ?? {};
    setEditingId(app.id);
    setDraft({
      name: String(snap.name ?? app.templateName ?? ''),
      stages: Array.isArray(snap.stages)
        ? snap.stages.map((st: any, i: number) => ({ key: st?.key ?? `stage-${i + 1}`, label: String(st?.label ?? `Stage ${i + 1}`), notes: st?.notes ?? '' }))
        : [],
    });
  };

  const saveEdit = async (app: ProcedureApplication) => {
    setBusy(app.id);
    try {
      const res = await procedureTemplatesAPI.updateApplication(app.id, {
        name: draft.name.trim() || undefined,
        stages: draft.stages.map(st => ({ key: st.key, label: st.label, notes: st.notes || undefined })),
      });
      if (res.success) {
        replaceApp(res.data?.application);
        setEditingId(null);
        toast.success("This visit's copy updated — your template is unchanged");
        onChanged?.();
      }
    } catch (e: any) { if (!(await offerUnlock(e))) toast.error(e?.message || 'Failed to save the copy'); }
    finally { setBusy(null); }
  };

  const replaceApp = (updated: ProcedureApplication | undefined) => {
    if (!updated) { load(); return; }
    setApps(prev => prev.map(a => a.id === updated.id ? updated : a));
  };

  /**
   * A LOCKED VISIT IS A QUESTION, NOT A DEAD END.
   *
   * Every mutation here 400s with "This visit is already billed — the procedure
   * lines are locked" once the visit is billed. That arrived as a red toast that
   * named the obstacle and offered nothing, so the vet was told what they could
   * not do and left to find the unlock themselves (user, 2026-08-20: "its bill
   * so point user to unlock and in the error can be a modal and have the unlock
   * button there too").
   *
   * ⚠️ Unlocking the WORKFLOW is what clears this guard — it tests
   * `isPaid || PENDING_PAYMENT || COMPLETED`. A SETTLED bill is not helped by
   * it, so that case says so rather than offering a button that cannot work.
   */
  const LOCKED_RE = /already billed|lines are locked|already settled|invoice can no longer be edited/i;
  const offerUnlock = async (e: any): Promise<boolean> => {
    const msg = String(e?.response?.data?.message ?? e?.message ?? '');
    if (!LOCKED_RE.test(msg)) return false;
    const unlockable = !!onRequestUnlock && !!canUnlock && !billPaid;
    const ok = await dialog.confirm({
      title: 'This visit is billed',
      message: unlockable
        ? 'Procedure lines are locked while the visit is billed. Unlocking the workflow makes them editable again — the bill itself is not changed, and you can re-bill when you are done.'
        : billPaid
          ? 'The bill for this visit is already SETTLED, so the procedure lines cannot be edited. Reverse or reopen the payment on the Bill & Invoice tab first.'
          : 'Procedure lines are locked while the visit is billed, and your role cannot unlock it. Ask a clinic owner or admin to reopen the workflow.',
      confirmLabel: unlockable ? 'Unlock workflow' : 'OK',
      cancelLabel: unlockable ? 'Leave it locked' : 'Close',
      variant: unlockable ? 'danger' : undefined,
    } as any);
    if (ok && unlockable) {
      try { await onRequestUnlock!(); toast.success('Workflow unlocked — try that again'); onChanged?.(); }
      catch { toast.error('Could not unlock the workflow'); }
    }
    return true;
  };

  const applyTemplate = async (templateId: string, allowDuplicate = false) => {
    if (!templateId) return;
    if (applying) return; // a second click while the first is in flight is how duplicates happened
    setApplying(true);
    try {
      const res = await procedureTemplatesAPI.apply(
        templateId,
        { appointmentId, taskId: taskId ?? undefined, ...(allowDuplicate ? { allowDuplicate: true } : {}) },
        { showError: false } as any,
      );
      if (res.success) {
        toast.success(`Procedure applied · ${res.data?.created?.tasks ?? 0} services, ${res.data?.created?.products ?? 0} products`);
        if (res.data?.skipped?.length) toast(`${res.data.skipped.length} component(s) skipped — see warnings on the panel`, { icon: '⚠️' });
        await load();
        onChanged?.();
      }
    } catch (e: any) {
      // 409 = this recipe is already on the visit. Applying it twice is a real
      // thing (two limbs, two doses) so we ask rather than refuse — but we ask,
      // because the usual cause is a double-click, and every accidental copy
      // drags a full set of billable lines behind it.
      if (e?.status === 409 || e?.response?.status === 409 || /already applied to this visit/i.test(String(e?.message))) {
        const again = await dialog.confirm({
          title: 'This procedure is already on the visit',
          message: 'Applying it again adds a SECOND full set of services and products to the bill. Do that only if it really was performed twice — otherwise re-evaluate the existing one.',
          confirmLabel: 'Apply again',
          cancelLabel: 'Cancel',
          variant: 'danger',
        });
        setApplying(false);
        if (again) await applyTemplate(templateId, true);
        return;
      }
      if (!(await offerUnlock(e))) toast.error(e?.message || 'Failed to apply procedure');
    }
    finally { setApplying(false); }
  };

  const removeApp = async (app: ProcedureApplication) => {
    const ok = await dialog.confirm({
      title: `Remove ${app.templateName}?`,
      message: 'This deletes the procedure and every un-billed line it added to this visit. Lines already on an issued bill stay put.',
      confirmLabel: 'Remove procedure',
      cancelLabel: 'Keep',
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(app.id);
    try {
      const res = await procedureTemplatesAPI.removeApplication(app.id);
      if (res.success) { toast.success('Procedure removed — lines deleted'); await load(); onChanged?.(); }
    } catch (e: any) {
      // 404 = already gone, which is the state that was asked for. Reload so
      // the card disappears instead of reporting a failure to reach where we
      // already are (same rule as the draft list — 2026-08-18).
      if (e?.response?.status === 404) {
        toast.success('That procedure was already removed');
        await load();
        onChanged?.();
      } else {
        toast.error(e?.response?.data?.message || e?.message || 'Failed to remove');
      }
    }
    finally { setBusy(null); }
  };

  const reevaluate = async (app: ProcedureApplication) => {
    const q = quote[app.id];
    setBusy(app.id);
    try {
      const res = await procedureTemplatesAPI.reevaluate(app.id, {
        weightKg: q?.weight ? Number(q.weight) : undefined,
        flags: q ? { inHeat: q.inHeat, pregnant: q.pregnant, emergency: q.emergency, outOfHours: q.outOfHours } : undefined,
      });
      if (res.success) { toast.success('Pricing re-evaluated'); replaceApp(res.data?.application); onChanged?.(); }
    } catch (e: any) { if (!(await offerUnlock(e))) toast.error(e?.message || 'Re-evaluation failed'); }
    finally { setBusy(null); }
  };

  // ── Per-line edits on an expanded consumable ────────────────────────────
  // A recipe is a starting point, not a contract: the pack that says 2 sutures
  // often becomes 3. Editing one line must not mean un-applying the whole
  // procedure and rebuilding it by hand.
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});

  const saveLineQty = async (prodId: string, current: number) => {
    const raw = qtyDraft[prodId];
    const next = Number(raw);
    if (raw === undefined || !Number.isFinite(next) || next <= 0 || next === current) {
      setQtyDraft(d => { const { [prodId]: _drop, ...rest } = d; return rest; });
      return;
    }
    setBusy(`line:${prodId}`);
    try {
      const res = await consumablesAPI.update(prodId, { quantity: next });
      if (res.success) {
        toast.success('Line updated');
        setQtyDraft(d => { const { [prodId]: _drop, ...rest } = d; return rest; });
        await load();
        onChanged?.();
      }
    } catch (e: any) { if (!(await offerUnlock(e))) toast.error(e?.message || 'Failed to update the line'); }
    finally { setBusy(null); }
  };

  const toggleLineBillable = async (prodId: string, billable: boolean) => {
    setBusy(`line:${prodId}`);
    try {
      const res = await consumablesAPI.update(prodId, { billable });
      if (res.success) { await load(); onChanged?.(); }
    } catch (e: any) { if (!(await offerUnlock(e))) toast.error(e?.message || 'Failed to update the line'); }
    finally { setBusy(null); }
  };

  const removeLine = async (prodId: string, name: string, isDeducted: boolean) => {
    const ok = await dialog.confirm({
      title: `Remove ${name}?`,
      message: isDeducted
        ? 'This line already deducted stock — removing it returns that stock to inventory.'
        : 'This removes the line from the visit.',
      confirmLabel: 'Remove line',
      cancelLabel: 'Keep',
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(`line:${prodId}`);
    try {
      const res = await consumablesAPI.remove(prodId);
      if (res.success) { toast.success('Line removed'); await load(); onChanged?.(); }
    } catch (e: any) { if (!(await offerUnlock(e))) toast.error(e?.message || 'Failed to remove the line'); }
    finally { setBusy(null); }
  };

  const addOptional = async (app: ProcedureApplication, itemId: string, name: string) => {
    setBusy(`${app.id}:${itemId}`);
    try {
      const res = await procedureTemplatesAPI.materializeItem(app.id, itemId);
      if (res.success) { toast.success(`"${name}" added to the visit`); replaceApp(res.data?.application); onChanged?.(); }
    } catch (e: any) { if (!(await offerUnlock(e))) toast.error(e?.message || 'Failed to add component'); }
    finally { setBusy(null); }
  };

  const quoteFor = (app: ProcedureApplication) => quote[app.id] ?? {
    weight: app.weightKg != null ? String(app.weightKg) : '',
    inHeat: !!app.flags?.inHeat, pregnant: !!app.flags?.pregnant,
    emergency: !!app.flags?.emergency, outOfHours: !!app.flags?.outOfHours,
  };
  const setQuoteFor = (appId: string, patch: Partial<ReturnType<typeof quoteFor>>) =>
    setQuote(prev => ({ ...prev, [appId]: { ...(prev[appId] ?? quoteFor(apps.find(a => a.id === appId)!)), ...patch } }));

  // Templates offerable for manual apply (hide ones anchored to this task already).
  const applicable = useMemo(() => {
    if (taskId != null && apps.length > 0) return [];
    return templates;
  }, [templates, apps.length, taskId]);

  // ── Recipe search ─────────────────────────────────────────────────────────
  const [tplSearch, setTplSearch] = useState('');
  const [tplOpenLocal, setTplOpenLocal] = useState(false);
  const controlled = pickerOpen !== undefined;
  const tplOpen = controlled ? !!pickerOpen : tplOpenLocal;
  const setTplOpen = (v: boolean) => { if (controlled) onPickerOpenChange?.(v); else setTplOpenLocal(v); };
  const pickerRef = React.useRef<HTMLDivElement>(null);
  const closePicker = React.useCallback(() => { setTplOpen(false); setTplSearch(''); }, []);
  const tplMatches = useMemo(() => {
    const q = tplSearch.trim().toLowerCase();
    if (!q) return applicable;
    return applicable.filter(t => t.name.toLowerCase().includes(q));
  }, [applicable, tplSearch]);

  /**
   * Close on any click outside the picker (user, 2026-08-20: "click outside to
   * always close search drpdwns"). `mousedown` matches the option buttons' own
   * handler order, and the `contains` guard keeps picking one working.
   */
  useEffect(() => {
    if (!tplOpen) return;
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) closePicker();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [tplOpen, closePicker]);

  if (loading && apps.length === 0) {
    return <div className="flex items-center justify-center py-4"><Loader2 size={16} className="animate-spin text-seafoam" /></div>;
  }
  /**
   * Controlled: the picker is summoned by the "Add procedure" button, so the
   * panel shows nothing at all until there is either an applied recipe to render
   * or an explicit request to pick one. Uncontrolled keeps the old behaviour.
   */
  const showPicker = !billLocked && applicable.length > 0 && (controlled ? tplOpen : apps.length === 0);
  if (apps.length === 0 && !showPicker) return null;

  return (
    <div className="space-y-3">
      {/* Manual apply — a SEARCH, not a native select.
          A raw <select> listed every recipe in one unfiltered column with no way
          to narrow it and no way out but picking something, and two recipes
          sharing a name were indistinguishable (user, 2026-08-20: "shouldnt this
          drpdwn be just same as" the add-item search). This matches that: type
          to filter, click outside or Cancel to leave. */}
      {showPicker && (
        <div ref={pickerRef} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <ClipboardList size={15} className="text-teal-500 shrink-0" />
            <input
              value={tplSearch}
              disabled={applying}
              onFocus={() => setTplOpen(true)}
              onChange={e => { setTplSearch(e.target.value); setTplOpen(true); }}
              placeholder={applying ? 'Applying…' : 'Apply a procedure recipe…'}
              className="flex-1 min-w-0 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam disabled:opacity-50"
            />
            {applying && <Loader2 size={15} className="animate-spin text-seafoam" />}
            {(tplOpen || tplSearch) && !applying && (
              <button type="button" onClick={closePicker} title="Close"
                className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-pine dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X size={14} />
              </button>
            )}
          </div>
          {tplOpen && !applying && (
            <div className="max-h-64 overflow-y-auto custom-scrollbar rounded-xl border border-slate-100 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800">
              {tplMatches.length === 0 ? (
                <p className="px-3 py-3 text-[11px] font-bold text-slate-400">
                  {tplSearch.trim() ? `Nothing matching "${tplSearch.trim()}"` : 'No recipes yet.'}
                </p>
              ) : tplMatches.map(t => (
                <button key={t.id} type="button"
                  onClick={() => { closePicker(); applyTemplate(t.id); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-seafoam/5 transition-colors">
                  <Plus size={12} className="text-teal-500 shrink-0" />
                  <span className="flex-1 min-w-0 text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{t.name}</span>
                  <span className="shrink-0 text-[10px] font-black text-slate-400">est. {currency} {t.estimatedTotal.toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
          {tplOpen && !applying && (
            <button type="button" onClick={closePicker}
              className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-pine dark:hover:text-zinc-100 px-1">
              Cancel
            </button>
          )}
        </div>
      )}

      {apps.map(app => {
        const q = quoteFor(app);
        const total = app.tasks.reduce((s, t) => s + t.price, 0);
        const productsByTask = new Map(app.products.filter(p => p.taskId).map(p => [String(p.taskId), p]));
        const stages: Array<{ key: string | null; label: string }> = [
          ...(app.stages ?? []),
          ...(app.tasks.some(t => !t.stageKey) ? [{ key: null, label: 'Other items' }] : []),
        ];
        const optionalItems = ((app.snapshot?.items ?? []) as any[]).filter(i => i.optional);
        const isAdded = (i: any) =>
          (i.serviceId && app.tasks.some(t => (t as any).serviceId ? String((t as any).serviceId) === String(i.serviceId) : t.name.startsWith(i.name)))
          || (i.inventoryItemId && app.products.some(p => String(p.inventoryItem.id) === String(i.inventoryItemId)));
        const pendingOptional = optionalItems.filter(i => !isAdded(i));

        return (
          <div key={app.id} className="bg-white dark:bg-zinc-900 border border-teal-200 dark:border-teal-900/40 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-teal-50/60 dark:bg-teal-950/20 border-b border-teal-100 dark:border-teal-900/30">
              <ClipboardList size={15} className="text-teal-600" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 truncate">
                  {(app.snapshot as any)?.name ?? app.templateName ?? 'Procedure'}
                  {/* Says "this visit's version isn't your recipe any more", so
                      nobody debugs a mismatch that was a deliberate edit. */}
                  {(app.snapshot as any)?.editedAt && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-[8px] tracking-wider" title={`Edited for this visit on ${new Date((app.snapshot as any).editedAt).toLocaleString()}`}>edited</span>
                  )}
                </p>
                <p className="text-[9px] text-slate-400 font-medium">
                  Applied {new Date(app.createdAt).toLocaleDateString()}
                  {app.weightKg != null ? ` · ${app.weightKg} kg` : ''}
                  {Object.entries(app.flags ?? {}).filter(([, v]) => v).map(([k]) => ` · ${k === 'inHeat' ? 'in heat' : k === 'outOfHours' ? 'out of hours' : k}`).join('')}
                </p>
              </div>
              <span className="text-sm font-black text-pine dark:text-zinc-100 shrink-0">{currency} {total.toLocaleString()}</span>
              {!billLocked && (
                <button onClick={() => (editingId === app.id ? setEditingId(null) : startEdit(app))}
                  className={`p-1.5 rounded-lg transition-all ${editingId === app.id ? 'bg-teal-600 text-white' : 'text-slate-400 hover:bg-teal-50 hover:text-teal-600'}`}
                  title="Edit this visit's copy — your saved template is not changed">
                  <Pencil size={13} />
                </button>
              )}
              {!billLocked && (
                <button onClick={() => removeApp(app)} disabled={busy === app.id}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50" title="Remove procedure + its lines">
                  {busy === app.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              )}
            </div>

            <div className="p-3.5 space-y-3">
              {/* Editing this visit's copy. Deliberately narrow: the copy's name
                  and its stage labels/notes. Quantities and lines are edited on
                  the lines themselves, so stock and totals keep going through
                  one set of rules. */}
              {editingId === app.id && (
                <div className="bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40 rounded-xl p-3 space-y-2.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-teal-700 dark:text-teal-400">
                    Editing this visit's copy — your saved template is not changed
                  </p>
                  <div>
                    <label className="field-label">Name on this visit</label>
                    <input className="field-input" value={draft.name}
                      onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
                  </div>
                  {draft.stages.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="field-label">Stages</label>
                      {draft.stages.map((st, i) => (
                        <div key={st.key ?? i} className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-slate-400 w-4 shrink-0">{i + 1}</span>
                          <input className="field-input flex-1" value={st.label}
                            onChange={e => setDraft(d => ({
                              ...d,
                              stages: d.stages.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                            }))} />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-0.5">
                    <button onClick={() => saveEdit(app)} disabled={busy === app.id}
                      className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1.5">
                      {busy === app.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Save copy
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-500 text-[9px] font-black uppercase tracking-widest hover:text-pine">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* ASSUMED, not skipped — the line IS billed, on a guessed input
                  (2026-08-19). Shown separately from skips because the action is
                  different: a skip needs the line adding, an assumption needs a
                  number correcting and a re-evaluate. */}
              {((app.snapshot as any)?.assumptions ?? []).length > 0 && (
                <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-2.5 space-y-0.5">
                  {((app.snapshot as any).assumptions as any[]).map((a, i) => (
                    <p key={i} className="flex items-start gap-1.5 text-[10px] font-bold text-sky-700 dark:text-sky-400">
                      <Calculator size={11} className="mt-0.5 shrink-0" /> {a.name}: {a.reason}
                    </p>
                  ))}
                </div>
              )}

              {/* Skipped warnings */}
              {(app.skippedItems ?? []).length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 space-y-0.5">
                  {(app.skippedItems as any[]).map((s, i) => (
                    <p key={i} className="flex items-start gap-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-500">
                      <AlertTriangle size={11} className="mt-0.5 shrink-0" /> {s.name}: {s.reason}
                    </p>
                  ))}
                </div>
              )}

              {/* Stage checklist */}
              <div className="space-y-0.5">
                {stages.map((s, idx) => {
                  const stageTasks = app.tasks.filter(t => (t.stageKey ?? null) === (s.key ?? null) && t.category !== 'Procedure Adjustment');
                  if (!stageTasks.length && s.key !== null) {
                    // Stage with no lines still renders in the timeline (clinical step only)
                  }
                  const done = stageTasks.length > 0 && stageTasks.every(t => t.status === 'COMPLETED');
                  const stageId = `${app.id}:${s.key ?? 'other'}`;
                  const open = openStages[stageId] ?? false;
                  return (
                    <div key={stageId} className="relative pl-6 pb-2">
                      {idx < stages.length - 1 && <span className="absolute left-[9px] top-5 bottom-0 w-px bg-slate-200 dark:bg-zinc-700" />}
                      <span className={`absolute left-0 top-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${done ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-600 text-slate-400'}`}>
                        {done ? <Check size={10} /> : <span className="text-[8px] font-black">{idx + 1}</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => stageTasks.length && setOpenStages(o => ({ ...o, [stageId]: !open }))}
                        className="flex items-center gap-1 text-left"
                      >
                        <span className={`text-[10px] font-black uppercase tracking-wide ${done ? 'text-emerald-600' : 'text-pine dark:text-zinc-100'}`}>{s.label}</span>
                        {stageTasks.length > 0 && (
                          <>
                            <span className="text-[9px] text-slate-400 font-bold">({stageTasks.filter(t => t.status === 'COMPLETED').length}/{stageTasks.length})</span>
                            {open ? <ChevronDown size={11} className="text-slate-400" /> : <ChevronRight size={11} className="text-slate-400" />}
                          </>
                        )}
                      </button>
                      {open && stageTasks.map(t => {
                        const prod = productsByTask.get(String(t.id));
                        const lineBusy = prod ? busy === `line:${prod.id}` : false;
                        // Product lines are editable pre-settle: what the recipe
                        // quoted is rarely exactly what got used.
                        const editable = !!prod && !billLocked;
                        return (
                          <div key={t.id} className="flex items-center justify-between gap-2 mt-1 pl-1">
                            <span className="min-w-0">
                              <span className="block text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                                {t.name}
                                {prod?.batchNumber && <span className="ml-1 font-black text-amber-600 dark:text-amber-500">· Batch {prod.batchNumber}</span>}
                                {prod && !prod.billable && <span className="ml-1 text-slate-400">· no charge</span>}
                              </span>
                              {/* Per-item detail: qty × unit price in the item's own
                                  unit — visible even when the bill lock hides the
                                  edit controls (surgery-record polish, S2). */}
                              {prod && (
                                <span className="block text-[9px] font-bold text-slate-400 dark:text-zinc-500 truncate">
                                  {Number(prod.quantity)} {prod.inventoryItem.unit}
                                  {prod.unitPrice != null && <> × {currency} {Number(prod.unitPrice).toLocaleString()}</>}
                                  {prod.isDeducted ? ' · stock deducted' : ' · reserves on finalize'}
                                </span>
                              )}
                            </span>
                            {editable && prod && (
                              <span className="flex items-center gap-1 shrink-0">
                                {/* Sell-unit-aware qty (§0f #8): quantity is in the item's
                                    SELL unit; the picker offers ¼/½/full stock-unit factors.
                                    Saves when focus leaves the control. */}
                                <span
                                  onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) saveLineQty(prod.id, prod.quantity); }}
                                >
                                  <QtyUnitControl
                                    compact disabled={lineBusy}
                                    item={{ unit: (prod.inventoryItem as any).stockUnit ?? prod.inventoryItem.unit, packSize: (prod.inventoryItem as any).packSize, sellUnit: prod.inventoryItem.unit }}
                                    value={qtyDraft[prod.id] !== undefined ? Number(qtyDraft[prod.id]) : Number(prod.quantity)}
                                    onChange={(sellQty) => setQtyDraft(d => ({ ...d, [prod.id]: String(sellQty) }))}
                                  />
                                </span>
                                <button type="button" disabled={lineBusy}
                                  onClick={() => toggleLineBillable(prod.id, !prod.billable)}
                                  title={prod.billable ? 'Make this line non-billable' : 'Charge for this line'}
                                  className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border disabled:opacity-50 ${
                                    prod.billable
                                      ? 'bg-seafoam/10 text-seafoam border-seafoam/30'
                                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'
                                  }`}>
                                  {prod.billable ? 'Billed' : 'Free'}
                                </button>
                                <button type="button" disabled={lineBusy}
                                  onClick={() => removeLine(prod.id, prod.inventoryItem.name, prod.isDeducted)}
                                  title="Remove this line"
                                  className="p-0.5 rounded text-slate-400 hover:text-rose-500 disabled:opacity-50">
                                  {lineBusy ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                </button>
                              </span>
                            )}
                            <span className="shrink-0 text-[10px] font-bold text-slate-500 dark:text-zinc-400 w-20 text-right">{t.price !== 0 ? `${currency} ${t.price.toLocaleString()}` : ''}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Adjustments */}
              {app.tasks.filter(t => t.category === 'Procedure Adjustment').map(t => (
                <div key={t.id} className="flex items-center justify-between text-[10px] font-bold px-1">
                  <span className="flex items-center gap-1 text-amber-600"><Zap size={10} /> {t.name}</span>
                  <span className={t.price < 0 ? 'text-emerald-600' : 'text-amber-600'}>{t.price < 0 ? '− ' : '+ '}{currency} {Math.abs(t.price).toLocaleString()}</span>
                </div>
              ))}

              {/* Recommended (optional) diagnostics */}
              {pendingOptional.length > 0 && !billLocked && (
                <div className="border-t border-slate-100 dark:border-zinc-800 pt-2.5 space-y-1.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-violet-600">Recommended — tick what was performed</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pendingOptional.map((i: any) => (
                      <button key={i.id} type="button"
                        onClick={() => addOptional(app, i.id, i.name)}
                        disabled={busy === `${app.id}:${i.id}`}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-violet-500/30 bg-violet-500/5 text-[10px] font-bold text-violet-600 hover:bg-violet-500/15 disabled:opacity-50">
                        {busy === `${app.id}:${i.id}` ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                        {i.name}{i.effectivePrice ? ` · ${currency} ${Number(i.effectivePrice).toLocaleString()}` : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Weight / flags re-quote */}
              {!billLocked && (
                <div className="border-t border-slate-100 dark:border-zinc-800 pt-2.5 flex flex-wrap items-center gap-1.5">
                  <input
                    type="number" min={0} step={0.1} placeholder="Weight kg"
                    value={q.weight}
                    onChange={e => setQuoteFor(app.id, { weight: e.target.value })}
                    className="w-24 px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-[11px] font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam"
                  />
                  {([['inHeat', 'In heat'], ['pregnant', 'Pregnant'], ['emergency', 'Emergency'], ['outOfHours', 'After hours']] as const).map(([k, label]) => (
                    <button key={k} type="button" onClick={() => setQuoteFor(app.id, { [k]: !q[k] } as any)}
                      className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${q[k] ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' : 'bg-slate-50 dark:bg-zinc-800 text-slate-400 border-slate-200 dark:border-zinc-700'}`}>
                      {label}
                    </button>
                  ))}
                  <button onClick={() => reevaluate(app)} disabled={busy === app.id}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-seafoam text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-seafoam/90 disabled:opacity-50">
                    {busy === app.id ? <Loader2 size={11} className="animate-spin" /> : <Calculator size={11} />} Re-evaluate
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

export default AppliedProcedurePanel;
