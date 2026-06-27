import React from 'react';
import { ExternalLink, Share2, CheckCircle2, Loader2 } from 'lucide-react';

/**
 * The standard control block for a clinical module record (mirrors the Surgery
 * drawer): action row (Linked appointment · Share · Close & Settle), Status,
 * optional Started/Ended, optional Complexity 1–5, and Notes format. Each part
 * renders only when its prop is provided, so a module shows just what fits
 * ("core everywhere, extras where they fit").
 */
export interface StandardRecordControlsProps {
  appointmentId?: string | null;
  onOpenAppointment?: (id: string, settle?: boolean) => void;
  onShare?: () => void;
  shareCount?: number;
  onCloseSettle?: () => void;
  closeSettleBusy?: boolean;
  closeSettleDisabled?: boolean;
  status?: { value: string; options: string[]; onChange: (v: string) => void };
  timing?: { startedAt: string | null; endedAt: string | null; onChange: (patch: { startedAt?: string | null; endedAt?: string | null }) => void };
  complexity?: { value: number | null; onChange: (v: number | null) => void };
  notesFormat?: { value: string; onChange: (v: string) => void };
}

const labelCls = 'block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5';
const fieldCls = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm text-pine dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-seafoam';
const toLocalInput = (v: string | null) => (v ? new Date(v).toISOString().slice(0, 16) : '');

const StandardRecordControls: React.FC<StandardRecordControlsProps> = (p) => (
  <div className="space-y-4">
    {/* Action row */}
    <div className="flex flex-wrap items-center gap-2">
      {p.appointmentId && p.onOpenAppointment && (
        <button onClick={() => p.onOpenAppointment!(p.appointmentId!, false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-seafoam/40 bg-seafoam/10 text-seafoam text-[10px] font-black uppercase tracking-widest hover:bg-seafoam/20 transition-all">
          <ExternalLink size={12} /> Linked appointment
        </button>
      )}
      {p.onShare && (
        <button onClick={p.onShare} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-300 text-[10px] font-black uppercase tracking-widest hover:border-seafoam transition-all">
          <Share2 size={12} /> Share{p.shareCount ? ` · ${p.shareCount}` : ''}
        </button>
      )}
      {p.onCloseSettle && (
        <button onClick={p.onCloseSettle} disabled={p.closeSettleBusy || p.closeSettleDisabled} title={p.closeSettleDisabled ? 'No linked visit to settle' : 'Close the record and settle the linked visit'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-seafoam text-white text-[10px] font-black uppercase tracking-widest hover:bg-seafoam/90 transition-all disabled:opacity-50 ml-auto">
          {p.closeSettleBusy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Close &amp; Settle
        </button>
      )}
    </div>

    {/* Status */}
    {p.status && (
      <div>
        <label className={labelCls}>Status</label>
        <div className="flex flex-wrap gap-2">
          {p.status.options.map(s => (
            <button key={s} onClick={() => p.status!.onChange(s)}
              className={`flex-1 min-w-[90px] px-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${p.status!.value === s ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'}`}>
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>
    )}

    {/* Started / Ended */}
    {p.timing && (
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Started</label><input type="datetime-local" className={fieldCls} value={toLocalInput(p.timing.startedAt)} onChange={e => p.timing!.onChange({ startedAt: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
        <div><label className={labelCls}>Ended</label><input type="datetime-local" className={fieldCls} value={toLocalInput(p.timing.endedAt)} onChange={e => p.timing!.onChange({ endedAt: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
      </div>
    )}

    <div className="grid grid-cols-2 gap-3">
      {/* Complexity */}
      {p.complexity && (
        <div>
          <label className={labelCls}>Complexity</label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => p.complexity!.onChange(p.complexity!.value === n ? null : n)}
                className={`flex-1 py-2 rounded-lg text-xs font-black border transition-all ${p.complexity!.value === n ? 'bg-rose-500 text-white border-rose-500' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'}`}>{n}</button>
            ))}
          </div>
        </div>
      )}

      {/* Notes format */}
      {p.notesFormat && (
        <div>
          <label className={labelCls}>Notes format</label>
          <div className="flex gap-2">
            {[{ v: 'PARAGRAPH', l: 'Paragraph' }, { v: 'BULLET', l: 'Bullets' }].map(o => (
              <button key={o.v} onClick={() => p.notesFormat!.onChange(o.v)}
                className={`flex-1 px-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${p.notesFormat!.value === o.v ? 'bg-seafoam text-white border-seafoam' : 'bg-slate-50 dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800'}`}>{o.l}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

export default StandardRecordControls;
