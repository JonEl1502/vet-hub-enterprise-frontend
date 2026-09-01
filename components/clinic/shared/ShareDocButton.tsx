import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { MessageCircle, Loader2 } from 'lucide-react';
import { shareDocumentOnWhatsapp } from './documentShare';

/**
 * Just the WhatsApp share, for toolbars that already own their own
 * download/print control (the visit view's coloured / B&W dropdown, say).
 * Where there is no such control, use `DocumentActions` instead — it gives the
 * whole row.
 */
export interface ShareDocButtonProps {
  elementId: string;
  title: string;
  message: string;
  phone?: string | null;
  label?: string;
  className?: string;
}

const ShareDocButton: React.FC<ShareDocButtonProps> = ({
  elementId,
  title,
  message,
  phone,
  label = 'Share',
  className = '',
}) => {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    const t = toast.loading('Preparing PDF…');
    try {
      const outcome = await shareDocumentOnWhatsapp({ elementId, title, message, phone });
      if (outcome === 'shared') toast.success('Shared', { id: t });
      else if (outcome === 'cancelled') toast.dismiss(t);
      else if (outcome === 'fallback')
        toast.success('PDF saved — attach it in the WhatsApp tab that just opened', { id: t, duration: 7000 });
      else toast.error('Could not build the PDF', { id: t });
    } catch {
      toast.error('Could not build the PDF', { id: t });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title="Share this document on WhatsApp"
      className={`flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] text-white rounded-lg font-bold text-[10px] uppercase tracking-wide shadow-sm hover:brightness-95 transition-all active:scale-95 disabled:opacity-60 ${className}`}
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />}
      {label}
    </button>
  );
};

export default ShareDocButton;
