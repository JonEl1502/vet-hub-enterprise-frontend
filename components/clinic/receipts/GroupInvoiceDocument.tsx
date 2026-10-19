import React from 'react';
import {
  DocClinic, DocLetterhead, DocTitleBar, DocSectionBar, DocFooter, docColor, docInk,
} from '../../shared/common/DocumentChrome';

/**
 * THE CONSOLIDATED GROUP INVOICE — one owner's animals from a group visit, as
 * one page. Same frame as the visit invoice (logo left, themed title bar,
 * sign-up QR and "Powered by VetHubCore" at the foot) so a client holding both
 * sees one family of documents.
 *
 * Two screens print this — the group panel's modal and the Invoice tab of a
 * grouped visit — and they had drifted into two hand-built copies. One
 * component now, so the next change cannot reach only one of them.
 *
 * It is a PROJECTION over the sibling visits: settlement stays per animal, on
 * each animal's own invoice (the per-animal action slot is how a caller lets
 * the user settle from here; it carries `print:hidden` buttons, which the PDF
 * clone strips).
 */

export interface GroupInvoiceVisit {
  id: string | number;
  pet?: { name?: string } | null;
  tasks?: { id: string | number; name: string; category?: string | null; price?: number | null }[];
  isPaid?: boolean;
  receiptNumber?: string | null;
  totalCost?: number | null;
}

interface Props {
  id: string;
  clinic: DocClinic;
  currency: string;
  groupRef: string;
  /** Already formatted. */
  date: string;
  client: { name?: string | null; phone?: string | null; address?: string | null };
  visits: GroupInvoiceVisit[];
  total: number;
  /** What is still owed across these visits. */
  outstanding: number;
  /** "2 of 5 in group" — only when the group spans more than one owner. */
  animalsNote?: string;
  /** Header for an animal (name + link). Receives the default content to wrap. */
  renderVisitTitle?: (v: GroupInvoiceVisit, defaultTitle: React.ReactNode) => React.ReactNode;
  /** Buttons beside an animal's status — print:hidden. */
  renderVisitAction?: (v: GroupInvoiceVisit) => React.ReactNode;
  footnote?: string;
}

const GroupInvoiceDocument: React.FC<Props> = ({
  id, clinic, currency, groupRef, date, client, visits, total, outstanding, animalsNote,
  renderVisitTitle, renderVisitAction, footnote,
}) => {
  const color = docColor(clinic.color);
  const ink = docInk(clinic.color);
  const amt = (n: number) => `${currency} ${Number(n || 0).toLocaleString()}`;
  const paid = Math.max(total - outstanding, 0);

  return (
    <div id={id} className="bg-white text-slate-800 border border-slate-200 rounded-xl overflow-hidden shadow-sm p-6 space-y-4">
      <DocLetterhead clinic={clinic} />
      <DocTitleBar title="Group invoice" color={clinic.color} />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 text-[11px] leading-snug">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Customer</p>
          <p className="text-sm font-black text-slate-900">{client.name || '—'}</p>
          {client.address && <p className="text-slate-500">{client.address}</p>}
          {client.phone && <p className="text-slate-500">{client.phone}</p>}
        </div>
        <dl className="shrink-0 text-[11px] leading-snug grid gap-x-3 gap-y-0.5" style={{ gridTemplateColumns: 'auto auto' }}>
          <dt className="text-right text-slate-500">Group ref:</dt>
          <dd className="font-black text-slate-900">{groupRef}</dd>
          <dt className="text-right text-slate-500">Bill Date:</dt>
          <dd className="font-bold text-slate-800">{date}</dd>
          <dt className="text-right text-slate-500">Animals:</dt>
          <dd className="font-bold text-slate-800">{visits.length}{animalsNote ? ` ${animalsNote}` : ''}</dd>
        </dl>
      </div>

      {visits.map((s) => {
        const defaultTitle = (
          <>
            {s.pet?.name || `Visit #${s.id}`}{' '}
            <span className="text-slate-400 font-bold normal-case">— invoice INV-{s.id}</span>
          </>
        );
        return (
          <div key={s.id} className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-50">
              <p className="text-[11px] font-black uppercase text-slate-900">
                {renderVisitTitle ? renderVisitTitle(s, defaultTitle) : defaultTitle}
              </p>
              <span className="flex items-center gap-1.5">
                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${s.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {s.isPaid ? `Paid${s.receiptNumber ? ` · ${s.receiptNumber}` : ''}` : 'Outstanding'}
                </span>
                {renderVisitAction?.(s)}
              </span>
            </div>
            <table className="w-full text-[11px] border-collapse">
              <tbody>
                {(s.tasks || []).map((t) => (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 font-medium text-slate-800">{t.name}</td>
                    <td className="px-3 py-1.5 text-[9px] font-bold uppercase text-slate-400">{t.category}</td>
                    <td className={`px-3 py-1.5 text-right font-mono tabular-nums whitespace-nowrap font-bold ${Number(t.price) < 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                      {amt(Number(t.price || 0))}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2" style={{ borderColor: color }}>
                  <td className="px-3 py-1.5 font-black uppercase text-[9px] text-slate-500" colSpan={2}>Subtotal — {s.pet?.name || `#${s.id}`}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums whitespace-nowrap font-black text-slate-900">{amt(Number(s.totalCost) || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}

      <div className="flex justify-end">
        <div className="flex items-baseline gap-4 pt-1 border-t-2" style={{ borderColor: color }}>
          <span className="font-black uppercase tracking-widest text-[10px] text-slate-500">Total:</span>
          <span className="text-xl font-black tracking-tight text-slate-900 font-mono">{amt(total)}</span>
        </div>
      </div>

      <DocSectionBar color={color} className="text-[11px] font-black uppercase tracking-[0.2em]">
        Payment receipts
      </DocSectionBar>
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total paid</span>
          <span className="text-sm font-black text-slate-900 font-mono">{amt(paid)}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: ink }}>Balance.</span>
          <span className="text-lg font-black text-slate-900 font-mono">{amt(outstanding)}</span>
        </div>
      </div>
      {outstanding === 0 && total > 0 && (
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
          Fully settled — this document doubles as the combined receipt
        </p>
      )}
      {footnote && <p className="text-[9px] text-slate-400">{footnote}</p>}

      <DocFooter clinic={clinic} />
    </div>
  );
};

export default GroupInvoiceDocument;
