import React, { useEffect, useState } from 'react';
import { ArrowRightLeft, X, Loader2, Building2 } from 'lucide-react';
import { clinicsAPI } from '../services';

type Subject = 'client' | 'pet';

interface Props {
  isOpen: boolean;
  subject: Subject;
  subjectId: string | number | null;
  subjectLabel?: string; // e.g. "Mrs. Anne Kiplagat" or "Buddy"
  currentClinicId?: string | number | null;
  currentClinicName?: string | null;
  onClose: () => void;
  onConfirm: (toClinicId: string) => Promise<void>;
}

const TransferClinicModal: React.FC<Props> = ({
  isOpen, subject, subjectId, subjectLabel, currentClinicId, currentClinicName,
  onClose, onConfirm,
}) => {
  const [clinics, setClinics] = useState<Array<{ id: string; name: string }>>([]);
  const [pickedClinicId, setPickedClinicId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setClinics([]);
      setPickedClinicId('');
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    clinicsAPI.getAll()
      .then((res: any) => {
        const list = (res?.data?.clinics ?? res?.clinics ?? []).map((c: any) => ({
          id: String(c.id),
          name: c.name,
        }));
        setClinics(list);
      })
      .catch((e: any) => setError(e?.message || 'Failed to load clinics'))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen || !subjectId) return null;

  const handleConfirm = async () => {
    if (!pickedClinicId) return;
    if (currentClinicId && String(currentClinicId) === pickedClinicId) {
      setError('Already at that clinic');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(pickedClinicId);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={16} className="text-seafoam" />
            <h2 className="text-sm font-black text-pine dark:text-zinc-100 uppercase tracking-wider">
              Transfer {subject}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800">
            <X size={14} className="text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {subjectLabel && (
            <p className="text-xs text-slate-500 truncate">
              {subject === 'client' ? 'Client' : 'Pet'}: <span className="font-bold text-pine dark:text-zinc-100">{subjectLabel}</span>
            </p>
          )}
          {currentClinicName && (
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Building2 size={11} /> Currently at: <span className="font-bold text-pine dark:text-zinc-100">{currentClinicName}</span>
            </p>
          )}

          <div>
            <label className="field-label">Move to clinic</label>
            <select
              value={pickedClinicId}
              onChange={(e) => setPickedClinicId(e.target.value)}
              className="field-select"
              disabled={loading}
            >
              <option value="">{loading ? 'Loading clinics…' : 'Select a clinic'}</option>
              {clinics
                .filter((c) => !currentClinicId || c.id !== String(currentClinicId))
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
          </div>

          {subject === 'client' && (
            <p className="text-[11px] text-slate-400">
              All pets owned by this client will move with them.
            </p>
          )}
          {subject === 'pet' && (
            <p className="text-[11px] text-slate-400">
              The pet's owner moves with it if they belong to a different clinic.
            </p>
          )}

          {error && (
            <p className="text-xs text-red-600 font-semibold">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!pickedClinicId || submitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest bg-pine text-white disabled:opacity-40"
          >
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightLeft size={12} />}
            Transfer
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferClinicModal;
