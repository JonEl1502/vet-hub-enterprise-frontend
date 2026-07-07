import React, { useEffect, useMemo, useState } from 'react';
import { Users, ChevronDown, ChevronUp, FileText, Check, Clock, ArrowRight, X, Download } from 'lucide-react';
import { visitsAPI } from '../../../services';
import { Visit } from '../../../types';
import { printElementAsPdf } from '../shared/printPdf';

// Group Visit (077) — several animals of one client registered in one go,
// one visit per animal, all sharing a groupVisitId. This panel shows the
// per-animal workflow progress (done vs pending) with jump links, and builds
// the CONSOLIDATED group invoice: each patient keeps its own individual
// invoice; the client additionally gets this one document covering all
// animals. It's a projection over the sibling visits, so editing any
// individual invoice (lines, discounts) reflects here automatically.

interface Props {
  visit: Visit;
  currency: string;
  clientName?: string;
  onNavigateToVisit?: (id: number) => void;
}

const statusMeta = (v: any): { label: string; done: boolean; cls: string } => {
  if (v.isPaid || v.status === 'COMPLETED') return { label: 'Complete · settled', done: true, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' };
  if (v.status === 'PENDING_PAYMENT') return { label: 'Workflow complete · unpaid', done: true, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' };
  if (v.status === 'IN_PROGRESS') return { label: 'In progress', done: false, cls: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' };
  if (v.status === 'CANCELLED') return { label: 'Cancelled', done: false, cls: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400' };
  return { label: 'Pending', done: false, cls: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300' };
};

const GroupVisitPanel: React.FC<Props> = ({ visit, currency, clientName, onNavigateToVisit }) => {
  const [siblings, setSiblings] = useState<any[]>([]);
  const [open, setOpen] = useState(true);
  const [showInvoice, setShowInvoice] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!visit.groupVisitId) return;
    visitsAPI.getGroup(visit.groupVisitId)
      .then(res => { if (alive && res.success && res.data?.visits) setSiblings(res.data.visits); })
      .catch(() => { /* non-fatal — panel just stays empty */ });
    return () => { alive = false; };
  }, [visit.groupVisitId, visit.status, visit.isPaid, visit.totalCost]);

  const doneCount = useMemo(() => siblings.filter(s => statusMeta(s).done).length, [siblings]);
  const grandTotal = useMemo(() => siblings.reduce((s, v) => s + (Number(v.totalCost) || 0), 0), [siblings]);
  const outstanding = useMemo(() => siblings.filter(v => !v.isPaid && v.status !== 'CANCELLED').reduce((s, v) => s + (Number(v.totalCost) || 0), 0), [siblings]);

  if (!visit.groupVisitId || siblings.length < 2) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-violet-200 dark:border-violet-900/50 rounded-xl shadow-sm mb-3 overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-violet-50 dark:bg-violet-950/30 hover:bg-violet-100 dark:hover:bg-violet-950/50 transition-colors">
        <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-violet-700 dark:text-violet-300">
          <Users size={14} /> Group Visit — {siblings.length} animals · {doneCount}/{siblings.length} workflows complete
        </span>
        <span className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">{currency} {grandTotal.toLocaleString()} total</span>
          {open ? <ChevronUp size={14} className="text-violet-500" /> : <ChevronDown size={14} className="text-violet-500" />}
        </span>
      </button>

      {open && (
        <div className="p-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {siblings.map(s => {
              const meta = statusMeta(s);
              const isThis = String(s.id) === String(visit.id);
              const tasksDone = (s.tasks || []).filter((t: any) => t.status === 'COMPLETED').length;
              const tasksTotal = (s.tasks || []).length;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={isThis}
                  onClick={() => onNavigateToVisit?.(Number(s.id))}
                  className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-all ${
                    isThis ? 'border-violet-400 bg-violet-500/5 cursor-default' : 'border-slate-100 dark:border-zinc-800 hover:border-violet-300'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase truncate">{s.pet?.name || `Visit #${s.id}`}</span>
                      {isThis && <span className="text-[8px] font-black uppercase text-violet-500">· this visit</span>}
                    </span>
                    <span className="block text-[9px] text-slate-400 font-bold">{tasksDone}/{tasksTotal} services · {currency} {(Number(s.totalCost) || 0).toLocaleString()}</span>
                  </span>
                  <span className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wide ${meta.cls}`}>
                    {meta.done ? <Check size={9} /> : <Clock size={9} />} {meta.label}
                  </span>
                  {!isThis && <ArrowRight size={12} className="text-slate-300 shrink-0" />}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-[9px] text-slate-400 font-bold">
              Each patient keeps its own invoice; the client also gets one consolidated group invoice.
              {outstanding > 0 && <> Outstanding across the group: <span className="text-amber-600">{currency} {outstanding.toLocaleString()}</span></>}
            </p>
            <button
              type="button"
              onClick={() => setShowInvoice(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-violet-700 transition-all"
            >
              <FileText size={12} /> Consolidated group invoice
            </button>
          </div>
        </div>
      )}

      {showInvoice && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowInvoice(false)} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-5 py-3 bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Consolidated Group Invoice</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => printElementAsPdf('group-invoice-content', `Group Invoice ${visit.groupVisitId}`, false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-seafoam text-white text-[9px] font-black uppercase tracking-widest hover:bg-pine transition-all"
                >
                  <Download size={12} /> Download PDF
                </button>
                <button type="button" onClick={() => setShowInvoice(false)} className="p-1.5 text-slate-400 hover:text-pine"><X size={16} /></button>
              </div>
            </div>
            <div id="group-invoice-content" className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-black text-pine dark:text-zinc-100 uppercase">Group Visit Invoice</p>
                  <p className="text-[11px] text-slate-500 font-bold">Ref {visit.groupVisitId}</p>
                  {clientName && <p className="text-[11px] text-slate-500 font-bold mt-1">Client: <span className="text-pine dark:text-zinc-100">{clientName}</span></p>}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Date</p>
                  <p className="text-[11px] font-bold text-pine dark:text-zinc-100">{new Date(visit.date).toLocaleDateString()}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Animals</p>
                  <p className="text-[11px] font-bold text-pine dark:text-zinc-100">{siblings.length}</p>
                </div>
              </div>

              {siblings.map(s => (
                <div key={s.id} className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-zinc-950">
                    <p className="text-[11px] font-black uppercase text-pine dark:text-zinc-100">{s.pet?.name || `Visit #${s.id}`} <span className="text-slate-400 font-bold normal-case">— invoice INV-{s.id}</span></p>
                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${s.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{s.isPaid ? 'Paid' : 'Outstanding'}</span>
                  </div>
                  <table className="w-full text-[11px]">
                    <tbody>
                      {(s.tasks || []).map((t: any) => (
                        <tr key={t.id} className="border-t border-slate-100 dark:border-zinc-800">
                          <td className="px-3 py-1.5 text-pine dark:text-zinc-100 font-medium">{t.name}</td>
                          <td className="px-3 py-1.5 text-slate-400 font-bold text-[9px] uppercase">{t.category}</td>
                          <td className={`px-3 py-1.5 text-right font-bold ${Number(t.price) < 0 ? 'text-emerald-600' : 'text-pine dark:text-zinc-100'}`}>{currency} {Number(t.price || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-200 dark:border-zinc-700">
                        <td className="px-3 py-1.5 font-black uppercase text-[9px] text-slate-500" colSpan={2}>Subtotal — {s.pet?.name || `#${s.id}`}</td>
                        <td className="px-3 py-1.5 text-right font-black text-pine dark:text-zinc-100">{currency} {(Number(s.totalCost) || 0).toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}

              <div className="rounded-xl bg-pine text-white px-4 py-3 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest">Group total ({siblings.length} animals)</span>
                <span className="text-base font-black">{currency} {grandTotal.toLocaleString()}</span>
              </div>
              {outstanding > 0 && outstanding !== grandTotal && (
                <div className="flex items-center justify-between px-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Still outstanding</span>
                  <span className="text-sm font-black text-amber-600">{currency} {outstanding.toLocaleString()}</span>
                </div>
              )}
              <p className="text-[9px] text-slate-400">Settlement is per animal on each individual invoice — this document consolidates the group for the client's records and can be regenerated after edits.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupVisitPanel;
