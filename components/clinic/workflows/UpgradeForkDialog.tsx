import React, { useEffect, useState } from 'react';
import { X, Loader2, ArrowDownToLine, AlertTriangle, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { workflowTemplatesAPI } from '../../../services';

/**
 * "The workflow you copied has moved on" — review, then decide.
 *
 * A fork is never auto-updated. Silently rewriting a clinical form under a vet
 * mid-use is precisely what forking exists to prevent, so the clinic is told
 * and chooses.
 *
 * ⚠️ The diff is NOT a v2→v3 changelog. Only the source's CURRENT layout is
 * stored, so what is shown is "how your copy differs from the source as it
 * stands today". The wording below says exactly that on purpose — do not
 * shorten it to "what changed in the update", which would be a lie.
 */

interface Props {
  templateId: string;
  templateName: string;
  onClose: () => void;
  onAdopted: () => void;
}

const UpgradeForkDialog: React.FC<Props> = ({ templateId, templateName, onClose, onAdopted }) => {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    workflowTemplatesAPI.upgradeInfo(templateId)
      .then(r => { if (live) setInfo(r.success ? r.data : null); })
      .catch(() => { /* dialog shows the empty state */ })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [templateId]);

  const adopt = async () => {
    setSaving(true);
    try {
      const res = await workflowTemplatesAPI.adoptBase(templateId);
      if (res.success) { toast.success(`"${templateName}" updated`); onAdopted(); onClose(); }
      else toast.error(res.message || 'Could not take the update');
    } catch (e: any) {
      toast.error(e?.message || 'Could not take the update');
    } finally { setSaving(false); }
  };

  const d = info?.diff;
  const losing = d?.stagesYouRemoved?.length || 0;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-2">
          <ArrowDownToLine size={14} className="text-seafoam" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">Update available</p>
            <p className="text-[10px] text-slate-400 truncate">
              {info?.sourceName ? `${templateName} — copied from ${info.sourceName}` : templateName}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-3">
          {loading && <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-slate-400" /></div>}

          {!loading && info && !info.available && (
            <p className="text-[12px] text-slate-500 dark:text-zinc-400">
              {info.reason === 'up-to-date' && 'Your copy is level with the original — nothing to take.'}
              {info.reason === 'not-a-fork' && 'This workflow was built from scratch, so there is nothing to update from.'}
              {info.reason === 'source-retired' && 'The workflow this was copied from has been retired. Your copy keeps working as it is.'}
            </p>
          )}

          {!loading && info?.available && (
            <>
              <p className="text-[12px] text-slate-600 dark:text-zinc-300 leading-relaxed">
                <strong>{info.sourceName}</strong> is now at v{info.sourceVersion}; your copy was taken at
                v{info.baseVersion}. Below is how your copy differs from it <strong>as it stands today</strong> —
                not a list of what changed between versions.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div className="border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Taking it would add</p>
                  {d.stagesTheyHave.length
                    ? d.stagesTheyHave.map((s: any) => <p key={s.key} className="text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{s.label}</p>)
                    : <p className="text-[11px] text-slate-400">No new stages</p>}
                  {d.fieldsTheyHave > 0 && <p className="text-[10px] text-slate-400 mt-1">+{d.fieldsTheyHave} field{d.fieldsTheyHave === 1 ? '' : 's'}</p>}
                </div>
                <div className={`border rounded-xl p-2.5 ${losing ? 'border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20' : 'border-slate-200 dark:border-zinc-800'}`}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">You would lose</p>
                  {d.stagesYouRemoved.length
                    ? d.stagesYouRemoved.map((s: any) => <p key={s.key} className="text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{s.label}</p>)
                    : <p className="text-[11px] text-slate-400">No stages of your own</p>}
                  {d.fieldsYouChanged > 0 && <p className="text-[10px] text-slate-400 mt-1">{d.fieldsYouChanged} field placement{d.fieldsYouChanged === 1 ? '' : 's'}</p>}
                </div>
              </div>

              <p className="flex items-start gap-1.5 text-[10px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                <AlertTriangle size={11} className="text-amber-500 shrink-0 mt-0.5" />
                Taking the update replaces your layout with theirs. Your workflow’s name, plan gating and
                which visits it opens on are kept. Consultations already recorded are untouched.
              </p>
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-2 bg-slate-50/60 dark:bg-zinc-950/40">
          <button onClick={onClose} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-pine">
            Keep mine
          </button>
          {info?.available && (
            <button
              onClick={adopt}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-seafoam text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Take the update
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpgradeForkDialog;
