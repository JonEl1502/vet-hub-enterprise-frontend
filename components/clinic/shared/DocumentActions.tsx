import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { MessageCircle, Download, Printer, Loader2 } from 'lucide-react';
import { printElementAsPdf } from './printPdf';
import { downloadDocumentPdf, shareDocumentOnWhatsapp } from './documentShare';

/**
 * The action row under any clinic document — invoice, receipt, certificate,
 * report.
 *
 * **Share on WhatsApp leads.** That is deliberate and it is how these documents
 * actually reach clients here; "download" was only ever a means to that end,
 * and the old button did not even do that (it opened a print dialog).
 *
 * Print is kept, small and last. A front desk still prints, and the browser's
 * print-to-PDF is genuinely the better route when someone wants to fiddle with
 * page setup.
 */
export interface DocumentActionsProps {
  /** DOM id of the node that IS the document. */
  elementId: string;
  /** Used for the PDF filename and the share sheet title. */
  title: string;
  /** WhatsApp caption. Defaults to the title plus the clinic's name if given. */
  message?: string;
  /** Client's phone, any local format — normalised for wa.me. */
  phone?: string | null;
  /** Offer the greyscale variant on Print (certificates use this). */
  allowBlackAndWhite?: boolean;
  className?: string;
  /** Drop the Print button where it would just be noise (client portal). */
  showPrint?: boolean;
  size?: 'sm' | 'md';
}

const DocumentActions: React.FC<DocumentActionsProps> = ({
  elementId,
  title,
  message,
  phone,
  allowBlackAndWhite = false,
  className = '',
  showPrint = true,
  size = 'md',
}) => {
  const [busy, setBusy] = useState<null | 'share' | 'download'>(null);

  const pad = size === 'sm' ? 'px-3 py-1.5 text-[9px]' : 'px-4 py-2 text-[10px]';
  const base = `flex items-center gap-2 rounded-xl font-black uppercase tracking-widest transition-all disabled:opacity-60 disabled:cursor-not-allowed ${pad}`;
  const caption = message || title;

  const onShare = async () => {
    if (busy) return;
    setBusy('share');
    const t = toast.loading('Preparing PDF…');
    try {
      const outcome = await shareDocumentOnWhatsapp({ elementId, title, message: caption, phone });
      if (outcome === 'shared') toast.success('Shared', { id: t });
      else if (outcome === 'cancelled') toast.dismiss(t);
      else if (outcome === 'fallback')
        // Desktop cannot attach a file for us. Say so plainly rather than
        // leaving the user staring at an empty WhatsApp draft wondering
        // where the invoice went.
        toast.success('PDF saved — attach it in WhatsApp Web, which just opened', {
          id: t,
          duration: 7000,
        });
      else toast.error('Could not build the PDF', { id: t });
    } catch {
      toast.error('Could not build the PDF', { id: t });
    } finally {
      setBusy(null);
    }
  };

  const onDownload = async () => {
    if (busy) return;
    setBusy('download');
    const t = toast.loading('Building PDF…');
    try {
      const ok = await downloadDocumentPdf(elementId, title);
      if (ok) toast.success('PDF downloaded', { id: t });
      else toast.error('Could not build the PDF', { id: t });
    } catch {
      toast.error('Could not build the PDF', { id: t });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={onShare}
        disabled={busy !== null}
        className={`${base} bg-[#25D366] text-white hover:brightness-95 shadow-sm`}
      >
        {busy === 'share' ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />}
        Share on WhatsApp
      </button>

      <button
        type="button"
        onClick={onDownload}
        disabled={busy !== null}
        className={`${base} bg-slate-100 dark:bg-zinc-800 text-pine dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700`}
      >
        {busy === 'download' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        Download PDF
      </button>

      {showPrint && (
        <button
          type="button"
          onClick={() => printElementAsPdf(elementId, title, false)}
          disabled={busy !== null}
          className={`${base} border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-seafoam hover:text-seafoam`}
        >
          <Printer size={13} /> Print
        </button>
      )}

      {allowBlackAndWhite && showPrint && (
        <button
          type="button"
          onClick={() => printElementAsPdf(elementId, title, true)}
          disabled={busy !== null}
          className={`${base} border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-seafoam hover:text-seafoam`}
        >
          <Printer size={13} /> Print B&amp;W
        </button>
      )}
    </div>
  );
};

export default DocumentActions;
