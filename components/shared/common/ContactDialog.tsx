import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Phone, MessageCircle, Copy, Check } from 'lucide-react';

/**
 * Reaching a client by phone, without handing the decision to the browser.
 *
 * A bare `<a href="tel:…">` makes the OS ask *"app.vethubcore.com wants to open
 * this application"* — a dialog nobody expects, that says nothing about who is
 * being called, and that on a desktop usually opens something useless (user,
 * 2026-08-23). On a debt-chasing screen the useful actions are: see the number,
 * WhatsApp it, copy it, and only then dial.
 *
 * Portalled to <body> for the same reason the calculator is: several hosts sit
 * inside `backdrop-blur` headers, and `backdrop-filter` makes an ancestor a
 * containing block for `position: fixed`.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  name: string;
  phone: string;
  /** Optional context line — e.g. "KES 61,525 owed · oldest 30d". */
  subtitle?: string;
}

const ContactDialog: React.FC<Props> = ({ open, onClose, name, phone, subtitle }) => {
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  const digits = String(phone || '').replace(/\D/g, '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard is blocked in some contexts (insecure origin, permissions).
      // Say nothing rather than throw — the number is on screen to read.
    }
  };

  const ACTION = 'flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-colors';

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 fade-in duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-pine dark:text-zinc-100 truncate">{name}</p>
            {subtitle && <p className="text-[10px] font-bold text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} title="Close" className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800">
            <X size={16} />
          </button>
        </div>

        <p className="text-lg font-black text-pine dark:text-zinc-100 tabular-nums tracking-tight">{phone || '—'}</p>

        {digits ? (
          <div className="space-y-2">
            <a
              href={`https://wa.me/${digits}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className={`${ACTION} bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900 hover:bg-emerald-100 dark:hover:bg-emerald-950/50`}
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
            <button type="button" onClick={copy} className={`${ACTION} bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700`}>
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy number'}
            </button>
            {/* Dialling last, and only on an explicit press — this is the one
                that hands off to the OS, so it should never be the accident. */}
            <a
              href={`tel:${phone}`}
              onClick={onClose}
              className={`${ACTION} bg-pine text-white border-pine hover:opacity-90`}
            >
              <Phone size={14} /> Call
            </a>
          </div>
        ) : (
          <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">No phone number on file for this client.</p>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default ContactDialog;
