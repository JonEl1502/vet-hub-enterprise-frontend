import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardList, Loader2, Trash2, Check, Zap, AlertTriangle, Plus, Calculator, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { procedureTemplatesAPI, ProcedureApplication, ProcedureTemplate } from '../../../services';

interface Props {
  appointmentId: string | number;
  // Scope to the application anchored on ONE service task (module pages).
  // Omit to show every procedure applied to the visit.
  taskId?: string | number | null;
  billLocked?: boolean;
  currency?: string;
  onChanged?: () => void;
}

/**
 * Applied-procedure panel (Billable Items wave M3). Shows each procedure
 * recipe applied to the visit as a stage checklist with its generated bill
 * lines, recommended (optional) diagnostics to tick on, skipped-item
 * warnings, and a weight/flags re-quote. All mutations are pre-settle only.
 */
const AppliedProcedurePanel: React.FC<Props> = ({ appointmentId, taskId, billLocked = false, currency = 'KES', onChanged }) => {
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
  }, [appointmentId, taskId]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    procedureTemplatesAPI.list().then(r => { if (r.success && r.data?.templates) setTemplates(r.data.templates); }).catch(() => {});
  }, []);

  const replaceApp = (updated: ProcedureApplication | undefined) => {
    if (!updated) { load(); return; }
    setApps(prev => prev.map(a => a.id === updated.id ? updated : a));
  };

  const applyTemplate = async (templateId: string) => {
    if (!templateId) return;
    setApplying(true);
    try {
      const res = await procedureTemplatesAPI.apply(templateId, { appointmentId, taskId: taskId ?? undefined });
      if (res.success) {
        toast.success(`Procedure applied · ${res.data?.created?.tasks ?? 0} services, ${res.data?.created?.products ?? 0} products`);
        if (res.data?.skipped?.length) toast(`${res.data.skipped.length} component(s) skipped — see warnings on the panel`, { icon: '⚠️' });
        await load();
        onChanged?.();
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to apply procedure'); }
    finally { setApplying(false); }
  };

  const removeApp = async (app: ProcedureApplication) => {
    if (!confirm(`Remove "${app.templateName}" and all its un-billed lines from this visit?`)) return;
    setBusy(app.id);
    try {
      const res = await procedureTemplatesAPI.removeApplication(app.id);
      if (res.success) { toast.success('Procedure removed — lines deleted'); await load(); onChanged?.(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to remove'); }
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
    } catch (e: any) { toast.error(e?.message || 'Re-evaluation failed'); }
    finally { setBusy(null); }
  };

  const addOptional = async (app: ProcedureApplication, itemId: string, name: string) => {
    setBusy(`${app.id}:${itemId}`);
    try {
      const res = await procedureTemplatesAPI.materializeItem(app.id, itemId);
      if (res.success) { toast.success(`"${name}" added to the visit`); replaceApp(res.data?.application); onChanged?.(); }
    } catch (e: any) { toast.error(e?.message || 'Failed to add component'); }
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

  if (loading && apps.length === 0) {
    return <div className="flex items-center justify-center py-4"><Loader2 size={16} className="animate-spin text-seafoam" /></div>;
  }
  if (apps.length === 0 && (applicable.length === 0 || billLocked)) return null;

  return (
    <div className="space-y-3">
      {/* Manual apply */}
      {!billLocked && applicable.length > 0 && apps.length === 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3 flex items-center gap-2">
          <ClipboardList size={15} className="text-teal-500 shrink-0" />
          <select
            disabled={applying}
            value=""
            onChange={e => applyTemplate(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam disabled:opacity-50">
            <option value="">{applying ? 'Applying…' : 'Apply a procedure recipe…'}</option>
            {applicable.map(t => <option key={t.id} value={t.id}>{t.name} · est. {currency} {t.estimatedTotal.toLocaleString()}</option>)}
          </select>
          {applying && <Loader2 size={15} className="animate-spin text-seafoam" />}
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
                <p className="text-[11px] font-black uppercase tracking-widest text-pine dark:text-zinc-100 truncate">{app.templateName ?? 'Procedure'}</p>
                <p className="text-[9px] text-slate-400 font-medium">
                  Applied {new Date(app.createdAt).toLocaleDateString()}
                  {app.weightKg != null ? ` · ${app.weightKg} kg` : ''}
                  {Object.entries(app.flags ?? {}).filter(([, v]) => v).map(([k]) => ` · ${k === 'inHeat' ? 'in heat' : k === 'outOfHours' ? 'out of hours' : k}`).join('')}
                </p>
              </div>
              <span className="text-sm font-black text-pine dark:text-zinc-100 shrink-0">{currency} {total.toLocaleString()}</span>
              {!billLocked && (
                <button onClick={() => removeApp(app)} disabled={busy === app.id}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50" title="Remove procedure + its lines">
                  {busy === app.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              )}
            </div>

            <div className="p-3.5 space-y-3">
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
                        return (
                          <div key={t.id} className="flex items-center justify-between gap-2 mt-1 pl-1">
                            <span className="min-w-0 text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                              {t.name}
                              {prod?.batchNumber && <span className="ml-1 font-black text-amber-600 dark:text-amber-500">· Batch {prod.batchNumber}</span>}
                              {prod && !prod.billable && <span className="ml-1 text-slate-400">· no charge</span>}
                            </span>
                            <span className="shrink-0 text-[10px] font-bold text-slate-500 dark:text-zinc-400">{t.price !== 0 ? `${currency} ${t.price.toLocaleString()}` : ''}</span>
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
