import React, { useState } from 'react';
import { Power, Loader2 } from 'lucide-react';
import DeleteConfirmationDialog from './DeleteConfirmationDialog';

interface StatusToggleProps {
  isActive: boolean;
  /** Name shown in the confirm dialog, e.g. the user's or clinic's name. */
  entityName?: string;
  /** Lowercase noun used in dialog copy, e.g. 'user', 'supplier', 'client'. */
  entityKind?: string;
  /** Called with the requested next state. May be async; the toggle shows a spinner until it resolves. */
  onToggle: (next: boolean) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
}

/**
 * Active/Inactive pill that confirms before flipping an account's `isActive`.
 * Deactivating is treated as the dangerous action (it can block login for
 * account holders); reactivating is a lighter confirm. Reuses the shared
 * DeleteConfirmationDialog for a consistent look.
 */
const StatusToggle: React.FC<StatusToggleProps> = ({
  isActive,
  entityName,
  entityKind = 'account',
  onToggle,
  disabled = false,
  className = '',
}) => {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const next = !isActive;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onToggle(next);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
        title={isActive ? `Deactivate ${entityKind}` : `Reactivate ${entityKind}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 ${
          isActive
            ? 'bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-red-500/10 hover:text-red-500'
            : 'bg-red-500/10 text-red-500 hover:bg-green-500/10 hover:text-green-600'
        } ${className}`}
      >
        {busy ? <Loader2 size={11} className="animate-spin" /> : <Power size={11} />}
        {isActive ? 'Active' : 'Inactive'}
      </button>

      <DeleteConfirmationDialog
        isOpen={confirming}
        onClose={() => { if (!busy) setConfirming(false); }}
        onConfirm={handleConfirm}
        isDeleting={busy}
        tone={next ? 'warning' : 'danger'}
        title={next ? `Reactivate ${entityKind}` : `Deactivate ${entityKind}`}
        entityLabel={`${entityKind.charAt(0).toUpperCase()}${entityKind.slice(1)}:`}
        entityName={entityName}
        confirmLabel={next ? 'Reactivate' : 'Deactivate'}
        busyLabel={next ? 'Reactivating...' : 'Deactivating...'}
        warning={next ? null : `Deactivating will revoke access for this ${entityKind} until reactivated.`}
        message={
          next
            ? `Reactivate this ${entityKind}? Access will be restored.`
            : `Deactivate this ${entityKind}? They will be blocked from signing in and hidden from active lists. You can reactivate at any time.`
        }
      />
    </>
  );
};

export default StatusToggle;
