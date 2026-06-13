import React, { useState } from 'react';
import { X, Upload, LifeBuoy, Loader2 } from 'lucide-react';
import { supportTicketsAPI } from '../../../services/modules/supportTickets.api';
import { uploadsAPI } from '../../../services/modules/uploads.api';
import { toast } from '../../../services';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

/**
 * Clinic-facing "I paid but it didn't reflect" ticket. Uploads an optional
 * payment-proof screenshot to R2 (scope 'payment-proof') then files the ticket;
 * SUPER_ADMINs triage it from the Support Tickets console.
 */
const ReportPaymentIssueModal: React.FC<Props> = ({ isOpen, onClose, onSubmitted }) => {
  const [message, setMessage] = useState('');
  const [reference, setReference] = useState('');
  const [provider, setProvider] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const submit = async () => {
    if (!message.trim()) {
      toast.error('Please describe the issue.');
      return;
    }
    setBusy(true);
    try {
      let screenshotUrl: string | undefined;
      let screenshotKey: string | undefined;
      if (file) {
        const up = await uploadsAPI.upload(file, 'payment-proof');
        screenshotUrl = up.publicUrl;
        screenshotKey = up.key;
      }
      const res = await supportTicketsAPI.create({
        message: message.trim(),
        attemptReference: reference.trim() || undefined,
        provider: provider || undefined,
        screenshotUrl,
        screenshotKey,
      });
      if (res.success) {
        toast.success('Ticket submitted — our team will follow up.');
        setMessage('');
        setReference('');
        setProvider('');
        setFile(null);
        onSubmitted?.();
        onClose();
      }
    } catch (e: any) {
      toast.error(e?.message || 'Could not submit ticket');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-pine dark:text-zinc-100 flex items-center gap-2">
            <LifeBuoy size={18} className="text-seafoam"/> Report a payment issue
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="field-label">What happened?</label>
            <textarea
              className="field-textarea"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. I paid via M-Pesa but my plan still shows inactive."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Provider (optional)</label>
              <select className="field-select" value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="">—</option>
                <option value="MPESA">M-Pesa</option>
                <option value="PAYSTACK">Paystack</option>
                <option value="LIPANA">Lipana</option>
                <option value="PESAPAL">Pesapal</option>
              </select>
            </div>
            <div>
              <label className="field-label">Reference (optional)</label>
              <input
                className="field-input"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="M-Pesa code / ref"
              />
            </div>
          </div>
          <div>
            <label className="field-label">Payment screenshot (optional)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-pine file:text-white file:text-xs file:font-bold"
            />
            {file && <p className="text-[11px] text-slate-400 mt-1">{file.name}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-sm font-bold">Cancel</button>
          <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-xl bg-pine text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>} Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportPaymentIssueModal;
