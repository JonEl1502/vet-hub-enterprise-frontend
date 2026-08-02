import React, { useEffect, useState } from 'react';
import { Target, BadgeCheck, ClipboardList } from 'lucide-react';
import { StepProps } from '../types';
import { Section, L, Seg, CheckGrid , showsField } from '../fields';
import { labAPI, imagingAPI } from '../../../../../services';

const CONFIDENCE = ['High', 'Moderate', 'Low'];
const ONSET = ['Acute (< 7 days)', 'Subacute (1–4 weeks)', 'Chronic (> 4 weeks)'];
const SEVERITY = ['Mild', 'Moderate', 'Severe'];
const STATUS = ['Active', 'Resolved', 'Ongoing management'];
const PROGNOSIS = ['Excellent', 'Good', 'Guarded', 'Poor', 'Grave'];

const BASIS = [
  { k: 'history', label: 'History' },
  { k: 'physicalExam', label: 'Physical examination' },
  { k: 'labResults', label: 'Laboratory results' },
  { k: 'imaging', label: 'Imaging' },
  { k: 'other', label: 'Other confirmatory tests' },
];

const DiagnosisStep: React.FC<StepProps> = ({ visit, data, setData, staff, emit, visibleFields }) => {
  const show = showsField(visibleFields);
  const d = data || {};
  // Evidence attachments (user, 2026-08-02): the visit's ACTUAL lab/imaging
  // results — including partner-mirrored ones — CAN (never must) be attached
  // to the confirmed diagnosis. Stored as {type,id,name} refs in the data.
  const [evidencePool, setEvidencePool] = useState<{ type: 'lab' | 'imaging'; id: string; name: string; detail: string }[]>([]);
  useEffect(() => {
    if (!visit?.id) return;
    let alive = true;
    Promise.all([
      labAPI.list({ appointmentId: visit.id } as any, { silent: true } as any).catch(() => null),
      imagingAPI.list({ appointmentId: visit.id } as any, { silent: true } as any).catch(() => null),
    ]).then(([lab, img]) => {
      if (!alive) return;
      const vid = String(visit.id);
      const pool = [
        ...((lab?.data?.records || []).filter((r: any) => String(r.appointmentId ?? '') === vid)
          .map((r: any) => ({ type: 'lab' as const, id: String(r.id), name: r.panelName || 'Lab panel', detail: r.externalSource ? `via ${r.externalSource}` : (r.notes || '') }))),
        ...((img?.data?.records || []).filter((r: any) => String(r.appointmentId ?? '') === vid)
          .map((r: any) => ({ type: 'imaging' as const, id: String(r.id), name: `${r.modality || 'Imaging'}${r.bodyPart ? ` — ${r.bodyPart}` : ''}`, detail: r.findings || (r.externalSource ? `via ${r.externalSource}` : '') }))),
      ];
      setEvidencePool(pool);
    });
    return () => { alive = false; };
  }, [visit?.id]);
  const attached: { type: string; id: string; name: string }[] = d.evidenceRecords || [];
  const isAttached = (id: string) => attached.some(a => a.id === id);
  const toggleEvidence = (rec: { type: 'lab' | 'imaging'; id: string; name: string }) => {
    const next = isAttached(rec.id) ? attached.filter(a => a.id !== rec.id) : [...attached, { type: rec.type, id: rec.id, name: rec.name }];
    // Attaching also ticks the matching basis box — detaching leaves it alone.
    const basisKey = rec.type === 'lab' ? 'labResults' : 'imaging';
    const patch: any = { evidenceRecords: next };
    if (!isAttached(rec.id)) patch.basis = { ...(d.basis || {}), [basisKey]: true };
    setData(patch);
    if (!isAttached(rec.id)) emit(`${rec.name} attached as diagnosis evidence`, 'action', true);
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section icon={Target} title="Presumptive Diagnosis">
          {show('presumptive') && <L label="Primary presumptive diagnosis">
            <input className="field-input" placeholder="e.g. Acute gastroenteritis" value={d.presumptive ?? ''}
              onChange={e => setData({ presumptive: e.target.value })}
              onBlur={e => e.target.value && emit(`Presumptive diagnosis recorded — ${e.target.value}`, 'milestone', true)} />
          </L>}
          {show('confidence') && <L label="Confidence"><Seg options={CONFIDENCE} value={d.confidence} onChange={v => setData({ confidence: v })} /></L>}
        </Section>

        <Section icon={BadgeCheck} title="Confirmed Diagnosis">
          {show('confirmed') && <L label="Confirmed diagnosis">
            <input className="field-input" placeholder="Final diagnosis once confirmed" value={d.confirmed ?? ''}
              onChange={e => setData({ confirmed: e.target.value })}
              onBlur={e => e.target.value && emit(`Diagnosis confirmed — ${e.target.value}`, 'milestone', true)} />
          </L>}
          {show('basis') && <L label="Basis / evidence">
            <CheckGrid items={BASIS} value={d.basis} onToggle={(k, _l, on) => setData({ basis: { ...(d.basis || {}), [k]: on } })} />
          </L>}
          {/* Optional result attachments — shown only when results exist. */}
          {evidencePool.length > 0 && (
            <L label="Attach results (optional)">
              <div className="space-y-1">
                {evidencePool.map(r => (
                  <button key={r.id} type="button" onClick={() => toggleEvidence(r)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-all ${isAttached(r.id) ? 'border-seafoam bg-seafoam/10' : 'border-slate-200 dark:border-zinc-800 hover:border-seafoam/50'}`}>
                    <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-black shrink-0 ${isAttached(r.id) ? 'bg-seafoam text-white' : 'bg-slate-100 dark:bg-zinc-800 text-transparent'}`}>✓</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold text-pine dark:text-zinc-100 truncate">{r.type === 'lab' ? '🧪' : '🩻'} {r.name}</span>
                      {r.detail && <span className="block text-[9px] text-slate-400 truncate">{r.detail}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </L>
          )}
          <div className="grid grid-cols-2 gap-3">
            {show('dateConfirmed') && <L label="Date confirmed">
              <input className="field-input" type="date" value={d.dateConfirmed ?? ''} onChange={e => setData({ dateConfirmed: e.target.value })} />
            </L>}
            {show('confirmedBy') && <L label="Confirmed by">
              <select className="field-select" value={d.confirmedBy ?? ''} onChange={e => setData({ confirmedBy: e.target.value })}>
                <option value="">—</option>{staff.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </select>
            </L>}
          </div>
        </Section>
      </div>

      <Section icon={ClipboardList} title="Diagnosis Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {show('onset') && <L label="Onset">
            <select className="field-select" value={d.onset ?? ''} onChange={e => setData({ onset: e.target.value })}>
              <option value="">—</option>{ONSET.map(o => <option key={o}>{o}</option>)}
            </select>
          </L>}
          {show('etiology') && <L label="Etiology / cause">
            <input className="field-input" placeholder="e.g. Likely dietary indiscretion" value={d.etiology ?? ''} onChange={e => setData({ etiology: e.target.value })} />
          </L>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {show('severity') && <L label="Severity"><Seg options={SEVERITY} value={d.severity} onChange={v => setData({ severity: v })} /></L>}
          {show('status') && <L label="Status"><Seg options={STATUS} value={d.status} onChange={v => setData({ status: v })} /></L>}
          {show('prognosis') && <L label="Prognosis">
            <select className="field-select" value={d.prognosis ?? ''} onChange={e => { setData({ prognosis: e.target.value }); if (e.target.value) emit(`Prognosis updated — ${e.target.value}`, 'action', true); }}>
              <option value="">—</option>{PROGNOSIS.map(o => <option key={o}>{o}</option>)}
            </select>
          </L>}
        </div>
        <L label="Notes">
          <textarea className="field-textarea" rows={2} placeholder="Context for the diagnosis…" value={d.notes ?? ''} onChange={e => setData({ notes: e.target.value })} />
        </L>
      </Section>
    </div>
  );
};

export default DiagnosisStep;
