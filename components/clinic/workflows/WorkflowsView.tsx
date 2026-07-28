import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Workflow, Plus, Loader2, Copy, Pencil, Trash2, Search, Share2, Globe2, Lock, Star, ArrowDownToLine,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { workflowTemplatesAPI, WorkflowTemplate } from '../../../services';
import LoadingSpinner from '../../shared/common/LoadingSpinner';
import UpgradeGate from '../../shared/common/UpgradeGate';
import UpgradeForkDialog from './UpgradeForkDialog';
import { usePlanAccess } from '../../../contexts/PlanAccessContext';

/**
 * Visit workflows — the clinic's list of clinical form layouts.
 * Spec: backend/docs/DYNAMIC_FORM_BUILDER.md
 *
 * Three groups, and the difference between them is the whole ownership model:
 *   Yours    — editable, private to this clinic unless published.
 *   Shipped  — ours, referenced LIVE so our improvements reach every clinic.
 *              Read-only; "Customise" forks an editable copy.
 *   Library  — other clinics' published workflows. Taking one also forks, so
 *              their later edits never reach your copy (and vice versa).
 */

interface Props {
  onOpenBuilder: (templateId: string | null) => void;
}

const Badge: React.FC<{ tone?: 'seafoam' | 'amber' | 'slate'; children: React.ReactNode; title?: string }> = ({ tone = 'slate', children, title }) => {
  const tones = {
    seafoam: 'bg-seafoam/10 text-seafoam border-seafoam/20',
    amber: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    slate: 'bg-slate-100 dark:bg-zinc-800 text-slate-500 border-slate-200 dark:border-zinc-700',
  };
  return (
    <span title={title} className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${tones[tone]}`}>
      {children}
    </span>
  );
};

const WorkflowsView: React.FC<Props> = ({ onOpenBuilder }) => {
  // Building is Pro, publishing is Enterprise (migration 138). Reading is
  // ungated — the shipped presets ARE the built-in flow, so a clinic below Pro
  // still sees them here and still consults normally.
  const { can } = usePlanAccess();
  const canBuild = can('capability:workflow-builder');
  const canShare = can('capability:workflow-share');
  const [mine, setMine] = useState<WorkflowTemplate[]>([]);
  const [shared, setShared] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Forks whose source has moved on: id -> source version. Checked per fork,
  // because only a fork can be behind anything.
  const [upgradable, setUpgradable] = useState<Record<string, number>>({});
  const [upgradeFor, setUpgradeFor] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [own, lib] = await Promise.all([
        workflowTemplatesAPI.list(),
        workflowTemplatesAPI.listShared(),
      ]);
      if (own.success && own.data?.templates) {
        setMine(own.data.templates);
        // Ask only about forks — everything else has no source to be behind.
        const forks = own.data.templates.filter(t => t.ownerType === 'CLINIC' && t.basedOnId);
        Promise.all(forks.map(f =>
          workflowTemplatesAPI.upgradeInfo(f.id)
            .then(r => (r.success && r.data?.available ? [f.id, r.data.sourceVersion ?? 0] as const : null))
            .catch(() => null),
        )).then(rows => {
          const map: Record<string, number> = {};
          for (const row of rows) if (row) map[row[0]] = row[1];
          setUpgradable(map);
        });
      }
      if (lib.success && lib.data?.templates) setShared(lib.data.templates);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const match = useCallback((t: WorkflowTemplate) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${t.name} ${t.description ?? ''} ${t.encounterType ?? ''} ${t.visitType ?? ''}`.toLowerCase().includes(q);
  }, [search]);

  const presets = useMemo(() => mine.filter(t => t.ownerType === 'SYSTEM').filter(match), [mine, match]);
  const ours = useMemo(() => mine.filter(t => t.ownerType === 'CLINIC').filter(match), [mine, match]);
  const library = useMemo(() => shared.filter(match), [shared, match]);

  const fork = async (t: WorkflowTemplate) => {
    setBusyId(t.id);
    try {
      const res = await workflowTemplatesAPI.fork(t.id);
      if (res.success && res.data?.template) {
        toast.success('Copied to your clinic');
        onOpenBuilder(res.data.template.id);
      } else toast.error(res.message || 'Could not copy that workflow');
    } catch (e: any) { toast.error(e?.message || 'Could not copy that workflow'); }
    finally { setBusyId(null); }
  };

  const togglePublish = async (t: WorkflowTemplate) => {
    const next = t.visibility === 'SHARED' ? 'PRIVATE' : 'SHARED';
    setBusyId(t.id);
    try {
      const res = await workflowTemplatesAPI.setVisibility(t.id, next);
      if (res.success) {
        toast.success(next === 'SHARED' ? 'Published to the library' : 'Withdrawn from the library');
        await load();
      } else toast.error(res.message || 'Could not update sharing');
    } catch (e: any) { toast.error(e?.message || 'Could not update sharing'); }
    finally { setBusyId(null); }
  };

  const deactivate = async (t: WorkflowTemplate) => {
    setBusyId(t.id);
    try {
      const res = await workflowTemplatesAPI.remove(t.id);
      if (res.success) { toast.success(`"${t.name}" deactivated`); await load(); }
      else toast.error(res.message || 'Could not deactivate');
    } catch (e: any) { toast.error(e?.message || 'Could not deactivate'); }
    finally { setBusyId(null); }
  };

  const Card: React.FC<{ t: WorkflowTemplate; kind: 'ours' | 'preset' | 'library' }> = ({ t, kind }) => {
    const stageCount = Array.isArray(t.stages) ? t.stages.length : 0;
    const busy = busyId === t.id;
    return (
      <div className="border border-slate-200 dark:border-zinc-800 rounded-xl p-3 bg-white dark:bg-zinc-900 hover:border-seafoam/40 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {t.icon && <span className="text-sm leading-none">{t.icon}</span>}
              <p className="text-[12px] font-black text-pine dark:text-zinc-100 truncate">{t.name}</p>
              {kind === 'preset' && <Badge tone="seafoam" title="Shipped by VetHub and kept up to date">v{t.version}</Badge>}
              {t.isDefault && <Badge tone="amber" title="Chosen first when several workflows match"><Star size={8} className="inline" /> Default</Badge>}
              {t.visibility === 'SHARED' && kind === 'ours' && <Badge tone="amber">Published</Badge>}
              {t.basedOnId && kind === 'ours' && <Badge title={`Copied from version ${t.baseVersion}`}>Copy of v{t.baseVersion}</Badge>}
              {upgradable[t.id] && (
                <button
                  onClick={() => setUpgradeFor({ id: t.id, name: t.name })}
                  title="The workflow this was copied from has moved on — review what differs"
                  className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border bg-seafoam/10 text-seafoam border-seafoam/20 hover:bg-seafoam hover:text-white transition-colors"
                >
                  v{upgradable[t.id]} available
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              {t.description || `${stageCount} stage${stageCount === 1 ? '' : 's'}`}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {t.encounterType && <Badge>{t.encounterType}</Badge>}
              {t.visitType && <Badge>{t.visitType}</Badge>}
              {!t.encounterType && !t.visitType && <Badge title="Only used when picked as the clinic default">Any visit</Badge>}
              <span className="text-[9px] text-slate-400">{stageCount} stage{stageCount === 1 ? '' : 's'}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {busy && <Loader2 size={13} className="animate-spin text-slate-400" />}
            {kind === 'ours' ? (
              <>
                <button onClick={() => onOpenBuilder(t.id)} title={canBuild ? 'Edit' : 'View'} className="p-1.5 rounded-lg text-slate-400 hover:text-seafoam hover:bg-seafoam/10">
                  <Pencil size={13} />
                </button>
                {canShare && (
                  <button
                    onClick={() => togglePublish(t)}
                    title={t.visibility === 'SHARED' ? 'Withdraw from the shared library' : 'Publish so other clinics can copy it'}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-500/10"
                  >
                    {t.visibility === 'SHARED' ? <Globe2 size={13} /> : <Share2 size={13} />}
                  </button>
                )}
                {canBuild && (
                  <button onClick={() => deactivate(t)} title="Deactivate" className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10">
                    <Trash2 size={13} />
                  </button>
                )}
              </>
            ) : (
              <>
                <button onClick={() => onOpenBuilder(t.id)} title="View" className="p-1.5 rounded-lg text-slate-400 hover:text-pine">
                  <Lock size={13} />
                </button>
                {canBuild && (
                  <button
                    onClick={() => fork(t)}
                    title="Copy into your clinic and edit"
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-seafoam/10 text-seafoam text-[9px] font-black uppercase tracking-widest hover:bg-seafoam hover:text-white transition-colors"
                  >
                    <Copy size={11} /> Customise
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-pine dark:text-zinc-100 tracking-tight uppercase flex items-center gap-2">
            <Workflow size={18} /> Visit Workflows
          </h1>
          <p className="text-[10px] text-slate-400 font-medium">
            What a vet is asked, stage by stage — build your own, or start from one of ours.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="field-input !pl-8 w-48"
              placeholder="Search workflows"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <UpgradeGate feature="capability:workflow-builder" variant="inline">
            <button
              onClick={() => onOpenBuilder(null)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-seafoam text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-seafoam/20"
            >
              <Plus size={13} /> New workflow
            </button>
          </UpgradeGate>
        </div>
      </div>

      <section className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Your workflows</p>
        {!ours.length ? (
          <p className="text-[11px] text-slate-400 border border-dashed border-slate-300 dark:border-zinc-700 rounded-xl p-4 text-center">
            None yet. Customise one of ours below, or build from scratch — either way it stays private to this clinic
            until you publish it.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {ours.map(t => <Card key={t.id} t={t} kind="ours" />)}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Shipped with VetHub
          <span className="ml-2 normal-case tracking-normal font-medium text-slate-400">
            — used live, so we keep improving them for you
          </span>
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {presets.map(t => <Card key={t.id} t={t} kind="preset" />)}
        </div>
      </section>

      {upgradeFor && (
        <UpgradeForkDialog
          templateId={upgradeFor.id}
          templateName={upgradeFor.name}
          onClose={() => setUpgradeFor(null)}
          onAdopted={load}
        />
      )}

      {!!library.length && (
        <section className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Shared by other clinics
            <span className="ml-2 normal-case tracking-normal font-medium text-slate-400">
              — copying takes a snapshot; their later edits won’t change yours
            </span>
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {library.map(t => <Card key={t.id} t={t} kind="library" />)}
          </div>
        </section>
      )}
    </div>
  );
};

export default WorkflowsView;
