import React, { useEffect, useMemo, useState } from 'react';
import { Users, ChevronDown, ChevronUp, FileText, Check, Clock, ArrowRight, X, Download, CreditCard, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { visitsAPI } from '../../../services';
import { Visit } from '../../../types';
import { printElementAsPdf } from '../shared/printPdf';

// Group Visit (077) — several animals registered in one go, one visit per
// animal, all sharing a groupVisitId. Animals may belong to DIFFERENT
// clients: each visit bills its own owner. This panel shows per-animal
// workflow progress WITH the patient + owner names (so the vet keeps track
// of who's who mid-visit), and builds the consolidated invoice PER CLIENT:
// every owner gets one document covering only their animals — individual
// per-patient invoices stay underneath. It's a projection over the sibling
// visits, so editing any individual invoice reflects here automatically.

interface Props {
  visit: Visit;
  currency: string;
  clientName?: string;
  // opts.settle lands on the sibling visit with its Settle modal open —
  // the group settles each animal individually, right from this panel.
  onNavigateToVisit?: (id: number, opts?: { settle?: boolean }) => void;
  // Fired after a batch settle so the parent refreshes the visit context.
  onSettled?: () => void;
}

const statusMeta = (v: any): { label: string; done: boolean; cls: string } => {
  if (v.isPaid || v.status === 'COMPLETED') return { label: 'Complete · settled', done: true, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' };
  if (v.status === 'PENDING_PAYMENT') return { label: 'Workflow complete · unpaid', done: true, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' };
  if (v.status === 'IN_PROGRESS') return { label: 'In progress', done: false, cls: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' };
  if (v.status === 'CANCELLED') return { label: 'Cancelled', done: false, cls: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400' };
  return { label: 'Pending', done: false, cls: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300' };
};

interface ClientGroup { clientId: string; clientName: string; visits: any[]; total: number; outstanding: number }

const GroupVisitPanel: React.FC<Props> = ({ visit, currency, clientName, onNavigateToVisit, onSettled }) => {
  const [siblings, setSiblings] = useState<any[]>([]);
  const [open, setOpen] = useState(true);
  // The client whose consolidated invoice is open (null = closed).
  const [invoiceFor, setInvoiceFor] = useState<ClientGroup | null>(null);
  // "Settle all" — ONE payment action clears every finalized unpaid bill a
  // client has in the group (settled per visit under the hood, one method).
  const [settleAllFor, setSettleAllFor] = useState<ClientGroup | null>(null);
  const [settlingAll, setSettlingAll] = useState<string | null>(null); // progress label

  const settleableOf = (g: ClientGroup) => g.visits.filter((v: any) => !v.isPaid && v.status === 'PENDING_PAYMENT');

  const settleAll = async (g: ClientGroup, method: string) => {
    const targets = settleableOf(g);
    if (targets.length === 0) return;
    const notReady = g.visits.filter((v: any) => !v.isPaid && v.status !== 'PENDING_PAYMENT' && v.status !== 'CANCELLED').length;
    setSettlingAll(`${targets.length} bill${targets.length === 1 ? '' : 's'}…`);
    try {
      // ONE backend call settles the batch server-side; per-visit results
      // come back so a partial failure is explicit, never silent.
      const res = await visitsAPI.settleGroup({ visitIds: targets.map((v: any) => v.id), paymentMethod: method });
      const results = res.success ? (res.data?.results || []) : [];
      const ok = results.filter(r => r.ok).length;
      const failed = results.filter(r => !r.ok).map(r => {
        const v = targets.find((t: any) => String(t.id) === String(r.visitId));
        return `${v?.pet?.name || `#${r.visitId}`}${r.error ? ` (${r.error})` : ''}`;
      });
      if (ok > 0) toast.success(`Settled ${ok} bill${ok === 1 ? '' : 's'} for ${g.clientName}`);
      if (failed.length) toast.error(`Could not settle: ${failed.join(', ')}`);
      if (notReady > 0) toast(`${notReady} bill${notReady === 1 ? '' : 's'} not finalized yet — finish the workflow first.`, { icon: 'ℹ️' });
    } catch (e: any) {
      toast.error(e?.message || 'Group settlement failed');
    } finally {
      setSettlingAll(null);
      setSettleAllFor(null);
    }
    // Reconcile the panel + parent visit with the committed state.
    try { const r = await visitsAPI.getGroup(visit.groupVisitId!); if (r.success && r.data?.visits) setSiblings(r.data.visits); } catch { /* trailing effect covers it */ }
    onSettled?.();
  };

  useEffect(() => {
    let alive = true;
    if (!visit.groupVisitId) return;
    const load = () => visitsAPI.getGroup(visit.groupVisitId!)
      .then(res => { if (alive && res.success && res.data?.visits) setSiblings(res.data.visits); })
      .catch(() => { /* non-fatal — panel just stays empty */ });
    load();
    // The optimistic prop change can beat the server write — a trailing
    // refetch picks up the committed state (settles, task completions…).
    const t = setTimeout(load, 1600);
    return () => { alive = false; clearTimeout(t); };
  }, [visit.groupVisitId, visit.status, visit.isPaid, visit.totalCost, (visit.tasks || []).filter(t => t.status === 'COMPLETED').length]);

  // The CURRENT visit's card must never lag: overlay the live prop onto the
  // fetched snapshot so status/paid/progress update instantly, like the rest
  // of the page — the refetch then reconciles the true server state.
  const liveSiblings = useMemo(() => siblings.map(s =>
    String(s.id) === String(visit.id)
      ? { ...s, status: visit.status, isPaid: visit.isPaid, totalCost: visit.totalCost, tasks: visit.tasks ?? s.tasks }
      : s
  ), [siblings, visit.id, visit.status, visit.isPaid, visit.totalCost, visit.tasks]);

  const doneCount = useMemo(() => liveSiblings.filter(s => statusMeta(s).done).length, [liveSiblings]);
  const settledCount = useMemo(() => liveSiblings.filter(s => s.isPaid).length, [liveSiblings]);
  const allSettled = liveSiblings.length > 0 && settledCount === liveSiblings.length;
  const grandTotal = useMemo(() => liveSiblings.reduce((s, v) => s + (Number(v.totalCost) || 0), 0), [liveSiblings]);

  // Billing splits per OWNER: one consolidated invoice per client, covering
  // only that client's animals.
  const clientGroups = useMemo<ClientGroup[]>(() => {
    const map = new Map<string, ClientGroup>();
    for (const s of liveSiblings) {
      const cid = String(s.clientId);
      if (!map.has(cid)) map.set(cid, { clientId: cid, clientName: s.client?.name || `Client #${cid}`, visits: [], total: 0, outstanding: 0 });
      const g = map.get(cid)!;
      g.visits.push(s);
      g.total += Number(s.totalCost) || 0;
      if (!s.isPaid && s.status !== 'CANCELLED') g.outstanding += Number(s.totalCost) || 0;
    }
    return [...map.values()];
  }, [liveSiblings]);
  const multiClient = clientGroups.length > 1;

  if (!visit.groupVisitId || siblings.length < 2) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-violet-200 dark:border-violet-900/50 rounded-xl shadow-sm mb-3 overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-violet-50 dark:bg-violet-950/30 hover:bg-violet-100 dark:hover:bg-violet-950/50 transition-colors">
        <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-violet-700 dark:text-violet-300">
          <Users size={14} /> Group Visit — {siblings.length} animals{multiClient ? ` · ${clientGroups.length} owners` : ''} · {doneCount}/{siblings.length} workflows complete
          {/* Settlement progress — counts up 2/4 → 3/4 → 4/4 as each bill
              settles; fully green once the whole group is paid. */}
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] ${allSettled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
            {allSettled ? <Check size={9} /> : <Clock size={9} />} {settledCount}/{siblings.length} settled{allSettled ? ' — group complete' : ''}
          </span>
        </span>
        <span className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">{currency} {grandTotal.toLocaleString()} total</span>
          {open ? <ChevronUp size={14} className="text-violet-500" /> : <ChevronDown size={14} className="text-violet-500" />}
        </span>
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {clientGroups.map(g => (
            <div key={g.clientId}>
              {/* Owner header — always visible so the vet knows whose animals
                  these are; each owner is billed separately. */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">
                  👤 {g.clientName}
                  {multiClient && <span className="text-violet-500 normal-case tracking-normal font-bold"> — billed separately · {g.visits.length} animal{g.visits.length === 1 ? '' : 's'} · {currency} {g.total.toLocaleString()}</span>}
                  <span className={`normal-case tracking-normal font-bold ${g.outstanding === 0 ? 'text-emerald-600' : 'text-amber-600'}`}> · {g.visits.filter((v: any) => v.isPaid).length}/{g.visits.length} settled</span>
                </p>
                <span className="shrink-0 flex items-center gap-1.5">
                  {/* One payment clearing every finalized bill this client
                      has in the group. */}
                  {settleableOf(g).length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSettleAllFor(g)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 text-white text-[8px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all"
                    >
                      <CreditCard size={10} /> Settle all ({settleableOf(g).length}) · {currency} {settleableOf(g).reduce((s: number, v: any) => s + (Number(v.totalCost) || 0), 0).toLocaleString()}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setInvoiceFor(g)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg border border-violet-400/50 text-violet-600 dark:text-violet-300 text-[8px] font-black uppercase tracking-widest hover:bg-violet-600 hover:!text-white transition-all"
                  >
                    <FileText size={10} /> Invoice — {g.clientName.split(' ')[0]}
                  </button>
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {g.visits.map(s => {
                  const meta = statusMeta(s);
                  const isThis = String(s.id) === String(visit.id);
                  const tasksDone = (s.tasks || []).filter((t: any) => t.status === 'COMPLETED').length;
                  const tasksTotal = (s.tasks || []).length;
                  // Settle each animal individually: finalized + unpaid rows
                  // get a one-click Settle that opens that visit's pay modal.
                  const settleable = !s.isPaid && s.status === 'PENDING_PAYMENT';
                  return (
                    <div
                      key={s.id}
                      role="button"
                      tabIndex={isThis ? -1 : 0}
                      onClick={() => { if (!isThis) onNavigateToVisit?.(Number(s.id)); }}
                      className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-all ${
                        isThis ? 'border-violet-400 bg-violet-500/5' : 'border-slate-100 dark:border-zinc-800 hover:border-violet-300 cursor-pointer'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="text-[11px] font-black text-pine dark:text-zinc-100 uppercase truncate">{s.pet?.name || `Visit #${s.id}`}</span>
                          {isThis && <span className="text-[8px] font-black uppercase text-violet-500">· this visit</span>}
                        </span>
                        <span className="block text-[9px] text-slate-400 font-bold truncate">
                          {/* Owner sits in the group header above — no repeat
                              here, so the assigned staffer stays visible. */}
                          {tasksDone}/{tasksTotal} services · {currency} {(Number(s.totalCost) || 0).toLocaleString()}
                          {s.leadStaff?.name && <span className="text-seafoam"> · 🩺 {s.leadStaff.name}</span>}
                        </span>
                      </span>
                      <span className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wide ${meta.cls}`}>
                        {meta.done ? <Check size={9} /> : <Clock size={9} />} {meta.label}
                      </span>
                      {settleable && (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); onNavigateToVisit?.(Number(s.id), { settle: true }); }}
                          title={`Settle ${s.pet?.name || 'this animal'}'s bill now`}
                          className="shrink-0 px-2 py-1 rounded-lg bg-emerald-600 text-white text-[8px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all"
                        >
                          💳 Settle
                        </button>
                      )}
                      {!isThis && !settleable && <ArrowRight size={12} className="text-slate-300 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-[9px] text-slate-400 font-bold">
            Each patient keeps its own invoice; every owner also gets one consolidated invoice covering just their animals.
          </p>
        </div>
      )}

      {invoiceFor && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setInvoiceFor(null)} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-5 py-3 bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Consolidated Group Invoice — {invoiceFor.clientName}</h3>
              <div className="flex items-center gap-2">
                {settleableOf(invoiceFor).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSettleAllFor(invoiceFor)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all"
                  >
                    <CreditCard size={12} /> Settle all ({settleableOf(invoiceFor).length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => printElementAsPdf('group-invoice-content', `Group Invoice ${invoiceFor.clientName} ${visit.groupVisitId}`, false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-seafoam text-white text-[9px] font-black uppercase tracking-widest hover:bg-pine transition-all"
                >
                  <Download size={12} /> Download PDF
                </button>
                <button type="button" onClick={() => setInvoiceFor(null)} className="p-1.5 text-slate-400 hover:text-pine"><X size={16} /></button>
              </div>
            </div>
            <div id="group-invoice-content" className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-black text-pine dark:text-zinc-100 uppercase">Group Visit Invoice</p>
                  <p className="text-[11px] text-slate-500 font-bold">Ref {visit.groupVisitId}</p>
                  <p className="text-[11px] text-slate-500 font-bold mt-1">Client: <span className="text-pine dark:text-zinc-100">{invoiceFor.clientName}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Date</p>
                  <p className="text-[11px] font-bold text-pine dark:text-zinc-100">{new Date(visit.date).toLocaleDateString()}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Animals</p>
                  <p className="text-[11px] font-bold text-pine dark:text-zinc-100">{invoiceFor.visits.length}{multiClient ? ` of ${siblings.length} in group` : ''}</p>
                </div>
              </div>

              {invoiceFor.visits.map(s => (
                <div key={s.id} className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-zinc-950">
                    <p className="text-[11px] font-black uppercase text-pine dark:text-zinc-100">{s.pet?.name || `Visit #${s.id}`} <span className="text-slate-400 font-bold normal-case">— invoice INV-{s.id}</span></p>
                    <span className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${s.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {s.isPaid ? `Paid${s.receiptNumber ? ` · ${s.receiptNumber}` : ''}` : 'Outstanding'}
                      </span>
                      {/* Settle each bill right from the consolidated invoice. */}
                      {!s.isPaid && s.status === 'PENDING_PAYMENT' && (
                        <button
                          type="button"
                          onClick={() => { setInvoiceFor(null); onNavigateToVisit?.(Number(s.id), { settle: true }); }}
                          className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[8px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all"
                        >
                          💳 Settle this bill
                        </button>
                      )}
                    </span>
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
                <span className="text-[10px] font-black uppercase tracking-widest">Total — {invoiceFor.clientName} ({invoiceFor.visits.length} animal{invoiceFor.visits.length === 1 ? '' : 's'})</span>
                <span className="text-base font-black">{currency} {invoiceFor.total.toLocaleString()}</span>
              </div>
              {invoiceFor.outstanding > 0 && invoiceFor.outstanding !== invoiceFor.total && (
                <div className="flex items-center justify-between px-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Still outstanding</span>
                  <span className="text-sm font-black text-amber-600">{currency} {invoiceFor.outstanding.toLocaleString()}</span>
                </div>
              )}
              {invoiceFor.outstanding === 0 && (
                <div className="flex items-center justify-between px-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Fully settled — this document doubles as the combined receipt</span>
                  <span className="text-sm font-black text-emerald-600">{currency} {invoiceFor.total.toLocaleString()}</span>
                </div>
              )}
              <p className="text-[9px] text-slate-400">Settlement is per animal on each individual invoice — this document consolidates {multiClient ? `${invoiceFor.clientName}'s animals in the group` : 'the group'} for the client's records and can be regenerated after edits.</p>
            </div>
          </div>
        </div>
      )}

      {/* Settle-all method picker — one payment method, every finalized bill
          this client has in the group settles in sequence. */}
      {settleAllFor && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !settlingAll && setSettleAllFor(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div>
              <h3 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-tight">Settle all — {settleAllFor.clientName}</h3>
              <p className="text-[10px] font-bold text-slate-400 mt-1">
                {settleableOf(settleAllFor).length} bill{settleableOf(settleAllFor).length === 1 ? '' : 's'} · {currency} {settleableOf(settleAllFor).reduce((s: number, v: any) => s + (Number(v.totalCost) || 0), 0).toLocaleString()} — one payment method, each animal keeps its own receipt.
              </p>
            </div>
            {settlingAll ? (
              <p className="flex items-center justify-center gap-2 py-6 text-[11px] font-black uppercase tracking-widest text-seafoam">
                <Loader2 size={14} className="animate-spin" /> Settling {settlingAll}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'M_PESA', label: 'M-PESA' },
                  { value: 'CARD', label: 'CARD' },
                  { value: 'CASH', label: 'CASH' },
                  { value: 'BANK_TRANSFER', label: 'BANK' },
                ].map(m => (
                  <button key={m.value} type="button" onClick={() => settleAll(settleAllFor, m.value)}
                    className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl border-2 border-slate-100 dark:border-zinc-700 hover:border-emerald-500 transition-all group active:scale-95">
                    <CreditCard size={18} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-pine dark:text-zinc-100">{m.label}</span>
                  </button>
                ))}
              </div>
            )}
            {!settlingAll && (
              <button type="button" onClick={() => setSettleAllFor(null)} className="w-full py-2 text-slate-400 font-black text-[9px] uppercase tracking-widest hover:text-red-500 transition-colors">Cancel</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupVisitPanel;
